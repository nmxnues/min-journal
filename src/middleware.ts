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
     * - image file extensions
     * - icon, apple-icon, manifest.webmanifest — Next's PWA icon/manifest
     *   file-convention routes (app/icon.tsx, app/apple-icon.tsx,
     *   app/manifest.ts). Browsers fetch these before any auth exists
     *   (favicon on /login, the manifest during "Add to Home Screen"), and
     *   these three have no file extension for the .svg/.png/... rule above
     *   to already catch — without this, they'd 307 to /login instead of
     *   ever serving a real icon.
     */
    "/((?!_next/static|_next/image|favicon.ico|icon$|apple-icon$|manifest.webmanifest$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
