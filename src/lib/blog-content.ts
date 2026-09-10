// QUARANTINE: import.meta.glob is a Vite-only transform and throws under
// `bun test`. This module must be imported ONLY from src/routes/**.
// Everything else takes articles and bodies as props so it stays testable.
import { type Article, parseManifest, stripFrontmatter } from "@/lib/blog";

// A glob rather than a static import: before SEO Potion's first publish the
// file does not exist, and a static import would fail tsc and the build.
// The glob resolves to {} instead. Eager, because every blog route needs it
// and it is one small JSON document.
const manifests = import.meta.glob("../content/blog/manifest.json", {
	eager: true,
	import: "default",
}) as Record<string, unknown>;

// Lazy: one chunk per article, fetched only by the route that renders it.
const bodies = import.meta.glob("../content/blog/articles/*.md", {
	query: "?raw",
	import: "default",
}) as Record<string, () => Promise<string>>;

export function loadArticles(): Article[] {
	const raw = Object.values(manifests)[0];
	return raw === undefined ? [] : parseManifest(raw);
}

export async function loadBody(slug: string): Promise<string | null> {
	const path = Object.keys(bodies).find((p) => p.endsWith(`/${slug}.md`));
	return path ? stripFrontmatter(await bodies[path]()) : null;
}
