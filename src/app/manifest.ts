import type { MetadataRoute } from "next";

// Next's file-convention PWA manifest (auto-served at /manifest.webmanifest
// and auto-linked into <head> — no metadata.manifest entry needed). This is
// what lets "Add to Home Screen" open the app full-screen, no browser chrome.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Min Journal",
    short_name: "Min Journal",
    description: "A single-user CRT trading journal.",
    start_url: "/",
    display: "standalone",
    // Matches globals.css's --color-page / --color-ink — the splash
    // background while the app loads, and the OS chrome around it.
    background_color: "#f4f5f7",
    theme_color: "#191f28",
    // Static files in public/. No "maskable" entry: the artwork already has
    // its own rounded corners and bars close to the edge, so Android's
    // circular mask would clip it.
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
