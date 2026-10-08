/**
 * CountUp — Animated number counter triggered by IntersectionObserver.
 * Uses requestAnimationFrame for smooth counting. No dependencies beyond React.
 * Respects prefers-reduced-motion.
 */
import { useRef, useEffect, useState, type CSSProperties } from "react";

interface CountUpProps {
  /** Target number to count up to */
  to: number;
  /** Starting number */
  from?: number;
  /** Duration of count animation in ms */
  duration?: number;
  /** Delay before starting (ms) — useful for staggering multiple CountUps */
  delay?: number;
  /** Decimal places */
  decimals?: number;
  /** Prefix e.g. "$", "+" */
  prefix?: string;
  /** Suffix e.g. "%", "K", "+" */
  suffix?: string;
  /** Separator for thousands e.g. "," */
  separator?: string;
  /** IntersectionObserver threshold */
  threshold?: number;
  /** Only animate once */
  once?: boolean;
  style?: CSSProperties;
  className?: string;
}

function formatNumber(n: number, decimals: number, separator: string): string {
  const fixed = n.toFixed(decimals);
  if (!separator) return fixed;
  const [int, dec] = fixed.split(".");
  const formatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  return dec !== undefined ? `${formatted}.${dec}` : formatted;
}

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export default function CountUp({
  to,
  from = 0,
  duration = 1800,
  delay = 0,
  decimals = 0,
  prefix = "",
  suffix = "",
  separator = ",",
  threshold = 0.2,
  once = true,
  style,
  className,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(from);
  const [triggered, setTriggered] = useState(false);

  // Respect prefers-reduced-motion
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !triggered) {
          setTriggered(true);
          if (once) observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, once, triggered]);

  useEffect(() => {
    if (!triggered) return;

    if (prefersReduced) {
      setValue(to);
      return;
    }

    let raf: number;
    const startTime = performance.now() + delay;

    function tick(now: number) {
      if (now < startTime) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutExpo(progress);
      setValue(from + (to - from) * eased);
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setValue(to);
      }
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [triggered, to, from, duration, delay, prefersReduced]);

  return (
    <span ref={ref} className={className} style={style}>
      {prefix}
      {formatNumber(value, decimals, separator)}
      {suffix}
    </span>
  );
}
