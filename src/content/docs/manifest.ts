// Nav order and labels live here, not as frontmatter upstream: GitHub renders
// YAML frontmatter as a table atop the file, degrading the GitHub reading
// experience that keeping the source in piperbox/piper is meant to protect.
export type DocEntry = { slug: string; title: string };

// Empty until piper's docs are reworked. Add entries after `bun run sync:docs`.
export const DOCS: DocEntry[] = [];
