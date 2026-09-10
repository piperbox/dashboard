import { expect, test } from "bun:test";
import {
	articleHead,
	articleUrl,
	BLOG_URL,
	blogIndexHead,
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

test("parseManifest refuses a manifest missing its articles array", () => {
	expect(() => parseManifest({ version: 1, generated_at: "" })).toThrow(
		"Malformed SEO Potion manifest",
	);
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

const metaOf = (
	tags: unknown[] | undefined,
	key: "name" | "property",
	v: string,
) =>
	((tags ?? []).find((t: unknown) => (t as any)?.[key] === v) as any)?.[
		"content"
	] as string | undefined;
const jsonLdOf = (head: ReturnType<typeof articleHead>, type: string) => {
	const script = (head.scripts ?? []).find((s: unknown) =>
		String((s as Record<string, unknown>)?.children).includes(
			`"@type":"${type}"`,
		),
	);
	return JSON.parse(
		String((script as Record<string, unknown>)?.children),
	) as Record<string, unknown>;
};

test("articleHead uses meta_title as the title and meta_description as the description", () => {
	const head = articleHead(fixtureArticle);
	expect((head.meta ?? []).find((m) => m?.title)?.title).toBe(
		"How AI Outfit Generators Work | Guide",
	);
	expect(metaOf(head.meta, "name", "description")).toBe(
		fixtureArticle.meta_description,
	);
});

test("articleHead canonicalizes to the trailing-slash URL", () => {
	const head = articleHead(fixtureArticle);
	expect(head.links).toContainEqual({
		rel: "canonical",
		href: "https://piperbox.dev/blog/ai-outfit-generator/",
	});
	expect(metaOf(head.meta, "property", "og:url")).toBe(
		"https://piperbox.dev/blog/ai-outfit-generator/",
	);
});

test("articleHead emits Open Graph article tags with the cover and its size", () => {
	const head = articleHead(fixtureArticle);
	expect(metaOf(head.meta, "property", "og:type")).toBe("article");
	expect(metaOf(head.meta, "property", "og:image")).toBe(fixtureArticle.cover);
	expect(metaOf(head.meta, "property", "og:image:width")).toBe("1216");
	expect(metaOf(head.meta, "property", "og:image:height")).toBe("640");
	expect(metaOf(head.meta, "property", "article:published_time")).toBe(
		"2026-08-08T10:15:00.000Z",
	);
	expect(metaOf(head.meta, "name", "twitter:card")).toBe("summary_large_image");
	expect(metaOf(head.meta, "name", "twitter:image")).toBe(fixtureArticle.cover);
});

test("articleHead omits image dimensions when the manifest has none", () => {
	const head = articleHead({
		...fixtureArticle,
		cover_width: null,
		cover_height: null,
	});
	expect(metaOf(head.meta, "property", "og:image:width")).toBeUndefined();
	expect(metaOf(head.meta, "property", "og:image:height")).toBeUndefined();
});

test("articleHead only reports a modified time once the article was republished", () => {
	expect(
		metaOf(
			articleHead(fixtureArticle).meta,
			"property",
			"article:modified_time",
		),
	).toBeUndefined();
	const updated = articleHead({
		...fixtureArticle,
		updated_at: "2026-08-20T00:00:00.000Z",
	});
	expect(metaOf(updated.meta, "property", "article:modified_time")).toBe(
		"2026-08-20T00:00:00.000Z",
	);
	expect(jsonLdOf(updated, "BlogPosting").dateModified).toBe(
		"2026-08-20T00:00:00.000Z",
	);
});

test("articleHead emits BlogPosting JSON-LD", () => {
	const posting = jsonLdOf(articleHead(fixtureArticle), "BlogPosting");
	expect(posting["@context"]).toBe("https://schema.org");
	expect(posting.headline).toBe("How AI Outfit Generators Work");
	expect(posting.url).toBe("https://piperbox.dev/blog/ai-outfit-generator/");
	expect(posting.mainEntityOfPage).toBe(
		"https://piperbox.dev/blog/ai-outfit-generator/",
	);
	expect(posting.image).toBe(fixtureArticle.cover);
	expect(posting.datePublished).toBe("2026-08-08T10:15:00.000Z");
	expect(posting.dateModified).toBe("2026-08-08T10:15:00.000Z");
	expect(posting.keywords).toBe("ai outfit generator");
	expect(posting.publisher).toEqual({
		"@type": "Organization",
		name: "Piper",
		url: "https://piperbox.dev",
	});
});

test("articleHead emits BreadcrumbList JSON-LD ending at the article", () => {
	const crumbs = jsonLdOf(articleHead(fixtureArticle), "BreadcrumbList");
	expect(crumbs.itemListElement).toEqual([
		{
			"@type": "ListItem",
			position: 1,
			name: "Home",
			item: "https://piperbox.dev/",
		},
		{
			"@type": "ListItem",
			position: 2,
			name: "Blog",
			item: "https://piperbox.dev/blog/",
		},
		{
			"@type": "ListItem",
			position: 3,
			name: "How AI Outfit Generators Work",
			item: "https://piperbox.dev/blog/ai-outfit-generator/",
		},
	]);
});

test("articleHead escapes a closing script tag inside JSON-LD", () => {
	const head = articleHead({ ...fixtureArticle, title: "</script><b>x" });
	for (const script of head.scripts ?? []) {
		expect(String(script?.children)).not.toContain("</script>");
	}
	expect(jsonLdOf(head, "BlogPosting").headline).toBe("</script><b>x");
});

test("blogIndexHead canonicalizes the index to /blog/", () => {
	const head = blogIndexHead();
	expect(head.links).toContainEqual({
		rel: "canonical",
		href: "https://piperbox.dev/blog/",
	});
	expect(metaOf(head.meta, "property", "og:url")).toBe(
		"https://piperbox.dev/blog/",
	);
	expect(metaOf(head.meta, "property", "og:type")).toBe("website");
	expect((head.meta ?? []).find((m) => m?.title)?.title).toContain("Piper");
	expect(
		(metaOf(head.meta, "name", "description") ?? "").length,
	).toBeLessThanOrEqual(160);
});
