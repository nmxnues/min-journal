import type { ReactElement } from "react";

/**
 * One icon design, reused by every size Next.js's file-convention icon
 * routes need (`icon.tsx`, `apple-icon.tsx`) and by the two plain sizes the
 * PWA manifest wants (`icon-192.png`, `icon-512.png`) — so the mark can't
 * drift between them. Full-bleed ink tile, the wordmark's own initial in
 * white: legible at a 16px favicon and safely inside a maskable icon's
 * circular safe zone at 512px (the glyph sits at ~55% of the canvas height,
 * well clear of the ~20% Android can crop from any edge).
 */
export function AppIconMark({
  size,
  rounded = true,
}: {
  size: number;
  /** iOS applies its own squircle mask to the apple-touch-icon and expects a
   * plain full-bleed square underneath it — false there, true everywhere else. */
  rounded?: boolean;
}): ReactElement {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#191f28",
        borderRadius: rounded ? size * 0.22 : 0,
      }}
    >
      <span
        style={{
          fontSize: size * 0.56,
          fontWeight: 800,
          color: "#fff",
          letterSpacing: -1,
          lineHeight: 1,
          // Nudge up half a pixel-ish for optical centering — a capital M's
          // glyph box sits slightly high of true center in most fonts.
          transform: `translateY(${-size * 0.02}px)`,
        }}
      >
        M
      </span>
    </div>
  );
}
