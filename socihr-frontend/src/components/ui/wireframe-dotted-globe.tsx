import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

interface RotatingEarthProps {
  width?: number;
  height?: number;
  className?: string;
  themeColor?: "peach-pink" | "indigo" | "dark";
}

// Major global enterprise monitoring hubs
const GLOBAL_HUBS: [number, number, string][] = [
  [101.6869, 3.139, "Kuala Lumpur"],
  [103.8198, 1.3521, "Singapore"],
  [139.6917, 35.6895, "Tokyo"],
  [-0.1278, 51.5074, "London"],
  [-74.006, 40.7128, "New York"],
  [-122.4194, 37.7749, "San Francisco"],
  [151.2093, -33.8688, "Sydney"],
  [55.2708, 25.2048, "Dubai"],
];

export default function RotatingEarth({
  width = 600,
  height = 540,
  className = "",
  themeColor = "peach-pink",
}: RotatingEarthProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const parentW = canvas.parentElement?.clientWidth || window.innerWidth;
    const w = Math.min(width, parentW, window.innerWidth - 32);
    const h = Math.min(height, Math.max(340, w * (height / width)));
    const initialScale = Math.min(w, h) / 2.35;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    const projection = d3
      .geoOrthographic()
      .scale(initialScale)
      .translate([w / 2, h / 2])
      .clipAngle(90);

    const path = d3.geoPath().projection(projection).context(ctx);

    const controller = new AbortController();
    let disposed = false;
    const graticule = d3.geoGraticule10();
    let worldData: GeoJSON.FeatureCollection | null = null;
    const dotGroups = new Map<string, [number, number][]>();

    const render = () => {
      // Clear entire canvas — completely transparent, zero outer glow
      ctx.clearRect(0, 0, w, h);
      const currentScale = projection.scale();
      const scaleFactor = currentScale / initialScale;

      // --- 1. Clean Crisp Sphere Base (NO outer glow, sharp boundary) ---
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, currentScale, 0, 2 * Math.PI);

      if (themeColor === "peach-pink") {
        ctx.fillStyle = "rgba(255, 248, 245, 0.75)"; // clean subtle peach cream fill
      } else if (themeColor === "dark") {
        ctx.fillStyle = "#0f172a";
      } else {
        ctx.fillStyle = "rgba(248, 250, 252, 0.75)";
      }
      ctx.fill();

      // Sharp, clean rim outline
      ctx.strokeStyle =
        themeColor === "peach-pink"
          ? "rgba(251, 113, 133, 0.45)" // clean soft coral-pink rim
          : "rgba(99, 102, 241, 0.35)";
      ctx.lineWidth = 1.4 * scaleFactor;
      ctx.stroke();

      if (worldData) {
        // --- 2. Clean Graticule Lat/Long Grid (NO glow) ---
        ctx.beginPath();
        path(graticule);
        ctx.strokeStyle =
          themeColor === "peach-pink"
            ? "rgba(251, 146, 60, 0.22)" // crisp warm peach line
            : "rgba(99, 102, 241, 0.18)";
        ctx.lineWidth = 0.9 * scaleFactor;
        ctx.stroke();

        // --- 3. Clean Coastlines / Land Contours ---
        ctx.beginPath();
        worldData.features.forEach((feat) => {
          path(feat);
        });
        ctx.strokeStyle =
          themeColor === "peach-pink"
            ? "rgba(244, 63, 94, 0.38)" // clean soft rose contour
            : "rgba(79, 70, 229, 0.35)";
        ctx.lineWidth = 1.0 * scaleFactor;
        ctx.stroke();

        // --- 4. Sharp Land Surface Dots (Peach, Coral & Soft Pink) ---
        const center = projection.invert?.([w / 2, h / 2]);
        const visible = (point: [number, number]) => !!center && d3.geoDistance(point, center) < Math.PI / 2;
        for (const [color, points] of dotGroups) {
          ctx.beginPath();
          const radius = 1.25 * scaleFactor;
          for (const point of points) {
            if (!visible(point)) continue;
            const coord = projection(point);
            if (!coord) continue;
            ctx.moveTo(coord[0] + radius, coord[1]);
            ctx.arc(coord[0], coord[1], radius, 0, 2 * Math.PI);
          }
          ctx.fillStyle = color;
          ctx.fill();
        }

        // --- 5. Clean Global Hub Indicators (Sharp vector points, no fuzzy glow) ---
        GLOBAL_HUBS.forEach(([lng, lat]) => {
          if (!visible([lng, lat])) return;
          const coord = projection([lng, lat]);
          if (
            coord &&
            coord[0] >= 0 &&
            coord[0] <= w &&
            coord[1] >= 0 &&
            coord[1] <= h
          ) {
            // Clean outer ring
            ctx.beginPath();
            ctx.arc(coord[0], coord[1], 4.2 * scaleFactor, 0, 2 * Math.PI);
            ctx.strokeStyle =
              themeColor === "peach-pink"
                ? "rgba(244, 63, 94, 0.55)"
                : "rgba(79, 70, 229, 0.5)";
            ctx.lineWidth = 1.1;
            ctx.stroke();

            // Clean solid center dot
            ctx.beginPath();
            ctx.arc(coord[0], coord[1], 2.2 * scaleFactor, 0, 2 * Math.PI);
            ctx.fillStyle =
              themeColor === "peach-pink" ? "#f43f5e" : "#6366f1";
            ctx.fill();
          }
        });
      }
    };

    const loadWorldData = async () => {
      try {
        const response = await fetch('/data/hero-globe.json', { signal: controller.signal });
        if (!response.ok) throw new Error('Failed to load land data');
        const data: GeoJSON.FeatureCollection & { dots: [number, number][] } = await response.json();
        if (disposed) return;
        worldData = data;
        for (const point of data.dots) {
          const latitude = Math.abs(point[1]);
          const color = themeColor === 'peach-pink'
            ? latitude < 20 ? '#fb923c' : latitude < 45 ? '#f43f5e' : '#fb7185'
            : '#4f46e5';
          const group = dotGroups.get(color) ?? [];
          group.push(point);
          dotGroups.set(color, group);
        }
        render();
        canvas.dataset.ready = 'true';
      } catch {
        if (!disposed) setError('Failed to load land map data');
      }
    };

    const rotation = [-105, -10];
    projection.rotate(rotation as [number, number]);
    let isAutoRotating = true;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let inView = true;
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; syncAnimation(); });
    observer.observe(canvas);
    let frame = 0;
    let lastFrame = 0;
    const tick = (now: number) => {
      frame = 0;
      if (disposed || !inView || document.hidden || reducedMotion.matches) return;
      const delta = now - lastFrame;
      if (delta >= 1000 / 30) {
        if (isAutoRotating) {
          rotation[0] += Math.min(delta, 50) * 0.006;
          projection.rotate(rotation as [number, number]);
          render();
        }
        lastFrame = now;
      }
      frame = requestAnimationFrame(tick);
    };
    const syncAnimation = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      lastFrame = performance.now();
      if (inView && !document.hidden && !reducedMotion.matches) frame = requestAnimationFrame(tick);
    };
    document.addEventListener('visibilitychange', syncAnimation);
    reducedMotion.addEventListener('change', syncAnimation);
    syncAnimation();

    let drag: { x: number; y: number; rotation: number[] } | null = null;
    const handlePointerDown = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0) return;
      drag = { x: event.clientX, y: event.clientY, rotation: [...rotation] };
      isAutoRotating = false;
      canvas.setPointerCapture(event.pointerId);
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (!drag) return;
      rotation[0] = drag.rotation[0] + (event.clientX - drag.x) * 0.5;
      rotation[1] = Math.max(-90, Math.min(90, drag.rotation[1] - (event.clientY - drag.y) * 0.5));
      projection.rotate(rotation as [number, number]);
      render();
    };
    const handlePointerEnd = () => { drag = null; isAutoRotating = true; };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(
        initialScale * 0.5,
        Math.min(initialScale * 3, projection.scale() * zoomFactor)
      );
      projection.scale(newScale);
      render();
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerEnd);
    canvas.addEventListener('pointercancel', handlePointerEnd);
    canvas.addEventListener('lostpointercapture', handlePointerEnd);
    canvas.addEventListener("wheel", handleWheel, { passive: false });

    render();
    loadWorldData();

    return () => {
      disposed = true;
      controller.abort();
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', syncAnimation);
      reducedMotion.removeEventListener('change', syncAnimation);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerEnd);
      canvas.removeEventListener('pointercancel', handlePointerEnd);
      canvas.removeEventListener('lostpointercapture', handlePointerEnd);
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, [width, height, themeColor]);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-white rounded-2xl p-8 border border-rose-200 shadow-sm ${className}`}
      >
        <div className="text-center">
          <p className="text-rose-600 font-semibold mb-2">
            Error loading Earth visualization
          </p>
          <p className="text-slate-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative flex items-center justify-center select-none ${className}`}
      style={{ background: "transparent" }}
    >
      <canvas
        ref={canvasRef}
        className="cursor-grab active:cursor-grabbing transition-transform duration-200"
        style={{
          touchAction: "pan-y",
          maxWidth: "100%",
          height: "auto",
          display: "block",
          background: "transparent",
          // Strictly NO glow or drop shadow
          filter: "none",
        }}
      />
    </div>
  );
}
