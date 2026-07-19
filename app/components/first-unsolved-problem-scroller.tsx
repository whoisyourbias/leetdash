"use client";

import { useEffect } from "react";

export function FirstUnsolvedProblemScroller({ targetId }: { targetId: string }) {
  useEffect(() => {
    if (window.location.hash !== `#${targetId}`) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      const target = document.getElementById(targetId);
      if (!target) {
        return;
      }

      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "center",
        inline: "nearest",
      });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [targetId]);

  return null;
}
