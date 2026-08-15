"use client";

import { m, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

type Tag = "div" | "section" | "li" | "ul";
const MOTION_TAG = { div: m.div, section: m.section, li: m.li, ul: m.ul } as const;

/**
 * Subtle scroll-in fade/slide for content sections, SEO-safe by design.
 *
 * - The server-rendered HTML contains NO `opacity:0`: content is fully visible
 *   without JavaScript and for crawlers/AI bots that don't run JS.
 * - Only elements that start *below the fold* get the hidden→visible animation
 *   (decided on mount via the bounding rect), so on-screen content never flashes.
 * - `prefers-reduced-motion` disables the animation entirely.
 *
 * Animates only `opacity` + `transform` → compositor-friendly, zero layout shift.
 */
export default function Reveal({
  children,
  className,
  as = "div",
  delay = 0,
  y = 16,
}: {
  children: ReactNode;
  className?: string;
  as?: Tag;
  delay?: number;
  y?: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (reduce) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const inView = rect.top < window.innerHeight * 0.9 && rect.bottom > 0;
    if (!inView) setAnimate(true);
  }, [reduce]);

  // The tag union widens the ref/props type; the cast keeps a single concrete
  // element type. At runtime the correct element is still rendered.
  const MotionTag = MOTION_TAG[as] as typeof m.div;

  if (!animate) {
    // SSR, no-JS, reduced motion, or already-in-view on mount → static & visible.
    return (
      <MotionTag ref={ref} className={className}>
        {children}
      </MotionTag>
    );
  }

  return (
    <MotionTag
      ref={ref}
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
    >
      {children}
    </MotionTag>
  );
}
