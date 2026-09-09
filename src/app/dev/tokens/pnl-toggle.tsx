"use client";

import { useState } from "react";

/** Dev-only control: flips settings.pnl_convention at runtime by toggling
 * [data-pnl] on <html>, the same mechanism Settings will drive in-app. */
export function PnlToggle() {
  const [convention, setConvention] = useState<"kr" | "west">("kr");

  function set(next: "kr" | "west") {
    setConvention(next);
    document.documentElement.dataset.pnl = next === "west" ? "west" : "";
  }

  return (
    <div className="inline-flex gap-8 rounded-12 bg-divider p-4">
      {(["kr", "west"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => set(mode)}
          className={
            "rounded-8 px-14 py-8 text-13 font-semibold transition-colors " +
            (convention === mode
              ? "bg-accent-tint text-accent-pressed"
              : "text-muted hover:text-secondary")
          }
        >
          {mode === "kr" ? "KR (red up / blue down)" : "West (green up / red down)"}
        </button>
      ))}
    </div>
  );
}
