import type { ReactNode } from "react";
import { PnlToggle } from "./pnl-toggle";

const surfaceColors = [
  { name: "page", cls: "bg-page", hex: "#f4f5f7", border: true },
  { name: "surface", cls: "bg-surface", hex: "#ffffff", border: true },
  { name: "surface-subtle", cls: "bg-surface-subtle", hex: "#f9fafb", border: true },
  { name: "surface-faint", cls: "bg-surface-faint", hex: "#fafbfc", border: true },
];

const textColors = [
  { name: "ink", cls: "bg-ink", hex: "#191f28" },
  { name: "body", cls: "bg-body", hex: "#333d4b" },
  { name: "secondary", cls: "bg-secondary", hex: "#4e5968" },
  { name: "muted", cls: "bg-muted", hex: "#8b95a1" },
  { name: "faint", cls: "bg-faint", hex: "#b0b8c1" },
  { name: "disabled", cls: "bg-disabled", hex: "#d1d6db" },
];

const lineColors = [
  { name: "divider", cls: "bg-divider", hex: "#f2f4f6", border: true },
  { name: "border", cls: "bg-border", hex: "#dde1e6", border: true },
  { name: "panel", cls: "bg-panel", hex: "#eef1f4", border: true },
];

const accentColors = [
  { name: "accent", cls: "bg-accent", hex: "#3182f6" },
  { name: "accent-pressed", cls: "bg-accent-pressed", hex: "#1b64da" },
  { name: "accent-tint", cls: "bg-accent-tint", hex: "#e8f3ff", border: true },
];

const pnlColors = [
  { name: "gain", cls: "bg-gain", hex: "var(--pnl-gain)" },
  { name: "gain-tint-1", cls: "bg-gain-tint-1", hex: "var(--pnl-gain-tint-1)", border: true },
  { name: "gain-tint-2", cls: "bg-gain-tint-2", hex: "var(--pnl-gain-tint-2)", border: true },
  { name: "gain-tint-3", cls: "bg-gain-tint-3", hex: "var(--pnl-gain-tint-3)", border: true },
  { name: "gain-deep-1", cls: "bg-gain-deep-1", hex: "var(--pnl-gain-deep-1)" },
  { name: "gain-deep-2", cls: "bg-gain-deep-2", hex: "var(--pnl-gain-deep-2)" },
  { name: "loss", cls: "bg-loss", hex: "var(--pnl-loss)" },
  { name: "loss-tint", cls: "bg-loss-tint", hex: "var(--pnl-loss-tint)", border: true },
];

const typeScale: { size: string; weight: 500 | 600 | 700 | 800; role: string }[] = [
  { size: "text-56", weight: 800, role: "Dashboard hero value" },
  { size: "text-44", weight: 800, role: "Mobile hero value" },
  { size: "text-30", weight: 800, role: "Phase-0 page title" },
  { size: "text-26", weight: 800, role: "Summary stat value" },
  { size: "text-24", weight: 800, role: "Quick-log question" },
  { size: "text-22", weight: 800, role: "Range size / result R" },
  { size: "text-20", weight: 800, role: "R:R callout value" },
  { size: "text-18", weight: 800, role: "Sweep side value" },
  { size: "text-17", weight: 700, role: "Header title" },
  { size: "text-16", weight: 700, role: "Section title" },
  { size: "text-15_5", weight: 600, role: "Quick-log option text" },
  { size: "text-15", weight: 600, role: "Field value" },
  { size: "text-14_5", weight: 500, role: "Notes textarea" },
  { size: "text-14", weight: 600, role: "Nav item / body" },
  { size: "text-13_5", weight: 600, role: "Segmented option" },
  { size: "text-13", weight: 600, role: "Label" },
  { size: "text-12_5", weight: 600, role: "Chip text" },
  { size: "text-12", weight: 600, role: "Session tile label" },
  { size: "text-11_5", weight: 500, role: "Caption" },
  { size: "text-11", weight: 500, role: "Axis caption" },
];

const radii = [
  { name: "radius-8", cls: "rounded-8", role: "small tags" },
  { name: "radius-10", cls: "rounded-10", role: "nav pill" },
  { name: "radius-12", cls: "rounded-12", role: "buttons" },
  { name: "radius-14", cls: "rounded-14", role: "form fields" },
  { name: "radius-16", cls: "rounded-16", role: "tiles" },
  { name: "radius-18", cls: "rounded-18", role: "quick-log rows" },
  { name: "radius-20", cls: "rounded-20", role: "panels" },
  { name: "radius-22", cls: "rounded-22", role: "summary cards" },
  { name: "radius-24", cls: "rounded-24", role: "top-level cards" },
  { name: "radius-pill", cls: "rounded-pill", role: "pills / bars" },
];

const spacing = [4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 40];

function Swatch({ name, cls, hex, border }: { name: string; cls: string; hex: string; border?: boolean }) {
  return (
    <div className="flex flex-col gap-8">
      <div
        className={`h-56 rounded-12 ${cls} ${border ? "border border-border" : ""}`}
        style={hex.startsWith("var(") ? { background: hex } : undefined}
      />
      <div>
        <p className="text-13 font-semibold text-ink">{name}</p>
        <p className="text-11_5 text-faint">{hex}</p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-24 bg-surface p-32">
      <h2 className="text-16 font-bold tracking-[-.02em] text-ink">{title}</h2>
      <div className="mt-20">{children}</div>
    </section>
  );
}

export default function TokensPage() {
  return (
    <main className="min-h-full bg-page p-32">
      <div className="mx-auto flex max-w-[1000px] flex-col gap-16">
        <header>
          <h1 className="text-24 font-extrabold tracking-[-.03em] text-ink">Design tokens</h1>
          <p className="mt-6 text-13_5 text-secondary">
            Source: <code className="text-12_5">docs/README.md</code> § Design Tokens. Dev-only route, not part of the app nav.
          </p>
        </header>

        <Section title="P&L convention (settings.pnl_convention)">
          <PnlToggle />
          <p className="mt-12 text-11_5 text-faint">
            Toggling flips <code>--pnl-gain</code> / <code>--pnl-loss</code> on <code>&lt;html data-pnl&gt;</code> — every swatch
            and sample below reads the live variables.
          </p>
        </Section>

        <Section title="Surface">
          <div className="grid grid-cols-4 gap-16">
            {surfaceColors.map((c) => (
              <Swatch key={c.name} {...c} />
            ))}
          </div>
        </Section>

        <Section title="Text / ink">
          <div className="grid grid-cols-6 gap-16">
            {textColors.map((c) => (
              <Swatch key={c.name} {...c} />
            ))}
          </div>
        </Section>

        <Section title="Lines / panels">
          <div className="grid grid-cols-3 gap-16">
            {lineColors.map((c) => (
              <Swatch key={c.name} {...c} />
            ))}
          </div>
        </Section>

        <Section title="Accent (buttons + selection only)">
          <div className="grid grid-cols-3 gap-16">
            {accentColors.map((c) => (
              <Swatch key={c.name} {...c} />
            ))}
          </div>
        </Section>

        <Section title="P&L (live — respects the toggle above)">
          <div className="grid grid-cols-4 gap-16">
            {pnlColors.map((c) => (
              <Swatch key={c.name} {...c} />
            ))}
          </div>
        </Section>

        <Section title="Typography — Pretendard Variable">
          <div className="flex flex-col gap-16">
            {typeScale.map((t) => (
              <div key={t.size + t.weight} className="flex items-baseline gap-16 border-b border-divider pb-16 last:border-0 last:pb-0">
                <span className="w-[90px] shrink-0 text-11_5 text-faint">
                  {t.size.replace("text-", "").replace("_", ".")}px / {t.weight}
                </span>
                <span
                  className={`${t.size} truncate text-ink`}
                  style={{ fontWeight: t.weight }}
                >
                  Min Journal · +18.4R
                </span>
                <span className="ml-auto shrink-0 text-11_5 text-faint">{t.role}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Radius">
          <div className="grid grid-cols-5 gap-16">
            {radii.map((r) => (
              <div key={r.name} className="flex flex-col gap-8">
                <div className={`h-64 bg-panel ${r.cls}`} />
                <div>
                  <p className="text-13 font-semibold text-ink">{r.name}</p>
                  <p className="text-11_5 text-faint">{r.role}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Spacing (--spacing redefined to 1px — bare numbers are literal px)">
          <div className="flex flex-col gap-8">
            {spacing.map((s) => (
              <div key={s} className="flex items-center gap-12">
                <span className="w-32 shrink-0 text-11_5 text-faint">{s}px</span>
                <div className="h-14 rounded-8 bg-accent-tint" style={{ width: `${s * 4}px` }} />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Elevation">
          <div className="flex gap-24">
            <div className="flex flex-col gap-8">
              <div className="h-64 w-[160px] rounded-24 bg-surface" style={{ boxShadow: "var(--shadow-canvas-ref)" }} />
              <p className="text-11_5 text-faint">canvas-ref (reference only, not used in-app)</p>
            </div>
            <div className="flex flex-col gap-8">
              <div className="h-64 w-[160px] rounded-24 bg-surface" style={{ boxShadow: "var(--shadow-sheet)" }} />
              <p className="text-11_5 text-faint">sheet (modals / sheets)</p>
            </div>
          </div>
        </Section>
      </div>
    </main>
  );
}
