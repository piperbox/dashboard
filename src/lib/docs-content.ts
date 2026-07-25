// QUARANTINE: import.meta.glob is a Vite-only transform and throws under
// `bun test`. This module must be imported ONLY from src/routes/docs/*.
// Everything else takes markdown as a prop so it stays testable.
import { slugFromPath } from "@/lib/docs";

// Deliberately NOT eager: an eager glob inlines every document into the chunk
// that statically imports this module, so the whole corpus would ship to every
// visitor. Lazy importers give each document its own chunk, fetched only by the
// route that renders it.
const modules = import.meta.glob("../content/docs/*.md", {
	query: "?raw",
	import: "default",
}) as Record<string, () => Promise<string>>;

export async function loadDoc(slug: string): Promise<string | null> {
	const path = Object.keys(modules).find((p) => slugFromPath(p) === slug);
	return path ? await modules[path]() : null;
}
