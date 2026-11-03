import Link from "next/link";
import { Globe2 } from "lucide-react";

/**
 * Slowly rotating globe linking to the travel map — mirrors mobile
 * components/RotatingGlobe.tsx (an 8s looping rotation of the earth icon).
 */
export function RotatingGlobe({ href, size = 160 }: { href: string; size?: number }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      style={{ width: size, height: size }}
      aria-label="Open travel map"
    >
      <Globe2
        className="h-full w-full text-primary transition-transform motion-safe:animate-[spin_8s_linear_infinite] group-hover:scale-105"
        strokeWidth={1.2}
      />
    </Link>
  );
}
