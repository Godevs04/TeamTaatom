"use client";

import * as React from "react";
import { useInView, useMotionValue, useSpring } from "framer-motion";

export function useAnimatedCounter(target: number, enabled = true) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 60, damping: 24 });

  React.useEffect(() => {
    if (inView && enabled) motionVal.set(target);
  }, [inView, target, enabled, motionVal]);

  React.useEffect(() => {
    const unsub = spring.on("change", (v) => {
      if (ref.current) {
        ref.current.textContent = Math.round(v).toLocaleString() + "+";
      }
    });
    return unsub;
  }, [spring]);

  return ref;
}
