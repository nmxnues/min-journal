"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BottomTabBar } from "@/components/nav/bottom-tab-bar";
import { toNavItems, toTabItems } from "@/components/nav/routes";
import { SignOutButton } from "@/components/nav/sign-out-button";
import { TopBar } from "@/components/nav/top-bar";
import { Button, Card, Combobox, Field, Segmented } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { PnlConvention, Session, Settings } from "@/lib/domain/types";
import { formatR } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/locale-context";
import { INSTRUMENT_PRESETS } from "@/lib/instruments";
import { SESSION_LABELS, SESSION_ORDER } from "@/lib/labels";
import { signOut } from "../actions";
import { updateSettings } from "./actions";

const R_PRECISION_OPTIONS = ["0", "1", "2"] as const;

export interface SettingsViewProps {
  settings: Settings;
}

/**
 * Not mocked (docs/README.md's own open-questions list flags Settings as
 * undesigned) — built from the same card vocabulary as every other screen:
 * a Card per group, `Field`/`Combobox`/`Segmented` for the controls, a single
 * "Save" action. Like Weekly review, it isn't one of the five `NAV_ROUTES`
 * (README's Nav section only ever lists the five) — reached by a link from
 * the Dashboard rather than a sixth tab, so `TopBar`/`BottomTabBar` render
 * with no item active here either.
 */
export function SettingsView({ settings }: SettingsViewProps) {
  const t = useT();
  const locale = useLocale();
  const isMobile = locale === "ko";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [pnlConvention, setPnlConvention] = useState<PnlConvention>(settings.pnlConvention);
  const [defaultInstrument, setDefaultInstrument] = useState(settings.defaultInstrument);
  const [defaultSession, setDefaultSession] = useState<Session>(settings.defaultSession);
  const [rPrecision, setRPrecision] = useState(settings.rPrecision);
  const [tagPresets, setTagPresets] = useState(settings.tagPresets);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty =
    pnlConvention !== settings.pnlConvention ||
    defaultInstrument !== settings.defaultInstrument ||
    defaultSession !== settings.defaultSession ||
    rPrecision !== settings.rPrecision ||
    tagPresets.length !== settings.tagPresets.length ||
    tagPresets.some((tag, i) => tag !== settings.tagPresets[i]);

  function onSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateSettings({
        pnlConvention,
        defaultInstrument,
        defaultSession,
        rPrecision: String(rPrecision),
        tagPresets,
      });
      if (result.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  const topBar = (
    <TopBar
      items={toNavItems(t)}
      activeHref=""
      right={
        <>
          <Button onClick={() => router.push("/trades/new")}>{t({ en: "New trade", ko: "New trade" })}</Button>
          <SignOutButton signOutAction={signOut} />
        </>
      }
    />
  );

  const mobileHeader = (
    <div className="flex items-center justify-between px-20 pt-16 pb-8">
      <span className="text-20 font-extrabold tracking-[-.03em] text-ink">{t({ en: "Settings", ko: "설정" })}</span>
    </div>
  );

  return (
    <div className="flex min-h-full flex-col bg-page">
      {isMobile ? mobileHeader : topBar}

      <div className={cn("mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-16", isMobile ? "p-20" : "p-32")}>
        {/* P&L convention */}
        <Card className={cn(isMobile ? "px-20 py-24" : "px-28 py-26")}>
          <h2 className="text-16 font-bold tracking-[-.02em] text-ink">
            {t({ en: "P&L color", ko: "손익 색상" })}
          </h2>
          <p className="mt-6 text-13_5 leading-[1.6] text-secondary">
            {t({
              en: "Which color means a gain. This app defaults to the Korean market convention.",
              ko: "수익을 어떤 색으로 표시할지 정합니다. 기본값은 한국 시장 관행입니다.",
            })}
          </p>
          <Segmented
            className="mt-16"
            name={t({ en: "P&L color", ko: "손익 색상" })}
            value={pnlConvention}
            onChange={setPnlConvention}
            options={[
              { value: "kr", label: t({ en: "Red gain · blue loss", ko: "빨강 수익 · 파랑 손실" }) },
              { value: "west", label: t({ en: "Green gain · red loss", ko: "초록 수익 · 빨강 손실" }) },
            ]}
          />
          <div className="mt-14 flex gap-8">
            <PreviewChip convention={pnlConvention} sign="gain" />
            <PreviewChip convention={pnlConvention} sign="loss" />
          </div>
        </Card>

        {/* Trade defaults */}
        <Card className={cn(isMobile ? "px-20 py-24" : "px-28 py-26")}>
          <h2 className="text-16 font-bold tracking-[-.02em] text-ink">
            {t({ en: "New trade defaults", ko: "새 트레이드 기본값" })}
          </h2>
          <p className="mt-6 text-13_5 leading-[1.6] text-secondary">
            {t({
              en: "What the New trade form starts with — change either field per trade as usual.",
              ko: "New trade 폼이 시작할 값입니다 — 트레이드마다 얼마든지 바꿀 수 있습니다.",
            })}
          </p>
          <div className={cn("mt-16 grid gap-16", isMobile ? "grid-cols-1" : "grid-cols-2")}>
            <Field label={t({ en: "Instrument", ko: "종목" })} htmlFor="settings-instrument">
              <Combobox
                id="settings-instrument"
                value={defaultInstrument}
                onChange={setDefaultInstrument}
                options={INSTRUMENT_PRESETS}
              />
            </Field>
            <Field label={t({ en: "Session", ko: "세션" })}>
              <Segmented
                name={t({ en: "Session", ko: "세션" })}
                value={defaultSession}
                onChange={setDefaultSession}
                options={SESSION_ORDER.map((session) => ({ value: session, label: t(SESSION_LABELS[session]) }))}
              />
            </Field>
          </div>
        </Card>

        {/* R display precision */}
        <Card className={cn(isMobile ? "px-20 py-24" : "px-28 py-26")}>
          <h2 className="text-16 font-bold tracking-[-.02em] text-ink">
            {t({ en: "R display precision", ko: "R 표시 자릿수" })}
          </h2>
          <p className="mt-6 text-13_5 leading-[1.6] text-secondary">
            {t({
              en: "How many decimal places an R value shows, everywhere it appears.",
              ko: "R 값을 어디서나 몇 자리 소수점까지 표시할지 정합니다.",
            })}
          </p>
          <div className="mt-16 flex items-center gap-16">
            <Segmented
              className="flex-1"
              name={t({ en: "R display precision", ko: "R 표시 자릿수" })}
              value={String(rPrecision) as (typeof R_PRECISION_OPTIONS)[number]}
              onChange={(value) => setRPrecision(Number(value))}
              options={R_PRECISION_OPTIONS.map((n) => ({ value: n, label: n }))}
            />
            <span className="shrink-0 text-15 font-extrabold text-gain">{formatR(18.4, rPrecision)}</span>
          </div>
        </Card>

        {/* Emotion / behaviour tags */}
        <Card className={cn(isMobile ? "px-20 py-24" : "px-28 py-26")}>
          <h2 className="text-16 font-bold tracking-[-.02em] text-ink">
            {t({ en: "Emotion tags", ko: "감정 태그" })}
          </h2>
          <p className="mt-6 text-13_5 leading-[1.6] text-secondary">
            {t({
              en: "The behaviour tags offered on the trade form. Renaming or removing one never changes tags already saved on a trade.",
              ko: "New trade 폼에서 선택할 수 있는 태그입니다. 이름을 바꾸거나 삭제해도 이미 저장된 트레이드의 태그는 바뀌지 않습니다.",
            })}
          </p>
          <div className="mt-16">
            <TagPresetsEditor tags={tagPresets} onChange={setTagPresets} />
          </div>
        </Card>

        <div className="flex items-center gap-16">
          <Button size="lg" disabled={!dirty || isPending} onClick={onSave}>
            {isPending ? t({ en: "Saving…", ko: "저장하는 중…" }) : t({ en: "Save settings", ko: "설정 저장" })}
          </Button>
          {saved && !dirty && (
            <span className="text-13 font-semibold text-secondary">{t({ en: "Saved.", ko: "저장했습니다." })}</span>
          )}
          {error !== null && <span className="text-13 font-semibold text-loss">{error}</span>}
        </div>

        {/* Desktop reaches Sign out from TopBar already; mobile has no
            per-screen header action anywhere, so this is the one place it's
            reachable there (docs/decisions.md § Phase 9). */}
        {isMobile && (
          <Card className="px-20 py-20">
            <h2 className="text-16 font-bold tracking-[-.02em] text-ink">{t({ en: "Account", ko: "계정" })}</h2>
            <div className="mt-14">
              <SignOutButton signOutAction={signOut} />
            </div>
          </Card>
        )}
      </div>

      {isMobile && <BottomTabBar items={toTabItems(t)} activeHref="" />}
    </div>
  );
}

/**
 * A live sample chip in the picked convention's colors, previewing a choice
 * that may not be the one currently saved (and thus not the one `[data-pnl]`
 * on `<html>` is actually set to) — so this reads the west/kr CSS variable
 * pair directly by name rather than through the `text-gain`/`bg-gain-tint-1`
 * utility classes every other gain/loss color in the app uses, which only
 * ever reflect the *saved* convention.
 */
function PreviewChip({ convention, sign }: { convention: PnlConvention; sign: "gain" | "loss" }) {
  const prefix = `--pnl-${sign}-${convention}`;
  return (
    <span
      className="rounded-8 px-10 py-6 text-12_5 font-bold"
      style={{ background: `var(${prefix}-tint${sign === "gain" ? "-1" : ""})`, color: `var(${prefix})` }}
    >
      {sign === "gain" ? "+2.8R" : "−1.0R"}
    </span>
  );
}

/**
 * Add/rename/delete for `settings.tagPresets` (docs/decisions.md § Phase 5).
 * Each existing tag is an inline-editable pill (its own text input, sized to
 * its content via the native `size` attribute) with a remove button; a
 * dashed "add a tag" pill appends a new one. Nothing here writes to the
 * database directly — like every other field on this screen, edits only take
 * effect once "Save settings" runs, so a typo can be fixed before it sticks.
 */
function TagPresetsEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const t = useT();
  const [draft, setDraft] = useState("");

  function addDraft() {
    const trimmed = draft.trim();
    if (trimmed === "" || tags.includes(trimmed)) return;
    onChange([...tags, trimmed]);
    setDraft("");
  }

  return (
    <div className="flex flex-wrap items-center gap-8">
      {tags.map((tag, index) => (
        <span
          // Index-keyed: these rows are reordered only by insertion/removal
          // at this same position, never shuffled, so identity-by-position is
          // stable and avoids fighting the input's own focus/cursor state.
          key={index}
          className="inline-flex items-center gap-4 rounded-pill bg-divider py-8 pr-8 pl-14"
        >
          <input
            value={tag}
            onChange={(e) => onChange(tags.map((existing, i) => (i === index ? e.target.value : existing)))}
            size={Math.max(tag.length, 2)}
            aria-label={t({ en: "Tag name", ko: "태그 이름" })}
            className="bg-transparent text-12_5 font-semibold text-secondary outline-none"
          />
          <button
            type="button"
            onClick={() => onChange(tags.filter((_, i) => i !== index))}
            aria-label={t({ en: "Remove tag", ko: "태그 삭제" })}
            className="flex h-18 w-18 shrink-0 items-center justify-center rounded-pill text-faint transition-colors duration-150 ease-out hover:bg-divider-hover hover:text-secondary"
          >
            <X aria-hidden size={12} />
          </button>
        </span>
      ))}
      <span className="inline-flex items-center gap-4 rounded-pill border border-dashed border-divider py-7 pr-6 pl-12">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addDraft();
            }
          }}
          placeholder={t({ en: "Add a tag", ko: "태그 추가" })}
          size={Math.max(draft.length, 8)}
          className="bg-transparent text-12_5 font-semibold text-secondary outline-none placeholder:text-faint"
        />
        <button
          type="button"
          onClick={addDraft}
          disabled={draft.trim() === ""}
          aria-label={t({ en: "Add tag", ko: "태그 추가" })}
          className="flex h-18 w-18 shrink-0 items-center justify-center rounded-pill text-accent transition-colors duration-150 ease-out hover:bg-accent-tint disabled:opacity-40"
        >
          <Plus aria-hidden size={12} />
        </button>
      </span>
    </div>
  );
}
