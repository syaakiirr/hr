import { type CSSProperties } from "react";

interface BorderBeamProps {
  /** Size/length of the beam in pixels or percentage (default: 200) */
  size?: number;
  /** Duration of one full orbit in seconds (default: 8) */
  duration?: number;
  /** Starting color of the gradient (default: "#f59e0b") */
  colorFrom?: string;
  /** Ending color of the gradient (default: "#6366f1") */
  colorTo?: string;
  /** Thickness of the beam in pixels (default: 2) */
  borderWidth?: number;
  /** Border radius to match parent (default: 16) */
  borderRadius?: number | string;
  /** Delay before animation starts in seconds */
  delay?: number;
  className?: string;
  style?: CSSProperties;
}

export default function BorderBeam({
  size = 200,
  duration = 8,
  colorFrom = "#f59e0b",
  colorTo = "#6366f1",
  borderWidth = 2,
  borderRadius = 16,
  delay = 0,
  className,
  style,
}: BorderBeamProps) {
  const radius = typeof borderRadius === "number" ? `${borderRadius}px` : borderRadius;

  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        pointerEvents: "none",
        position: "absolute",
        inset: 0,
        borderRadius: radius,
        border: `${borderWidth}px solid transparent`,
        maskImage: "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)",
        maskComposite: "exclude",
        WebkitMaskComposite: "xor",
        overflow: "hidden",
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          aspectRatio: "1",
          width: size,
          left: 0,
          top: 0,
          background: `linear-gradient(to left, ${colorFrom}, ${colorTo}, transparent)`,
          offsetPath: `rect(0 auto auto 0 round ${radius})`,
          animation: `border-beam ${duration}s linear infinite`,
          animationDelay: `${delay}s`,
        }}
      />
      <style>{`
        @keyframes border-beam {
          to {
            offset-distance: 100%;
          }
        }
      `}</style>
    </div>
  );
}
