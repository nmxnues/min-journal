import { ImageResponse } from "next/og";
import { AppIconMark } from "@/lib/app-icon";

// Not one of Next's special icon filenames — this is a plain Route Handler,
// reachable at /icon-192.png, that manifest.ts points its 192×192 entry at.
// (icon.tsx/apple-icon.tsx cover the favicon and the iOS home-screen icon;
// the PWA install manifest wants its own sizes on top of those.)
export async function GET() {
  return new ImageResponse(<AppIconMark size={192} />, {
    width: 192,
    height: 192,
    headers: { "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
