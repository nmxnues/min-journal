import type { Metadata } from "next";
import { ComponentGallery } from "./gallery";

export const metadata: Metadata = {
  title: "Components · Min Journal",
};

/** Dev-only route for eyeballing the primitives against the mocks. */
export default function ComponentsPage() {
  return <ComponentGallery />;
}
