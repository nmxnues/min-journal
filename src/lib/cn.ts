import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge has to be taught this project's custom scales.
 *
 * Our type scale is keyed by px number (`text-13`, `text-11_5`), which collides
 * with Tailwind's text-*colour* namespace: out of the box tailwind-merge reads
 * `text-13` as a colour and silently drops an earlier `text-white`, so
 * `bg-ink text-white ... text-13` renders black-on-black. Same story for the
 * px-named radius scale, which otherwise never dedupes.
 */
const FONT_SIZES = [
  "11", "11_5", "12", "12_5", "13", "13_5", "14", "14_5", "15", "15_5",
  "16", "17", "18", "20", "22", "24", "26", "30", "34", "40", "44", "52", "56",
];

const RADII = ["8", "10", "12", "14", "16", "18", "20", "22", "24", "pill"];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: FONT_SIZES }],
      rounded: [{ rounded: RADII }],
    },
  },
});

/**
 * Join class names, letting a caller's `className` actually win over a
 * component's defaults (plain concatenation can't — CSS order decides, not
 * string order).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
