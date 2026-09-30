"use client";

import { useEffect, useRef } from "react";
import { Flashlight as FlashlightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { stopFlashlight } from "./controller";
import { COPY } from "./copy";
import { useStage } from "./stage-store";

/**
 * "Licht aus": the page goes dark except for a circle of light that follows
 * the pointer or the finger.
 *
 * It never takes the game away: the dark layer catches no pointer, so the
 * input stays usable, the way back is a visible button plus Escape, and the
 * lights come back on by themselves after half a minute (`FLASHLIGHT_MS`).
 * The spot is moved through two custom properties written straight to the
 * element, one write per frame at most, so following the pointer never
 * re-renders React.
 */
export default function Flashlight() {
  const { flashlight } = useStage();
  const layerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!flashlight) return;
    let raf = 0;
    let px = window.innerWidth / 2;
    let py = window.innerHeight * 0.4;

    const paint = () => {
      raf = 0;
      const layer = layerRef.current;
      if (!layer) return;
      layer.style.setProperty("--fx", `${px}px`);
      layer.style.setProperty("--fy", `${py}px`);
    };
    const move = (x: number, y: number) => {
      px = x;
      py = y;
      if (!raf) raf = requestAnimationFrame(paint);
    };
    const onPointer = (e: PointerEvent) => move(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) move(touch.clientX, touch.clientY);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stopFlashlight();
    };

    paint();
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("keydown", onKey);
    };
  }, [flashlight]);

  if (!flashlight) return null;
  return (
    <>
      <div ref={layerRef} className="spook-flashlight" aria-hidden="true" />
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[46] flex justify-center sm:bottom-8">
        <Button type="button" onClick={stopFlashlight} className="pointer-events-auto gap-2">
          <FlashlightIcon className="h-4 w-4" aria-hidden="true" />
          {COPY.flashlightOff}
        </Button>
      </div>
    </>
  );
}
