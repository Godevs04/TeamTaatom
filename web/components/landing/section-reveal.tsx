"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { fadeUpItem, staggerContainer } from "./landing-motion";

type SectionRevealProps = {
  children: React.ReactNode;
  className?: string;
  id?: string;
};

export function SectionReveal({ children, className, id }: SectionRevealProps) {
  return (
    <motion.section
      id={id}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={staggerContainer}
      className={cn(className)}
    >
      {children}
    </motion.section>
  );
}

export function RevealItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={fadeUpItem} className={className}>
      {children}
    </motion.div>
  );
}

export { staggerContainer, fadeUpItem } from "./landing-motion";
