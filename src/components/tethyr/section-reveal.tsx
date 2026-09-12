import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Reveals a landing section with a subtle fade + rise once it scrolls into view.
 * Reduced-motion users get the content immediately with no transform.
 */
export function SectionReveal({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return (
      <div id={id} className={`scroll-mt-20 ${className ?? ""}`}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      id={id}
      className={`scroll-mt-20 ${className ?? ""}`}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
