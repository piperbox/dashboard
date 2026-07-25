import { expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { DOCS } from "./manifest";

// The site has two sources of truth for which documents exist: this manifest
// (hand-authored, drives nav) and the *.md files `bun run sync:docs` writes
// here (discovered by a glob). They must agree in both directions — a manifest
// entry with no file renders a nav link that 404s, and a file with no entry is
// reachable by URL but invisible in nav.
//
// Read the directory with node:fs rather than importing @/lib/docs-content:
// that module contains import.meta.glob, which throws under `bun test`.
test("manifest entries and synced markdown files are the same set", () => {
	const files = readdirSync(new URL(".", import.meta.url))
		.filter((name) => name.endsWith(".md"))
		.map((name) => name.replace(/\.md$/, ""))
		.sort();
	const slugs = DOCS.map((doc) => doc.slug).sort();

	expect(slugs).toEqual(files);
});
