import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico
     * - image file extensions (public/logo.png, favicons, apple-touch-icon,
     *   icon-192/512)
     * - manifest.webmanifest — Next's PWA manifest file-convention route
     *   (app/manifest.ts). Browsers fetch it before any auth exists (during
     *   "Add to Home Screen"), and it has no image extension for the rule
     *   above to catch — without this, it'd 307 to /login.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
