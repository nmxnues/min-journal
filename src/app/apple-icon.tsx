import { ImageResponse } from "next/og";
import { AppIconMark } from "@/lib/app-icon";

// The iOS home-screen icon when the app is added via Safari's share sheet —
// auto-linked as <link rel="apple-touch-icon">, no metadata.icons entry
// needed. 180×180 is Apple's own current recommended size.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<AppIconMark size={180} rounded={false} />, size);
}
