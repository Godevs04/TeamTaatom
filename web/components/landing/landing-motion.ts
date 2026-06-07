import type { Variants } from "framer-motion";

export const landingEase = [0.22, 1, 0.36, 1] as const;

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.05 },
  },
};

export const fadeUpItem: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: landingEase } },
};

export const fadeSlideItem: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: landingEase } },
};

export const fadeSlideRightItem: Variants = {
  hidden: { opacity: 0, x: 24, y: 12 },
  show: { opacity: 1, x: 0, y: 0, transition: { duration: 0.85, ease: landingEase, delay: 0.12 } },
};

export const hoverLift = {
  y: -8,
  transition: { type: "spring" as const, stiffness: 380, damping: 28 },
};

export const imageHoverScale = {
  scale: 1.03,
  transition: { duration: 0.55, ease: landingEase },
};
