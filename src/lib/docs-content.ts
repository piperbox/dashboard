// QUARANTINE: import.meta.glob is a Vite-only transform and throws under
// `bun test`. This module must be imported ONLY from src/routes/docs/*.
// Everything else takes markdown as a prop so it stays testable.
import { slugFromPath } from "@/lib/docs";

export function docSources(): Record<string, string> {
	const modules = import.meta.glob("../content/docs/*.md", {
		query: "?raw",
		eager: true,
		import: "default",
	}) as Record<string, string>;

	return Object.fromEntries(
		Object.entries(modules).map(([path, md]) => [slugFromPath(path), md]),
	);
}
