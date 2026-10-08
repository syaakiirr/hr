/**
 * SplitText — ReactBits-inspired word-by-word entrance animation.
 * Uses motion/react with IntersectionObserver. No Tailwind needed.
 * Respects prefers-reduced-motion via MotionConfig in parent.
 */
import { useRef, useEffect, useState, type CSSProperties } from "react";
import { motion, type Transition } from "motion/react";

interface SplitTextProps {
  text: string;
  /** "words" | "chars" — split unit */
  splitBy?: "words" | "chars";
  delay?: number;          // stagger between units (seconds)
  duration?: number;       // per-unit duration (seconds)
  ease?: Transition["ease"];
  yOffset?: number;        // initial Y translate in px
  style?: CSSProperties;
  className?: string;
  /** Threshold 0–1 for IntersectionObserver */
  threshold?: number;
  /** Fire once only */
  once?: boolean;
}

export default function SplitText({
  text,
  splitBy = "words",
  delay = 0.04,
  duration = 0.55,
  ease = [0.22, 1, 0.36, 1] as [number, number, number, number],
  yOffset = 28,
  style,
  className,
  threshold = 0.15,
  once = true,
}: SplitTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, once]);

  const units =
    splitBy === "chars"
      ? text.split("")
      : text.split(" ");

  return (
    <span
      ref={ref}
      className={className}
      style={{
        display: "inline",
        ...style,
      }}
      aria-label={text}
    >
      {units.map((unit, i) => (
        <motion.span
          key={i}
          aria-hidden="true"
          initial={{ opacity: 0, y: yOffset }}
          animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: yOffset }}
          transition={{
            duration,
            delay: i * delay,
            ease,
          }}
          style={{
            display: "inline-block",
            /* Add non-breaking space back for word-split */
            marginRight: splitBy === "words" && i < units.length - 1 ? "0.28em" : 0,
          }}
        >
          {unit === " " ? "\u00A0" : unit}
        </motion.span>
      ))}
    </span>
  );
}
