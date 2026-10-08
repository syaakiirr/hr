import React, { useRef, useState, useCallback, type CSSProperties, type ReactNode } from "react";

interface GlareHoverProps {
  children: ReactNode;
  /** Maximum tilt angle in degrees (default: 8) */
  maxTilt?: number;
  /** Scale on hover (default: 1.015) */
  scale?: number;
  /** Maximum opacity of the specular glare reflection (default: 0.3) */
  glareMaxOpacity?: number;
  /** Color of the glare shine (default: "rgba(255, 255, 255, 0.5)") */
  glareColor?: string;
  /** Border radius in px or CSS string (default: "16px") */
  borderRadius?: string | number;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Additional CSS class names */
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  tabIndex?: number;
  role?: string;
  title?: string;
  "aria-label"?: string;
}

export default function GlareHover({
  children,
  maxTilt = 8,
  scale = 1.015,
  glareMaxOpacity = 0.3,
  glareColor = "rgba(255, 255, 255, 0.45)",
  borderRadius = "16px",
  style,
  className,
  onClick,
  onKeyDown,
  tabIndex,
  role,
  title,
  "aria-label": ariaLabel,
}: GlareHoverProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState("perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)");
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (prefersReduced || !cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Normalised between -1 and 1
      const xPct = (mouseX / width - 0.5) * 2;
      const yPct = (mouseY / height - 0.5) * 2;

      // Calculate tilt angles (tilt around X axis based on Y pos, tilt around Y axis based on X pos)
      const rotX = -yPct * maxTilt;
      const rotY = xPct * maxTilt;

      setTransform(
        `perspective(1000px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) scale3d(${scale}, ${scale}, ${scale})`
      );

      // Glare position in percent
      setGlarePos({
        x: (mouseX / width) * 100,
        y: (mouseY / height) * 100,
        opacity: glareMaxOpacity,
      });
    },
    [maxTilt, scale, glareMaxOpacity, prefersReduced]
  );

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTransform("perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)");
    setGlarePos((prev) => ({ ...prev, opacity: 0 }));
  };

  const radiusValue = typeof borderRadius === "number" ? `${borderRadius}px` : borderRadius;

  return (
    <div
      ref={cardRef}
      className={className}
      role={role}
      tabIndex={tabIndex}
      title={title}
      aria-label={ariaLabel}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        position: "relative",
        transformStyle: "preserve-3d",
        transform,
        transition: isHovered
          ? "transform 0.1s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.2s ease"
          : "transform 0.45s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.45s ease",
        borderRadius: radiusValue,
        willChange: "transform",
        ...style,
      }}
    >
      {children}

      {/* Dynamic Specular Glare Reflection Overlay */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: radiusValue,
          pointerEvents: "none",
          opacity: glarePos.opacity,
          background: `radial-gradient(circle 220px at ${glarePos.x}% ${glarePos.y}%, ${glareColor}, transparent 80%)`,
          mixBlendMode: "overlay",
          transition: "opacity 0.25s ease",
          zIndex: 10,
        }}
      />
    </div>
  );
}
