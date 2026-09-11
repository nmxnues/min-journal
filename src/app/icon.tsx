import { ImageResponse } from "next/og";
import { AppIconMark } from "@/lib/app-icon";

// Next's file-convention favicon (docs.next.js.org/app/api-reference/file-conventions/metadata/app-icons):
// auto-linked into every page's <head>, no metadata.icons entry needed.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<AppIconMark size={32} />, size);
}
