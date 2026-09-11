/**
 * The account every screen reads/writes against — shared between the server
 * query (`getCurrentAccount`, in supabase/queries.ts) and the server action
 * that sets it (`setCurrentAccount`, in app/capital/actions.ts), the same
 * split `VIEWPORT_LOCALE_COOKIE` uses for locale.
 */
export const CURRENT_ACCOUNT_COOKIE = "current-account-id";
