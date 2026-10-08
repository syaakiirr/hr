import { useEffect, useRef, useCallback } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  wobble: number;
  wobbleSpeed: number;
  alpha: number;
}

interface ConfettiProps {
  /** Trigger confetti when true */
  trigger?: boolean;
  /** Duration of particle lifecycle in ms */
  duration?: number;
  /** Palette of particle colors */
  colors?: string[];
  /** Number of particles per burst */
  particleCount?: number;
  /** Callback when animation completes */
  onComplete?: () => void;
}

const DEFAULT_COLORS = ["#f59e0b", "#e11d48", "#6366f1", "#10b981", "#3b82f6", "#8b5cf6", "#fbbf24"];

export default function Confetti({
  trigger = false,
  duration = 3000,
  colors = DEFAULT_COLORS,
  particleCount = 65,
  onComplete,
}: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  const fire = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Match devicePixelRatio for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const particles: Particle[] = [];
    const originX = width / 2;
    const originY = height * 0.35;

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5);
      const speed = 7 + Math.random() * 9;
      particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 5,
        size: 6 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
        wobble: Math.random() * 10,
        wobbleSpeed: 0.1 + Math.random() * 0.1,
        alpha: 1,
      });
    }

    const startTime = performance.now();

    function render(now: number) {
      const elapsed = now - startTime;
      const progress = elapsed / duration;

      if (progress >= 1 || !ctx) {
        ctx?.clearRect(0, 0, width, height);
        onComplete?.();
        return;
      }

      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.28; // gravity
        p.vx *= 0.985; // air resistance
        p.rotation += p.rotationSpeed;
        p.wobble += p.wobbleSpeed;
        p.alpha = Math.max(0, 1 - progress);

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });

      animationRef.current = requestAnimationFrame(render);
    }

    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = requestAnimationFrame(render);
  }, [colors, duration, particleCount, onComplete]);

  useEffect(() => {
    if (trigger) {
      fire();
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [trigger, fire]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    />
  );
}
