"use client";

import { useRouter } from "next/navigation";
import { AccountSetup } from "./account-setup";
import { NewTradeForm, type NewTradeFormProps } from "./new-trade-form";

/**
 * Puts the first-run account setup in front of the form when there's no
 * account yet, and refreshes the server component once one exists so the form
 * renders with a real 1R.
 */
export function NewTradeGate({ formProps }: { formProps?: NewTradeFormProps }) {
  const router = useRouter();

  if (formProps === undefined) {
    // Closing the gate means "not now" — back to where New trade was opened from.
    return <AccountSetup onCreated={() => router.refresh()} onCancel={() => router.push("/")} />;
  }

  return <NewTradeForm {...formProps} />;
}
