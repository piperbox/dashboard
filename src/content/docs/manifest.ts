// Nav order and labels come from piper's docs/manifest.json, synced by
// `bun run sync:docs`. Flat for now; sections arrive with the layout work.
import manifest from "./manifest.json";

export type DocEntry = { slug: string; title: string };

export const DOCS: DocEntry[] = manifest.sections.flatMap(
	(section) => section.pages,
);
