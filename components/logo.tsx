"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Life OS brand mark: a gradient rounded-square badge containing an orbit ring
 * with an upward "growth" line whose endpoint lands exactly on the ring —
 * system + momentum + progress. Self-contained SVG (no external assets).
 */
export function Logo({
  size = 36,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const id = useId();
  const grad = `logoGrad-${id}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="Life OS"
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient
          id={grad}
          x1="0"
          y1="0"
          x2="48"
          y2="48"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#e879f9" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill={`url(#${grad})`} />
      {/* orbit ring */}
      <circle
        cx="24"
        cy="24"
        r="12.5"
        stroke="white"
        strokeWidth="2.6"
        opacity="0.85"
        fill="none"
      />
      {/* upward growth line — ends exactly on the ring */}
      <path
        d="M14 30 L20.5 23 L25.5 27 L34 16.5"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* current-point node, sitting on the ring */}
      <circle cx="34" cy="16.5" r="2.9" fill="white" />
    </svg>
  );
}
