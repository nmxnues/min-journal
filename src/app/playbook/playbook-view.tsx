"use client";

import { ChevronRight, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BottomTabBar } from "@/components/nav/bottom-tab-bar";
import { toNavItems, toTabItems } from "@/components/nav/routes";
import { SignOutButton } from "@/components/nav/sign-out-button";
import { TopBar } from "@/components/nav/top-bar";
import { Button, Card, Chip, EmptyState } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { ModelStats } from "@/lib/domain/stats";
import type { TradeModel } from "@/lib/domain/types";
import { formatPercent } from "@/lib/format";
import { useFormatR } from "@/lib/settings/context";
import { useLocale, useT } from "@/lib/i18n/locale-context";
import { signOut } from "../actions";
import { createModel, setModelStatus, updateModel } from "./actions";

export interface PlaybookViewProps {
  models: TradeModel[];
  stats: ModelStats[];
  hasAccount: boolean;
}

const em = "—";

export function PlaybookView({ models, stats, hasAccount }: PlaybookViewProps) {
  const t = useT();
  const locale = useLocale();
  const isMobile = locale === "ko";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(models[0]?.id ?? null);

  const statByModelId = new Map(stats.map((s) => [s.modelId, s]));

  function onNewModel() {
    startTransition(async () => {
      const result = await createModel();
      if (result.ok) {
        setExpandedId(result.id);
        router.refresh();
      }
    });
  }

  const topBar = (
    <TopBar
      items={toNavItems(t)}
      activeHref="/playbook"
      right={
        <>
          <Button onClick={() => router.push("/trades/new")}>{t({ en: "New trade", ko: "New trade" })}</Button>
          <SignOutButton signOutAction={signOut} />
        </>
      }
    />
  );

  const header = (
    <div className={cn("flex items-center justify-between", isMobile ? "px-20 pt-16 pb-8" : "bg-surface px-28 py-20")}>
      <span className={cn("font-bold tracking-[-.02em] text-ink", isMobile ? "text-20" : "text-18")}>
        {t({ en: "Playbook", ko: "플레이북" })}
      </span>
      <Button size={isMobile ? "sm" : "md"} onClick={onNewModel} disabled={isPending}>
        {t({ en: "New model", ko: "새 모델" })}
      </Button>
    </div>
  );

  if (!hasAccount) {
    return (
      <div className="flex min-h-full flex-col bg-page">
        {isMobile ? header : topBar}
        <div className="flex flex-1 items-center justify-center p-32">
          <EmptyState
            title={t({ en: "No models yet", ko: "아직 모델이 없습니다" })}
            description={t({
              en: "Add the setups you actually trade, so the dashboard can tell you which ones earn their place.",
              ko: "실제로 거래하는 셋업을 추가하면 대시보드에서 어떤 모델이 제 몫을 하는지 알 수 있습니다.",
            })}
            action={<Button onClick={() => router.push("/trades/new")}>{t({ en: "New trade", ko: "New trade" })}</Button>}
            className="w-full max-w-[440px]"
          />
        </div>
        {isMobile && <BottomTabBar items={toTabItems(t)} activeHref="/playbook" />}
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-page">
      {!isMobile && topBar}
      {isMobile ? header : null}

      <div className={cn("mx-auto flex w-full max-w-[900px] flex-1 flex-col gap-16", isMobile ? "p-20" : "p-32")}>
        {!isMobile && header}

        {models.length === 0 ? (
          <Card className="px-32 py-40">
            <EmptyState
              title={t({ en: "No models yet", ko: "아직 모델이 없습니다" })}
              description={t({
                en: "Add the setups you actually trade to start tracking which ones earn their place.",
                ko: "실제로 거래하는 셋업을 추가해 어떤 모델이 제 몫을 하는지 추적해보세요.",
              })}
            />
          </Card>
        ) : (
          models.map((model) =>
            model.id === expandedId ? (
              <ExpandedModelCard
                key={model.id}
                model={model}
                stat={statByModelId.get(model.id) ?? null}
                isMobile={isMobile}
                onCollapse={() => setExpandedId(null)}
              />
            ) : (
              <CollapsedModelRow
                key={model.id}
                model={model}
                stat={statByModelId.get(model.id) ?? null}
                isMobile={isMobile}
                onExpand={() => setExpandedId(model.id)}
              />
            ),
          )
        )}
      </div>

      {isMobile && <BottomTabBar items={toTabItems(t)} activeHref="/playbook" />}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-14 bg-surface-subtle px-16 py-14">
      <div className="text-11_5 font-semibold text-muted">{label}</div>
      <div className="mt-2 text-18 font-extrabold text-ink">{value}</div>
    </div>
  );
}

/** docs/README.md § Playbook: retiring never touches history — this is the one-line notice the retired state always carries, regardless of whatever the model's own free-text description says. */
function RetiredNotice() {
  const t = useT();
  return (
    <p className="mt-8 text-12 font-medium leading-[1.5] text-faint italic">
      {t({
        en: "Retired — existing trades keep their record as logged; only new trades matching this model are flagged off-plan.",
        ko: "은퇴한 모델입니다 — 이미 기록된 트레이드는 그대로 유지되고, 이후 이 모델로 기록되는 트레이드만 off-plan으로 표시됩니다.",
      })}
    </p>
  );
}

function ExpandedModelCard({
  model,
  stat,
  isMobile,
  onCollapse,
}: {
  model: TradeModel;
  stat: ModelStats | null;
  isMobile: boolean;
  onCollapse: () => void;
}) {
  const formatR = useFormatR();
  const t = useT();
  const [name, setName] = useState(model.name);
  const [description, setDescription] = useState(model.description ?? "");
  const [rules, setRules] = useState<string[]>(model.rules);
  const [error, setError] = useState<string | null>(null);

  function save(next: { name?: string; description?: string; rules?: string[] }) {
    const nextName = next.name ?? name;
    const nextDescription = next.description ?? description;
    const nextRules = next.rules ?? rules;
    setError(null);
    void updateModel(model.id, { name: nextName, description: nextDescription, rules: nextRules }).then((result) => {
      if (!result.ok) setError(result.error);
    });
  }

  function onRuleChange(index: number, value: string) {
    setRules((current) => current.map((r, i) => (i === index ? value : r)));
  }

  function onRuleBlur(index: number, value: string) {
    const next = rules.map((r, i) => (i === index ? value : r));
    setRules(next);
    save({ rules: next });
  }

  function addRule() {
    const next = [...rules, ""];
    setRules(next);
  }

  function removeRule(index: number) {
    const next = rules.filter((_, i) => i !== index);
    setRules(next);
    save({ rules: next });
  }

  return (
    <Card className={cn(isMobile ? "px-20 py-24" : "px-28 py-26")}>
      <div className={cn("grid gap-28", isMobile ? "grid-cols-1" : "grid-cols-[1fr_260px]")}>
        <div>
          <div className="flex flex-wrap items-center gap-10">
            <button type="button" onClick={onCollapse} className="text-left">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={(e) => save({ name: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "rounded-8 bg-transparent font-bold tracking-[-.02em] text-ink outline-none hover:bg-divider focus-visible:bg-divider",
                  isMobile ? "text-16" : "text-17",
                )}
              />
            </button>
            <Chip tone={model.status === "retired" ? "muted" : "accent"} shape="pill">
              {model.status === "retired" ? t({ en: "Retired", ko: "은퇴" }) : t({ en: "Active", ko: "활성" })}
            </Chip>
            <button
              type="button"
              onClick={() =>
                void setModelStatus(model.id, model.status === "retired" ? "active" : "retired").then(() => {
                  window.location.reload();
                })
              }
              className="ml-auto text-12_5 font-semibold text-accent hover:text-accent-pressed"
            >
              {model.status === "retired" ? t({ en: "Reactivate", ko: "다시 활성화" }) : t({ en: "Retire model", ko: "모델 은퇴시키기" })}
            </button>
          </div>

          {model.status === "retired" && <RetiredNotice />}

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={(e) => save({ description: e.target.value })}
            placeholder={t({ en: "What is this setup?", ko: "이 셋업은 무엇인가요?" })}
            rows={2}
            className="mt-10 w-full resize-none rounded-10 bg-transparent text-13_5 leading-[1.7] text-secondary outline-none placeholder:text-faint hover:bg-divider focus-visible:bg-divider"
          />

          <div className="mt-16 flex flex-col gap-9">
            {rules.map((rule, index) => (
              <div key={index} className="flex items-start gap-10">
                {/* Mock spec is "700 10px", but this project's type scale
                    (FONT_SIZES in src/lib/cn.ts) starts at 11 — rounded up
                    rather than adding a token for a single, barely
                    perceptible 1px difference on a tiny badge numeral. */}
                <span className="mt-2 flex h-18 w-18 shrink-0 items-center justify-center rounded-6 bg-divider text-11 font-bold text-muted">
                  {index + 1}
                </span>
                <input
                  value={rule}
                  onChange={(e) => onRuleChange(index, e.target.value)}
                  onBlur={(e) => onRuleBlur(index, e.target.value)}
                  placeholder={t({ en: "Rule text", ko: "규칙 내용" })}
                  className="flex-1 rounded-8 bg-transparent text-13_5 leading-[1.5] text-body outline-none placeholder:text-faint hover:bg-divider focus-visible:bg-divider"
                />
                <button
                  type="button"
                  onClick={() => removeRule(index)}
                  aria-label={t({ en: "Remove rule", ko: "규칙 삭제" })}
                  className="text-faint hover:text-loss"
                >
                  <X aria-hidden size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addRule}
              className="flex items-center gap-6 self-start text-12_5 font-semibold text-accent hover:text-accent-pressed"
            >
              <Plus aria-hidden size={14} />
              {t({ en: "Add rule", ko: "규칙 추가" })}
            </button>
          </div>

          {error !== null && <p className="mt-10 text-12_5 font-semibold text-loss">{error}</p>}
        </div>

        <div>
          <div
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, var(--color-page) 0 8px, var(--color-panel) 8px 16px)",
            }}
            className="flex h-104 items-center justify-center rounded-16 font-mono text-11 text-muted"
          >
            {t({ en: "reference setup screenshot", ko: "참고 셋업 스크린샷" })}
          </div>
          <div className="mt-12 grid grid-cols-2 gap-10">
            <StatTile label={t({ en: "Net", ko: "순 R" })} value={stat === null || stat.tradeCount === 0 ? em : formatR(stat.netR)} />
            <StatTile
              label={t({ en: "Win rate", ko: "승률" })}
              value={stat?.winRate == null ? em : formatPercent(stat.winRate)}
            />
            <StatTile label={t({ en: "Trades", ko: "트레이드" })} value={String(stat?.tradeCount ?? 0)} />
            <StatTile label={t({ en: "Avg R", ko: "평균 R" })} value={stat?.avgR == null ? em : formatR(stat.avgR, 2, true, false)} />
          </div>
        </div>
      </div>
    </Card>
  );
}

function CollapsedModelRow({
  model,
  stat,
  isMobile,
  onExpand,
}: {
  model: TradeModel;
  stat: ModelStats | null;
  isMobile: boolean;
  onExpand: () => void;
}) {
  const formatR = useFormatR();
  const t = useT();
  const isRetired = model.status === "retired";

  return (
    <button
      type="button"
      onClick={onExpand}
      className={cn(
        "flex items-center justify-between rounded-24 bg-surface text-left transition-opacity duration-150 ease-out",
        isMobile ? "px-20 py-20" : "px-28 py-24",
        isRetired && "opacity-[.72]",
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-10">
          <span className={cn("truncate font-bold tracking-[-.02em] text-ink", isMobile ? "text-15" : "text-16")}>
            {model.name}
          </span>
          <Chip tone={isRetired ? "muted" : "accent"} shape="pill" className="shrink-0">
            {isRetired ? t({ en: "Retired", ko: "은퇴" }) : t({ en: "Active", ko: "활성" })}
          </Chip>
        </div>
        {model.description !== null && model.description !== "" && (
          <p className="mt-6 truncate text-13 font-medium text-muted">{model.description}</p>
        )}
        {isRetired && <RetiredNotice />}
      </div>

      {!isMobile && (
        <div className="flex shrink-0 items-center gap-24 pl-16">
          <div className="text-right">
            <div className="text-11_5 font-semibold text-muted">{t({ en: "Net", ko: "순 R" })}</div>
            <div className={cn("text-18 font-extrabold", stat === null || stat.tradeCount === 0 ? "text-ink" : stat.netR >= 0 ? "text-gain" : "text-loss")}>
              {stat === null || stat.tradeCount === 0 ? em : formatR(stat.netR)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-11_5 font-semibold text-muted">{t({ en: "Win rate", ko: "승률" })}</div>
            <div className="text-18 font-extrabold text-ink">{stat?.winRate == null ? em : formatPercent(stat.winRate)}</div>
          </div>
          <ChevronRight aria-hidden size={16} className="text-disabled" />
        </div>
      )}
      {isMobile && (
        <div className="shrink-0 pl-12 text-right">
          <div className={cn("text-16 font-extrabold", stat === null || stat.tradeCount === 0 ? "text-ink" : stat.netR >= 0 ? "text-gain" : "text-loss")}>
            {stat === null || stat.tradeCount === 0 ? em : formatR(stat.netR)}
          </div>
        </div>
      )}
    </button>
  );
}
