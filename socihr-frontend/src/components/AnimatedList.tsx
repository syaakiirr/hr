import { Children, isValidElement, type ReactNode, type CSSProperties } from "react";
import { motion, type Variants } from "motion/react";

interface AnimatedListProps {
  children: ReactNode;
  /** Delay between each child appearance in seconds (default: 0.05) */
  stagger?: number;
  /** Initial delay before starting the list sequence in seconds (default: 0.02) */
  delay?: number;
  /** Direction from which items enter: 'up' | 'down' | 'left' | 'right' | 'fade' (default: 'up') */
  direction?: "up" | "down" | "left" | "right" | "fade";
  /** Distance in pixels to translate from (default: 12) */
  distance?: number;
  /** Additional container class */
  className?: string;
  /** Additional container inline styles */
  style?: CSSProperties;
}

export default function AnimatedList({
  children,
  stagger = 0.05,
  delay = 0.02,
  direction = "up",
  distance = 14,
  className,
  style,
}: AnimatedListProps) {
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const getOffset = () => {
    switch (direction) {
      case "up":
        return { y: distance, x: 0 };
      case "down":
        return { y: -distance, x: 0 };
      case "left":
        return { x: distance, y: 0 };
      case "right":
        return { x: -distance, y: 0 };
      case "fade":
      default:
        return { x: 0, y: 0 };
    }
  };

  const offset = getOffset();

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: prefersReduced ? 0 : stagger,
        delayChildren: prefersReduced ? 0 : delay,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: prefersReduced
      ? { opacity: 1, x: 0, y: 0 }
      : { opacity: 0, x: offset.x, y: offset.y },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: {
        duration: 0.35,
        ease: [0.25, 1, 0.5, 1],
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={className}
      style={style}
    >
      {Children.map(children, (child, idx) => {
        if (!isValidElement(child)) return child;
        return (
          <motion.div
            key={child.key ?? idx}
            variants={itemVariants}
            style={{ width: "100%" }}
          >
            {child}
          </motion.div>
        );
      })}
    </motion.div>
  );
}
