import { expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { allPages } from "@/lib/docs";
import manifest from "./manifest.json";

// `bun run sync:docs` writes both the manifest and the *.md files here and
// clears stale pages, so a clean sync makes them agree by construction. This
// guards the other ways they drift: a hand-deleted page, a half-applied sync,
// a manifest edited by hand. A manifest page with no file renders a nav link
// that 404s; a file with no page is unreachable from nav.
//
// Read the directory with node:fs rather than importing @/lib/docs-content:
// that module contains import.meta.glob, which throws under `bun test`.
test("manifest pages and synced markdown files are the same set", () => {
	const files = readdirSync(new URL(".", import.meta.url))
		.filter((name) => name.endsWith(".md"))
		.map((name) => name.replace(/\.md$/, ""))
		.sort();
	const slugs = allPages(manifest)
		.map((doc) => doc.slug)
		.sort();

	expect(slugs).toEqual(files);
});
