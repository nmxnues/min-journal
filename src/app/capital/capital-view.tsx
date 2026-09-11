"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BottomTabBar } from "@/components/nav/bottom-tab-bar";
import { toNavItems, toTabItems } from "@/components/nav/routes";
import { SignOutButton } from "@/components/nav/sign-out-button";
import { TopBar } from "@/components/nav/top-bar";
import { Button, EmptyState } from "@/components/ui";
import { useLocale, useT } from "@/lib/i18n/locale-context";
import { signOut } from "../actions";
import { AccountSetup } from "../trades/new/account-setup";
import { CashMovementModal } from "./cash-movement-modal";
import { DesktopCapital } from "./desktop-capital";
import { MobileCapital } from "./mobile-capital";
import { useCapitalSummary, type CapitalData } from "./use-capital-summary";

/**
 * Same branch as Dashboard (docs/decisions.md § Phase 5): mock 3a and the
 * 3b-mobile screen are different screens, so `locale` (the app's own <900px
 * signal) picks the whole component.
 */
export function CapitalView({ data }: { data: CapitalData | null }) {
  if (data === null) return <NoAccount />;
  return <CapitalScreen data={data} />;
}

function CapitalScreen({ data }: { data: CapitalData }) {
  const locale = useLocale();
  const router = useRouter();
  const summary = useCapitalSummary(data);
  const [cashOpen, setCashOpen] = useState(false);
  const isMobile = locale === "ko";

  const screenProps = { data, summary, onRecordCash: () => setCashOpen(true) };

  return (
    <>
      {isMobile ? <MobileCapital {...screenProps} /> : <DesktopCapital {...screenProps} />}
      {/* Mounted only while open, so every opening starts from a clean form. */}
      {cashOpen && (
        <CashMovementModal
          data={data}
          summary={summary}
          variant={isMobile ? "sheet" : "modal"}
          onClose={() => setCashOpen(false)}
          onRecorded={() => {
            setCashOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

/**
 * The Capital screen can't show anything without a starting balance, so a
 * fresh install gets the same first-run setup New trade uses (Phase 4a) —
 * one account row, created in one place.
 */
function NoAccount() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [setupOpen, setSetupOpen] = useState(false);
  const isMobile = locale === "ko";

  return (
    <div className="flex min-h-full flex-col bg-page">
      {isMobile ? (
        <div className="px-20 pt-16 pb-8">
          <span className="text-20 font-extrabold tracking-[-.03em] text-ink">{t({ en: "Capital", ko: "자산" })}</span>
        </div>
      ) : (
        <TopBar items={toNavItems(t)} activeHref="/capital" right={<SignOutButton signOutAction={signOut} />} />
      )}

      <div className="flex flex-1 items-center justify-center p-32">
        <EmptyState
          title={t({ en: "No account yet", ko: "아직 계좌가 없습니다" })}
          description={t({
            en: "Capital tracks the money behind your R — starting capital, deposits and withdrawals, and what 1R is worth today.",
            ko: "시작 자본과 입출금, 그리고 지금 1R이 얼마인지 — R 뒤에 있는 돈을 여기서 관리합니다.",
          })}
          action={<Button onClick={() => setSetupOpen(true)}>{t({ en: "Set up your account", ko: "계좌 설정하기" })}</Button>}
          className="w-full max-w-[440px]"
        />
      </div>

      {isMobile && <BottomTabBar items={toTabItems(t)} activeHref="/capital" />}

      {setupOpen && (
        <AccountSetup
          onCreated={() => {
            setSetupOpen(false);
            router.refresh();
          }}
          onCancel={() => setSetupOpen(false)}
        />
      )}
    </div>
  );
}
