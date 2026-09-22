import { LoginScreen } from "./login-screen";
import { localizedTitle } from "@/lib/i18n/server-locale";

export const generateMetadata = localizedTitle({ en: "Log in", ko: "로그인" });

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return <LoginScreen next={next} />;
}
