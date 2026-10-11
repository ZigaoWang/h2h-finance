import clsx, { type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Register the custom colours, otherwise `text-muted` looks like a font size and `text-sm` would drop it.
const merge = extendTailwindMerge({
  extend: {
    theme: {
      color: ["canvas", "surface", "subtle", "line", "line-strong", "ink", "ink-2", "muted", "faint", "pending", "approved", "paid", "danger", "danger-bg", "warning-bg"],
    },
  },
});

/** Joins class names; later utilities win over earlier conflicting ones. */
export function cn(...classes: ClassValue[]) {
  return merge(clsx(classes));
}
