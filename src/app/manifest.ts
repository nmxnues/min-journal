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
    // `background_color` is the splash behind the icon while the app loads:
    // globals.css's --color-page, the same grey the page itself sits on.
    //
    // `theme_color` is the installed window's own title bar (and the mobile
    // browser's address-bar tint). It is --color-surface, i.e. exactly the
    // `bg-surface` white of TopBar, so the OS chrome reads as the top edge of
    // the app rather than as a separate black band above it. It was
    // --color-ink (#191f28) up to this point, which is what made that band
    // black in both windowed and fullscreen mode.
    background_color: "#f4f5f7",
    theme_color: "#ffffff",
    // Static files in public/. No "maskable" entry: the artwork already has
    // its own rounded corners and bars close to the edge, so Android's
    // circular mask would clip it.
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
