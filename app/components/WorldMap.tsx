"use client";

import { useEffect, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import type { GeoJSONSource, Map as MapboxMap, Marker } from "mapbox-gl";
import type { PeerDot } from "@/lib/types";

// Public (pk.*) token supplied via env. No hardcoded fallback: a token committed
// to source is permanently exposed in git history. Restrict the token by URL in
// the Mapbox dashboard so it is only usable from your own domains.
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

const LIGHTS = ["#ffc46b", "#ffd9a0", "#ffb04a", "#ff9d5c", "#8fd3ff", "#ffe29a"];

function hashOf(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// A gentle arc between two coordinates (quadratic bezier bowed sideways), so a
// conversation reads as a thread of light between two dots.
function arcBetween(a: PeerDot, b: PeerDot): [number, number][] {
  const mx = (a.lng + b.lng) / 2;
  const my = (a.lat + b.lat) / 2;
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  const bow = 0.18;
  const cx = mx - dy * bow;
  const cy = my + dx * bow;
  const pts: [number, number][] = [];
  for (let i = 0; i <= 32; i++) {
    const t = i / 32;
    const u = 1 - t;
    pts.push([
      u * u * a.lng + 2 * u * t * cx + t * t * b.lng,
      u * u * a.lat + 2 * u * t * cy + t * t * b.lat,
    ]);
  }
  return pts;
}

function arcsFor(peers: PeerDot[]): GeoJSON.FeatureCollection {
  const byId = new Map(peers.map((p) => [p.id, p]));
  const features: GeoJSON.Feature[] = [];
  for (const p of peers) {
    const other = p.talkingTo ? byId.get(p.talkingTo) : undefined;
    // Draw each pair once (from the lexicographically smaller id).
    if (other && other.talkingTo === p.id && p.id < other.id) {
      features.push({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: arcBetween(p, other) },
      });
    }
  }
  return { type: "FeatureCollection", features };
}

const DASH_FRAMES = (() => {
  // Marching-dash animation frames (the standard Mapbox dasharray sequence).
  const dashLength = 2;
  const gapLength = 3;
  const steps = 10;
  const frames: number[][] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * (dashLength + gapLength);
    if (t < dashLength) {
      frames.push([dashLength - t, gapLength, t]);
    } else {
      const s = t - dashLength;
      frames.push([0, s, dashLength, gapLength - s]);
    }
  }
  return frames;
})();

export default function WorldMap({
  peers,
  me,
  onPeerClick,
  canConnect,
}: {
  peers: PeerDot[];
  me: { lat: number; lng: number } | null;
  onPeerClick: (id: string) => void;
  canConnect: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const meMarkerRef = useRef<Marker | null>(null);
  const knownRef = useRef<Set<string> | null>(null);
  const [ready, setReady] = useState(false);

  // Marker click handlers are bound once, so read the live click handler +
  // connectability through refs (synced in an effect, never during render).
  const onPeerClickRef = useRef(onPeerClick);
  const canConnectRef = useRef(canConnect);
  useEffect(() => {
    onPeerClickRef.current = onPeerClick;
    canConnectRef.current = canConnect;
  });

  // Initialise the map once.
  useEffect(() => {
    if (!TOKEN || !containerRef.current) return;
    let cancelled = false;
    const markers = markersRef.current;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current) return;
      mapboxgl.accessToken = TOKEN;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        projection: "globe",
        // Start pulled back so the globe is visible, then glide in to the user.
        center: me ? [me.lng, me.lat] : [0, 20],
        zoom: me ? 2.2 : 1.4,
        attributionControl: true,
      });
      map.on("style.load", () => {
        map.setFog({
          color: "rgb(14, 20, 44)",
          "high-color": "rgb(30, 40, 90)",
          "horizon-blend": 0.06,
          "space-color": "rgb(8, 11, 20)",
          "star-intensity": 0.55,
        });
      });
      map.on("load", () => {
        if (cancelled) return;
        map.addSource("arcs", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "arcs-glow",
          type: "line",
          source: "arcs",
          layout: { "line-cap": "round" },
          paint: {
            "line-color": "#ffc46b",
            "line-width": 8,
            "line-blur": 8,
            "line-opacity": 0.45,
          },
        });
        map.addLayer({
          id: "arcs-flow",
          type: "line",
          source: "arcs",
          layout: { "line-cap": "round" },
          paint: {
            "line-color": "#fff1d6",
            "line-width": 1.8,
            "line-dasharray": DASH_FRAMES[0],
          },
        });
        setReady(true);
        if (me) map.easeTo({ zoom: 5.2, duration: 2600, essential: false });
      });
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      markers.forEach((m) => m.remove());
      markers.clear();
      meMarkerRef.current?.remove();
      meMarkerRef.current = null;
      knownRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // `me` is only read for the initial center; we don't want to re-init on change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show / move the user's own light.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !me) return;
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      if (!meMarkerRef.current) {
        const el = document.createElement("div");
        el.className = "pulse-me";
        el.setAttribute("role", "img");
        el.setAttribute("aria-label", "You are here");
        el.innerHTML = `<span class="pulse-me-label">You</span>`;
        meMarkerRef.current = new mapboxgl.Marker({ element: el })
          .setLngLat([me.lng, me.lat])
          .addTo(map);
      } else {
        meMarkerRef.current.setLngLat([me.lng, me.lat]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [me, ready]);

  // Reconcile markers whenever the peer list changes (or the map becomes ready).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      const markers = markersRef.current;
      const seen = new Set<string>();
      // The first batch is "everyone already here"; only later arrivals ripple.
      const firstBatch = knownRef.current === null;
      const known = (knownRef.current ??= new Set<string>());

      for (const peer of peers) {
        seen.add(peer.id);
        let marker = markers.get(peer.id);
        if (!marker) {
          const h = hashOf(peer.id);
          // Mapbox positions the marker element with an inline `transform`, so
          // the animated dot (which also uses transform) must be a child of a
          // plain wrapper — otherwise the animation overrides the position.
          const wrap = document.createElement("div");
          const el = document.createElement("button");
          el.className = "pulse-dot";
          wrap.appendChild(el);
          el.style.setProperty("--c", LIGHTS[h % LIGHTS.length]);
          el.style.setProperty("--d", `${-((h >> 3) % 34) / 10}s`);
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            const busy = el.dataset.busy === "true";
            if (!busy && canConnectRef.current) onPeerClickRef.current(peer.id);
          });
          if (!firstBatch && !known.has(peer.id)) {
            el.dataset.new = "true";
            window.setTimeout(() => delete el.dataset.new, 4000);
          }
          marker = new mapboxgl.Marker({ element: wrap })
            .setLngLat([peer.lng, peer.lat])
            .addTo(map);
          markers.set(peer.id, marker);
        }
        known.add(peer.id);
        const el = marker.getElement().firstElementChild as HTMLButtonElement;
        el.dataset.busy = String(peer.busy);
        el.title = peer.busy ? "In a conversation" : "Say hello";
        el.setAttribute(
          "aria-label",
          peer.busy ? "Stranger, in a conversation" : "Stranger, tap to say hello",
        );
      }

      // Drop markers for peers that went offline / got filtered out.
      for (const [id, marker] of markers) {
        if (!seen.has(id)) {
          marker.remove();
          markers.delete(id);
          known.delete(id);
        }
      }

      // Conversations in progress, drawn as threads of light.
      const src = map.getSource("arcs") as GeoJSONSource | undefined;
      src?.setData(arcsFor(peers));
    })();

    return () => {
      cancelled = true;
    };
  }, [peers, ready]);

  // Marching dashes along the arcs (only runs while a conversation is visible).
  const hasArcs = peers.some((p) => p.talkingTo);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !hasArcs) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let last = 0;
    let raf = 0;
    const tick = (now: number) => {
      if (now - last > 90) {
        last = now;
        frame = (frame + 1) % DASH_FRAMES.length;
        if (map.getLayer("arcs-flow")) {
          map.setPaintProperty("arcs-flow", "line-dasharray", DASH_FRAMES[frame]);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready, hasArcs]);

  const talking = new Set(peers.filter((p) => p.talkingTo).map((p) => p.id)).size / 2;

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full bg-ink" />

      {!TOKEN && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <p className="glass max-w-md rounded-2xl p-5 text-sm text-text/90">
            Add <code className="text-sodium">NEXT_PUBLIC_MAPBOX_TOKEN</code> to{" "}
            <code>.env</code> to load the map.
          </p>
        </div>
      )}

      {/* Live pulse of the world */}
      <div
        className="glass absolute bottom-5 left-4 flex items-center gap-3 rounded-full py-2 pl-3.5 pr-4 text-xs text-text/90"
        role="status"
        aria-live="polite"
      >
        <span className="relative flex h-2 w-2">
          <span
            className="absolute inset-0 rounded-full bg-sodium"
            style={{ animation: "ring 2s ease-out infinite" }}
          />
          <span className="relative h-2 w-2 rounded-full bg-sodium" />
        </span>
        <span>
          {peers.length === 0
            ? "You're the first light on"
            : `${peers.length + 1} lights on`}
        </span>
        {talking >= 1 && (
          <span className="text-muted">
            {Math.floor(talking)} {Math.floor(talking) === 1 ? "conversation" : "conversations"}
          </span>
        )}
      </div>
    </div>
  );
}
