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
  const [, setLoading] = useState(true);
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
    const dpr = window.devicePixelRatio || 1;

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

    const pointInPolygon = (point: [number, number], polygon: number[][]) => {
      const [x, y] = point;
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i];
        const [xj, yj] = polygon[j];
        if (
          yi > y !== yj > y &&
          x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
        ) {
          inside = !inside;
        }
      }
      return inside;
    };

    const pointInFeature = (point: [number, number], feature: any) => {
      const geom = feature.geometry;
      if (geom.type === "Polygon") {
        const coords = geom.coordinates;
        if (!pointInPolygon(point, coords[0])) return false;
        for (let i = 1; i < coords.length; i++) {
          if (pointInPolygon(point, coords[i])) return false;
        }
        return true;
      } else if (geom.type === "MultiPolygon") {
        for (const coords of geom.coordinates) {
          if (pointInPolygon(point, coords[0])) {
            let inHole = false;
            for (let i = 1; i < coords.length; i++) {
              if (pointInPolygon(point, coords[i])) {
                inHole = true;
                break;
              }
            }
            if (!inHole) return true;
          }
        }
        return false;
      }
      return false;
    };

    const generateDotsInPolygon = (feature: any, density = 16) => {
      const points: [number, number][] = [];
      const bounds = d3.geoBounds(feature);
      const [[minLng, minLat], [maxLng, maxLat]] = bounds;
      const step = density * 0.08;
      for (let lng = minLng; lng <= maxLng; lng += step) {
        for (let lat = minLat; lat <= maxLat; lat += step) {
          const pt: [number, number] = [lng, lat];
          if (pointInFeature(pt, feature)) {
            points.push(pt);
          }
        }
      }
      return points;
    };

    const dots: { lng: number; lat: number; visible: boolean; color: string }[] = [];
    let worldData: any = null;

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
        const graticule = d3.geoGraticule10();
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
        worldData.features.forEach((feat: any) => {
          path(feat);
        });
        ctx.strokeStyle =
          themeColor === "peach-pink"
            ? "rgba(244, 63, 94, 0.38)" // clean soft rose contour
            : "rgba(79, 70, 229, 0.35)";
        ctx.lineWidth = 1.0 * scaleFactor;
        ctx.stroke();

        // --- 4. Sharp Land Surface Dots (Peach, Coral & Soft Pink) ---
        dots.forEach((dot) => {
          const coord = projection([dot.lng, dot.lat]);
          if (
            coord &&
            coord[0] >= 0 &&
            coord[0] <= w &&
            coord[1] >= 0 &&
            coord[1] <= h
          ) {
            ctx.beginPath();
            ctx.arc(coord[0], coord[1], 1.25 * scaleFactor, 0, 2 * Math.PI);
            ctx.fillStyle = dot.color;
            ctx.fill();
          }
        });

        // --- 5. Clean Global Hub Indicators (Sharp vector points, no fuzzy glow) ---
        GLOBAL_HUBS.forEach(([lng, lat]) => {
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
        setLoading(true);
        let res: Response;
        try {
          res = await fetch("/data/ne_110m_land.json");
          if (!res.ok) throw new Error("Local fallback");
        } catch {
          res = await fetch(
            "https://raw.githubusercontent.com/martynafford/natural-earth-geojson/refs/heads/master/110m/physical/ne_110m_land.json"
          );
        }
        if (!res.ok) throw new Error("Failed to load land data");
        worldData = await res.json();

        // Assign harmonic peach / soft-pink / coral colors to dots
        worldData.features.forEach((feat: any) => {
          generateDotsInPolygon(feat, 16).forEach(([lng, lat]) => {
            let dotColor = "#fb7185";
            if (themeColor === "peach-pink") {
              const absLat = Math.abs(lat);
              if (absLat < 20) {
                dotColor = "#fb923c"; // warm peach
              } else if (absLat < 45) {
                dotColor = "#f43f5e"; // vibrant coral rose
              } else {
                dotColor = "#fb7185"; // soft blush pink
              }
            } else {
              dotColor = "#4f46e5";
            }
            dots.push({ lng, lat, visible: true, color: dotColor });
          });
        });

        render();
        setLoading(false);
      } catch {
        setError("Failed to load land map data");
        setLoading(false);
      }
    };

    const rotation = [0, 0];
    let isAutoRotating = true;
    const rotationSpeed = 0.45;

    const timer = d3.timer(() => {
      if (isAutoRotating) {
        rotation[0] += rotationSpeed;
        projection.rotate(rotation as [number, number]);
      }
      render();
    });

    const handleMouseDown = (e: MouseEvent) => {
      isAutoRotating = false;
      const startX = e.clientX;
      const startY = e.clientY;
      const startRot = [...rotation];

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        rotation[0] = startRot[0] + dx * 0.5;
        rotation[1] = startRot[1] - dy * 0.5;
        rotation[1] = Math.max(-90, Math.min(90, rotation[1]));
        projection.rotate(rotation as [number, number]);
        render();
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        setTimeout(() => {
          isAutoRotating = true;
        }, 10);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      isAutoRotating = false;
      const touch = e.touches[0];
      const startX = touch.clientX;
      const startY = touch.clientY;
      const startRot = [...rotation];

      const handleTouchMove = (moveEvent: TouchEvent) => {
        if (moveEvent.touches.length !== 1) return;
        const moveTouch = moveEvent.touches[0];
        const dx = moveTouch.clientX - startX;
        const dy = moveTouch.clientY - startY;
        rotation[0] = startRot[0] + dx * 0.5;
        rotation[1] = startRot[1] - dy * 0.5;
        rotation[1] = Math.max(-90, Math.min(90, rotation[1]));
        projection.rotate(rotation as [number, number]);
        render();
      };

      const handleTouchEnd = () => {
        document.removeEventListener("touchmove", handleTouchMove);
        document.removeEventListener("touchend", handleTouchEnd);
        setTimeout(() => {
          isAutoRotating = true;
        }, 10);
      };

      document.addEventListener("touchmove", handleTouchMove, {
        passive: true,
      });
      document.addEventListener("touchend", handleTouchEnd);
    };

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

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("touchstart", handleTouchStart, { passive: true });
    canvas.addEventListener("wheel", handleWheel, { passive: false });

    loadWorldData();

    return () => {
      timer.stop();
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("touchstart", handleTouchStart);
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
