import { ImageResponse } from "next/og";
import { AppIconMark } from "@/lib/app-icon";

// Manifest's 512×512 entry (both the plain and the "maskable" purpose — the
// glyph already sits well inside a maskable safe zone, see app-icon.tsx).
export async function GET() {
  return new ImageResponse(<AppIconMark size={512} />, {
    width: 512,
    height: 512,
    headers: { "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
