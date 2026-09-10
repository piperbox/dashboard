import { expect, test } from "bun:test";
import {
	articleUrl,
	BLOG_URL,
	formatDate,
	parseManifest,
	stripFrontmatter,
} from "./blog";
import { fixtureArticle } from "./blog.fixture";

test("parseManifest returns the articles in the order given", () => {
	const second = { ...fixtureArticle, slug: "second" };
	const articles = parseManifest({
		version: 1,
		generated_at: "2026-08-08T10:15:00.000Z",
		articles: [fixtureArticle, second],
	});
	expect(articles.map((a) => a.slug)).toEqual([
		"ai-outfit-generator",
		"second",
	]);
});

test("parseManifest refuses a contract version it was not written against", () => {
	expect(() =>
		parseManifest({ version: 2, generated_at: "", articles: [] }),
	).toThrow(/version 2/);
});

test("stripFrontmatter drops everything through the closing fence", () => {
	const md = '---\nslug: "x"\ntitle: "T"\n---\n## First heading\n\nBody.\n';
	expect(stripFrontmatter(md)).toBe("## First heading\n\nBody.\n");
});

test("stripFrontmatter handles CRLF line endings", () => {
	const md = '---\r\nslug: "x"\r\n---\r\n## H\r\n';
	expect(stripFrontmatter(md)).toBe("## H\r\n");
});

test("stripFrontmatter leaves a body with no frontmatter alone", () => {
	expect(stripFrontmatter("## H\n")).toBe("## H\n");
});

test("formatDate renders a fixed, timezone-independent date", () => {
	expect(formatDate("2026-08-08T23:59:00.000Z")).toBe("8 Aug 2026");
});

test("articleUrl is absolute and ends with a slash", () => {
	expect(articleUrl("ai-outfit-generator")).toBe(
		"https://piperbox.dev/blog/ai-outfit-generator/",
	);
	expect(BLOG_URL).toBe("https://piperbox.dev/blog/");
});
