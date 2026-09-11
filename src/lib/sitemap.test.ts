import { expect, test } from "bun:test";
import { fixtureArticle } from "./blog.fixture";
import { buildSitemap } from "./sitemap";

const locs = (xml: string) =>
	[...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);

test("lists only the landing page at zero docs and zero articles", () => {
	const xml = buildSitemap({ articles: [], docs: [] });
	expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
	expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
	expect(locs(xml)).toEqual(["https://piperbox.dev/"]);
});

test("lists the blog index and every article with a trailing slash and lastmod", () => {
	const xml = buildSitemap({
		articles: [
			fixtureArticle,
			{
				...fixtureArticle,
				slug: "second",
				updated_at: "2026-08-20T00:00:00.000Z",
			},
		],
		docs: [],
	});
	expect(locs(xml)).toEqual([
		"https://piperbox.dev/",
		"https://piperbox.dev/blog/",
		"https://piperbox.dev/blog/ai-outfit-generator/",
		"https://piperbox.dev/blog/second/",
	]);
	expect(xml).toContain("<lastmod>2026-08-08T10:15:00.000Z</lastmod>");
	expect(xml).toContain("<lastmod>2026-08-20T00:00:00.000Z</lastmod>");
});

test("lists the docs index and each doc when the docs manifest has entries", () => {
	const xml = buildSitemap({
		articles: [],
		docs: [
			{
				slug: "getting-started",
				file: "guides/getting-started.md",
				title: "Getting started",
			},
		],
	});
	expect(locs(xml)).toEqual([
		"https://piperbox.dev/",
		"https://piperbox.dev/docs",
		"https://piperbox.dev/docs/getting-started",
	]);
});

test("escapes XML special characters in URLs", () => {
	const xml = buildSitemap({
		articles: [{ ...fixtureArticle, slug: "a&b" }],
		docs: [],
	});
	expect(xml).toContain("<loc>https://piperbox.dev/blog/a&amp;b/</loc>");
	expect(xml).not.toContain("a&b");
});
