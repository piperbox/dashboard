# Blog Section (SEO Potion) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public `/blog/` that renders articles SEO Potion commits into `src/content/blog/`, with canonical, Open Graph, Twitter, `BlogPosting` + `BreadcrumbList` JSON-LD, and a `sitemap.xml` — green at zero articles, working at N with no code changes.

**Architecture:** SEO Potion's GitHub App commits `manifest.json` + `articles/<slug>.md` into `src/content/blog/`. A quarantined `import.meta.glob` loader reads them (resolving to nothing before the first publish). Every SEO string is a pure function in `src/lib/blog.ts`; every renderer is a prop-driven component; routes stay thin. The public header and the terminal-styled Markdown element map are extracted from the docs components and shared.

**Tech Stack:** TanStack Start 1.168 / Router 1.170, React 19, Tailwind 4, Biome, `bun test` + Testing Library + happy-dom, `react-markdown` + `remark-gfm` + `rehype-raw` (new).

**Spec:** `docs/superpowers/specs/2026-09-10-blog-seo-potion-design.md`

## Global Constraints

- **Bun only.** Never `npm`/`yarn`/`node`. Install with `bun add`.
- **`SITE_ORIGIN` is `https://piperbox.dev`** (no trailing slash). Article URL is `https://piperbox.dev/blog/<slug>/` — **trailing slash, always, everywhere**: links, canonical, `og:url`, JSON-LD, sitemap.
- **Manifest contract version is 1.** Throw on anything else.
- **No blog content is committed.** `src/content/blog/` does not exist in git; SEO Potion owns it. Test fixtures live in test files. The one manual fixture (Task 11) is created and deleted in the same task and never staged.
- **`import.meta.glob` throws under `bun test`.** It may appear **only** in `src/lib/blog-content.ts` (and the pre-existing `docs-content.ts`), which only `src/routes/**` may import. No test may transitively import either.
- **Tests never live in `src/routes/`.** Routes stay thin; logic lives in `src/components/` and `src/lib/`.
- **`/docs` behaviour does not change.** The two extractions (Tasks 4, 5) are verified by the existing docs tests, which are not modified.
- **Raw HTML in article bodies is trusted** (committed by our own SEO Potion account). No sanitizer.
- **Dates:** `Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })`.
- Tabs, double quotes — Biome enforces it. Run `bun run format` before every commit.
- Import alias is `@/` → `src/`. Test router helpers follow the `createRootRoute` + `createRouter` + `RouterProvider` idiom in `src/components/docs-index.test.tsx`.
- Every task ends green on `bun test`. The final gate is `bun run verify`.
- Commit trailer on every commit:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  ```

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/links.ts` | **Modify.** Adds `SITE_ORIGIN`. |
| `src/lib/blog.ts` | **Create.** `Article`/`ArticleImage` types; pure helpers `parseManifest`, `stripFrontmatter`, `formatDate`, `articleUrl`, `BLOG_URL`, `articleHead`, `blogIndexHead`. No React, no IO. |
| `src/lib/sitemap.ts` | **Create.** Pure `buildSitemap({ articles, docs })` → XML string. |
| `src/lib/blog-content.ts` | **Create. Quarantined.** The two `import.meta.glob` calls; `loadArticles()`, `loadBody(slug)`. |
| `src/components/public-header.tsx` | **Create.** `PublicHeader({ section })`, lifted from `DocsLayout`. |
| `src/components/markdown-components.tsx` | **Create.** `markdownComponents`: the styled h2/h3/p/ul/ol/pre/code/table/th/td map, lifted from `DocsPage`. |
| `src/components/docs-layout.tsx` | **Modify.** Uses `PublicHeader`. |
| `src/components/docs-page.tsx` | **Modify.** Spreads `markdownComponents`. |
| `src/components/blog-layout.tsx` | **Create.** `PublicHeader section="blog"` + centered column. |
| `src/components/blog-index.tsx` | **Create.** Article list / empty state. |
| `src/components/blog-article.tsx` | **Create.** H1, dates, cover, body via `react-markdown` + `rehype-raw`. |
| `src/routes/blog/index.tsx` | **Create.** `/blog/`. |
| `src/routes/blog/$slug/index.tsx` | **Create.** `/blog/$slug/` with slash redirect and 404. |
| `src/routes/sitemap[.]xml.ts` | **Create.** GET handler serving `buildSitemap`. |
| `src/router.tsx` | **Modify.** `trailingSlash: "preserve"`. |
| `src/components/landing-page.tsx` | **Modify.** "blog" link in nav and footer. |
| `public/robots.txt` | **Modify.** `Sitemap:` line. |
| `biome.json` | **Modify.** Exclude `src/content/blog/**` (SEO Potion's JSON is not tab-formatted; `biome ci` must not fail on it). |
| `package.json` | **Modify.** `rehype-raw`. |

---

### Task 1: `SITE_ORIGIN` and the pure blog helpers

**Files:**
- Modify: `src/lib/links.ts`
- Create: `src/lib/blog.ts`, `src/lib/blog.fixture.ts`
- Test: `src/lib/blog.test.ts`

**Interfaces:**
- Produces:
  - `SITE_ORIGIN: string` (`src/lib/links.ts`)
  - `fixtureArticle: Article` (`src/lib/blog.fixture.ts`) — shared by every later test; a plain module, not a test file, so importing it never re-registers tests
  - `type ArticleImage = { src: string; alt: string; width: number | null; height: number | null }`
  - `type Article = { slug; title; meta_title; meta_description; keyword; cover; cover_alt: string; cover_width; cover_height: number | null; images: ArticleImage[]; published_at: string; updated_at: string | null; path: string }`
  - `parseManifest(raw: unknown): Article[]`
  - `stripFrontmatter(md: string): string`
  - `formatDate(iso: string): string`
  - `articleUrl(slug: string): string`
  - `BLOG_URL: string`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/blog.fixture.ts` (a plain module — bun only runs `*.test.*` files, so it is safe to import from any test):

```ts
import type { Article } from "@/lib/blog";

// One article shaped exactly like SEO Potion's manifest entry, with both a
// sized and an unsized inline image.
export const fixtureArticle: Article = {
	slug: "ai-outfit-generator",
	title: "How AI Outfit Generators Work",
	meta_title: "How AI Outfit Generators Work | Guide",
	meta_description: "A plain-language look at how AI turns a photo into an outfit.",
	keyword: "ai outfit generator",
	cover: "https://cdn.seopotion.com/orgs/abc/articles/123/cover.webp",
	cover_alt: "A phone showing a generated outfit",
	cover_width: 1216,
	cover_height: 640,
	images: [
		{
			src: "https://cdn.seopotion.com/orgs/abc/articles/123/inline-1.webp",
			alt: "Three generated looks side by side",
			width: 1216,
			height: 672,
		},
		{
			src: "https://cdn.seopotion.com/orgs/abc/articles/123/inline-2.webp",
			alt: "An older image with no size",
			width: null,
			height: null,
		},
	],
	published_at: "2026-08-08T10:15:00.000Z",
	updated_at: null,
	path: "src/content/blog/articles/ai-outfit-generator.md",
};
```

Create `src/lib/blog.test.ts`:

```ts
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
	expect(articles.map((a) => a.slug)).toEqual(["ai-outfit-generator", "second"]);
});

test("parseManifest refuses a contract version it was not written against", () => {
	expect(() =>
		parseManifest({ version: 2, generated_at: "", articles: [] }),
	).toThrow(/version 2/);
});

test("stripFrontmatter drops everything through the closing fence", () => {
	const md = "---\nslug: \"x\"\ntitle: \"T\"\n---\n## First heading\n\nBody.\n";
	expect(stripFrontmatter(md)).toBe("## First heading\n\nBody.\n");
});

test("stripFrontmatter handles CRLF line endings", () => {
	const md = "---\r\nslug: \"x\"\r\n---\r\n## H\r\n";
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/lib/blog.test.ts`
Expected: FAIL — `Cannot find module "./blog"`.

- [ ] **Step 3: Add `SITE_ORIGIN`**

In `src/lib/links.ts`, append after `REPO_URL`:

```ts
// The dashboard's production origin. Fixed rather than derived from the
// request so PR previews and staging hosts canonicalize to production
// instead of being indexed as duplicates. No trailing slash.
export const SITE_ORIGIN = "https://piperbox.dev";
```

- [ ] **Step 4: Write `src/lib/blog.ts`**

```ts
import { SITE_ORIGIN } from "@/lib/links";

// Mirrors the SEO Potion custom-site manifest contract (version 1). The
// manifest carries every field the article frontmatter carries, so nothing
// here parses YAML: metadata comes from the manifest, the .md file is body
// only. See docs/superpowers/specs/2026-09-10-blog-seo-potion-design.md.
export type ArticleImage = {
	src: string;
	alt: string;
	width: number | null;
	height: number | null;
};

export type Article = {
	slug: string;
	title: string;
	meta_title: string;
	meta_description: string;
	keyword: string;
	cover: string;
	cover_alt: string;
	cover_width: number | null;
	cover_height: number | null;
	images: ArticleImage[];
	published_at: string;
	updated_at: string | null;
	path: string;
};

type Manifest = { version: number; generated_at: string; articles: Article[] };

// Articles come back in manifest order, which the contract guarantees is
// newest first.
export function parseManifest(raw: unknown): Article[] {
	const manifest = raw as Manifest;
	if (manifest.version !== 1) {
		throw new Error(
			`Unsupported SEO Potion manifest version ${manifest.version}`,
		);
	}
	return manifest.articles;
}

export function stripFrontmatter(md: string): string {
	return md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
}

// Fixed locale and UTC so server and client render the same string and
// hydration never mismatches.
const dateFormat = new Intl.DateTimeFormat("en-GB", {
	day: "numeric",
	month: "short",
	year: "numeric",
	timeZone: "UTC",
});

export function formatDate(iso: string): string {
	return dateFormat.format(new Date(iso));
}

export const BLOG_URL = `${SITE_ORIGIN}/blog/`;

// The trailing slash is part of SEO Potion's URL contract.
export function articleUrl(slug: string): string {
	return `${BLOG_URL}${slug}/`;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun test src/lib/blog.test.ts`
Expected: 7 pass.

- [ ] **Step 6: Format and commit**

```bash
bun run format
git add src/lib/links.ts src/lib/blog.ts src/lib/blog.fixture.ts src/lib/blog.test.ts
git commit -m "feat(blog): SITE_ORIGIN and pure manifest/date/url helpers

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: `articleHead` and `blogIndexHead`

**Files:**
- Modify: `src/lib/blog.ts`
- Test: `src/lib/blog.test.ts`

**Interfaces:**
- Consumes: `Article`, `articleUrl`, `BLOG_URL`, `SITE_ORIGIN` (Task 1).
- Produces:
  - `type Head = { meta: AnyRouteMatch["meta"]; links: AnyRouteMatch["links"]; scripts: AnyRouteMatch["headScripts"] }` — exactly the shape a route `head()` returns.
  - `articleHead(article: Article): Head`
  - `blogIndexHead(): Head`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/blog.test.ts` (add `articleHead`, `blogIndexHead` to the import):

```ts
type Tag = Record<string, unknown> | undefined;
const metaOf = (tags: Tag[] | undefined, key: "name" | "property", v: string) =>
	(tags ?? []).find((t) => t?.[key] === v)?.content as string | undefined;
const jsonLdOf = (head: ReturnType<typeof articleHead>, type: string) => {
	const script = (head.scripts ?? []).find((s) =>
		String(s?.children).includes(`"@type":"${type}"`),
	);
	return JSON.parse(String(script?.children)) as Record<string, unknown>;
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
		metaOf(articleHead(fixtureArticle).meta, "property", "article:modified_time"),
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
		{ "@type": "ListItem", position: 1, name: "Home", item: "https://piperbox.dev/" },
		{ "@type": "ListItem", position: 2, name: "Blog", item: "https://piperbox.dev/blog/" },
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
	expect(metaOf(head.meta, "property", "og:url")).toBe("https://piperbox.dev/blog/");
	expect(metaOf(head.meta, "property", "og:type")).toBe("website");
	expect((head.meta ?? []).find((m) => m?.title)?.title).toContain("Piper");
	expect((metaOf(head.meta, "name", "description") ?? "").length).toBeLessThanOrEqual(160);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/lib/blog.test.ts`
Expected: FAIL — `articleHead` / `blogIndexHead` are not exported.

- [ ] **Step 3: Implement the head builders**

Append to `src/lib/blog.ts` (add `import type { AnyRouteMatch } from "@tanstack/react-router";` at the top):

```ts
// Exactly what a route's head() returns, so routes can be one-liners.
export type Head = {
	meta: AnyRouteMatch["meta"];
	links: AnyRouteMatch["links"];
	scripts: AnyRouteMatch["headScripts"];
};

const ORGANIZATION = { "@type": "Organization", name: "Piper", url: SITE_ORIGIN };

// "<" → "\u003c" so a "</script>" inside a title can't terminate the tag.
function jsonLd(data: unknown) {
	return {
		type: "application/ld+json",
		children: JSON.stringify(data).replace(/</g, "\\u003c"),
	};
}

export function articleHead(article: Article): Head {
	const url = articleUrl(article.slug);
	const hasSize = article.cover_width !== null && article.cover_height !== null;
	return {
		meta: [
			{ title: article.meta_title },
			{ name: "description", content: article.meta_description },
			{ property: "og:type", content: "article" },
			{ property: "og:title", content: article.meta_title },
			{ property: "og:description", content: article.meta_description },
			{ property: "og:url", content: url },
			{ property: "og:image", content: article.cover },
			{ property: "og:image:alt", content: article.cover_alt },
			...(hasSize
				? [
						{ property: "og:image:width", content: String(article.cover_width) },
						{ property: "og:image:height", content: String(article.cover_height) },
					]
				: []),
			{ property: "article:published_time", content: article.published_at },
			...(article.updated_at
				? [{ property: "article:modified_time", content: article.updated_at }]
				: []),
			{ name: "twitter:card", content: "summary_large_image" },
			{ name: "twitter:title", content: article.meta_title },
			{ name: "twitter:description", content: article.meta_description },
			{ name: "twitter:image", content: article.cover },
		],
		links: [{ rel: "canonical", href: url }],
		scripts: [
			jsonLd({
				"@context": "https://schema.org",
				"@type": "BlogPosting",
				headline: article.title,
				description: article.meta_description,
				image: article.cover,
				datePublished: article.published_at,
				dateModified: article.updated_at ?? article.published_at,
				keywords: article.keyword,
				url,
				mainEntityOfPage: url,
				author: ORGANIZATION,
				publisher: ORGANIZATION,
			}),
			jsonLd({
				"@context": "https://schema.org",
				"@type": "BreadcrumbList",
				itemListElement: [
					{ "@type": "ListItem", position: 1, name: "Home", item: `${SITE_ORIGIN}/` },
					{ "@type": "ListItem", position: 2, name: "Blog", item: BLOG_URL },
					{ "@type": "ListItem", position: 3, name: article.title, item: url },
				],
			}),
		],
	};
}

const INDEX_TITLE = "Piper blog";
const INDEX_DESCRIPTION =
	"Guides and notes on self-hosting: deploying to your own hardware, custom domains, and running Piper day to day.";

export function blogIndexHead(): Head {
	return {
		meta: [
			{ title: INDEX_TITLE },
			{ name: "description", content: INDEX_DESCRIPTION },
			{ property: "og:type", content: "website" },
			{ property: "og:title", content: INDEX_TITLE },
			{ property: "og:description", content: INDEX_DESCRIPTION },
			{ property: "og:url", content: BLOG_URL },
		],
		links: [{ rel: "canonical", href: BLOG_URL }],
		scripts: [],
	};
}
```

If `tsc` rejects `{ title: ... }` inside `meta`, note that `src/routes/index.tsx` already does exactly this and passes; match its shape.

- [ ] **Step 4: Run the tests and the typecheck**

Run: `bun test src/lib/blog.test.ts && bun run typecheck`
Expected: 16 pass; `tsc` clean.

- [ ] **Step 5: Format and commit**

```bash
bun run format
git add src/lib/blog.ts src/lib/blog.test.ts
git commit -m "feat(blog): article and index head builders with JSON-LD

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: `buildSitemap`

**Files:**
- Create: `src/lib/sitemap.ts`
- Test: `src/lib/sitemap.test.ts`

**Interfaces:**
- Consumes: `Article`, `articleUrl`, `BLOG_URL` (Task 1); `SITE_ORIGIN`; `DocEntry` from `src/content/docs/manifest.ts` (`{ slug: string; title: string }`).
- Produces: `buildSitemap({ articles: Article[]; docs: DocEntry[] }): string`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/sitemap.test.ts`:

```ts
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
			{ ...fixtureArticle, slug: "second", updated_at: "2026-08-20T00:00:00.000Z" },
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
		docs: [{ slug: "getting-started", title: "Getting started" }],
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/lib/sitemap.test.ts`
Expected: FAIL — `Cannot find module "./sitemap"`.

- [ ] **Step 3: Write `src/lib/sitemap.ts`**

```ts
import type { DocEntry } from "@/content/docs/manifest";
import { type Article, articleUrl, BLOG_URL } from "@/lib/blog";
import { SITE_ORIGIN } from "@/lib/links";

type Entry = { loc: string; lastmod?: string };

const XML_ESCAPES: Record<string, string> = {
	"<": "&lt;",
	">": "&gt;",
	"&": "&amp;",
	"'": "&apos;",
	'"': "&quot;",
};

function escapeXml(s: string): string {
	return s.replace(/[<>&'"]/g, (c) => XML_ESCAPES[c] ?? c);
}

// Empty-state pages are not worth listing: /docs and /blog/ only appear
// once they have something to show.
export function buildSitemap({
	articles,
	docs,
}: {
	articles: Article[];
	docs: DocEntry[];
}): string {
	const entries: Entry[] = [{ loc: `${SITE_ORIGIN}/` }];
	if (docs.length > 0) {
		entries.push({ loc: `${SITE_ORIGIN}/docs` });
		for (const doc of docs) entries.push({ loc: `${SITE_ORIGIN}/docs/${doc.slug}` });
	}
	if (articles.length > 0) {
		entries.push({ loc: BLOG_URL });
		for (const article of articles) {
			entries.push({
				loc: articleUrl(article.slug),
				lastmod: article.updated_at ?? article.published_at,
			});
		}
	}
	const urls = entries
		.map((e) => {
			const lastmod = e.lastmod
				? `\n    <lastmod>${escapeXml(e.lastmod)}</lastmod>`
				: "";
			return `  <url>\n    <loc>${escapeXml(e.loc)}</loc>${lastmod}\n  </url>`;
		})
		.join("\n");
	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test src/lib/sitemap.test.ts`
Expected: 4 pass.

- [ ] **Step 5: Format and commit**

```bash
bun run format
git add src/lib/sitemap.ts src/lib/sitemap.test.ts
git commit -m "feat(blog): pure sitemap builder

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Extract `PublicHeader` from `DocsLayout`

**Files:**
- Create: `src/components/public-header.tsx`
- Modify: `src/components/docs-layout.tsx`
- Test: `src/components/public-header.test.tsx`
- Regression gate (unmodified): `src/components/docs-layout.test.tsx`

**Interfaces:**
- Produces: `PublicHeader({ section }: { section: string })` — wordmark → `/`, muted section label, GitHub + dashboard links.

- [ ] **Step 1: Write the failing test**

Create `src/components/public-header.test.tsx`:

```tsx
import { expect, test } from "bun:test";
import {
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { PublicHeader } from "./public-header";

// PublicHeader renders <Link>, which needs a router context to mount.
async function renderHeader(section: string) {
	const rootRoute = createRootRoute({
		component: () => <PublicHeader section={section} />,
	});
	const router = createRouter({ routeTree: rootRoute });
	await router.navigate({ to: "/" });
	// biome-ignore lint/suspicious/noExplicitAny: test router typing shortcut
	render(<RouterProvider router={router as any} />);
}

test("shows the section label", async () => {
	await renderHeader("blog");
	expect(screen.getByText("blog")).toBeTruthy();
});

test("links the wordmark home and the dashboard to /apps", async () => {
	await renderHeader("docs");
	expect(screen.getByRole("link", { name: "piper" }).getAttribute("href")).toBe("/");
	expect(
		screen.getByRole("link", { name: "dashboard" }).getAttribute("href"),
	).toBe("/apps");
});

test("links to the piperbox repo", async () => {
	await renderHeader("docs");
	expect(
		screen.getByRole("link", { name: /github/i }).getAttribute("href"),
	).toBe("https://github.com/piperbox/piper");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/components/public-header.test.tsx`
Expected: FAIL — `Cannot find module "./public-header"`.

- [ ] **Step 3: Create `src/components/public-header.tsx`**

The header markup is lifted verbatim from `DocsLayout`; only the label is a prop.

```tsx
import { Link } from "@tanstack/react-router";
import { REPO_URL } from "@/lib/links";

// Top bar shared by the public, chromeless surfaces (/docs, /blog).
export function PublicHeader({ section }: { section: string }) {
	return (
		<header className="flex items-center gap-4 border-border border-b px-4 py-3 text-xs">
			<Link to="/" className="font-semibold">
				piper
			</Link>
			<span className="text-muted-foreground">{section}</span>
			<div className="ml-auto flex items-center gap-4">
				<a href={REPO_URL} target="_blank" rel="noreferrer">
					github
				</a>
				<Link to="/apps">dashboard</Link>
			</div>
		</header>
	);
}
```

- [ ] **Step 4: Make `DocsLayout` use it**

Replace the whole file `src/components/docs-layout.tsx` with:

```tsx
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { PublicHeader } from "@/components/public-header";
import type { DocEntry } from "@/content/docs/manifest";

export function DocsLayout({
	docs,
	children,
}: {
	docs: DocEntry[];
	children: ReactNode;
}) {
	return (
		<div className="min-h-screen">
			<PublicHeader section="docs" />

			<div className="mx-auto flex max-w-5xl gap-8 px-4 py-8">
				{docs.length > 0 && (
					<nav
						aria-label="Documentation"
						className="hidden w-44 shrink-0 self-start text-xs lg:block"
					>
						<ul className="space-y-1">
							{docs.map((doc) => (
								<li key={doc.slug}>
									<Link to="/docs/$slug" params={{ slug: doc.slug }}>
										{doc.title}
									</Link>
								</li>
							))}
						</ul>
					</nav>
				)}
				<main className="min-w-0 flex-1">{children}</main>
			</div>
		</div>
	);
}
```

(`REPO_URL` import is dropped — it moved with the header.)

- [ ] **Step 5: Run the new test and the docs regression gate**

Run: `bun test src/components/public-header.test.tsx src/components/docs-layout.test.tsx`
Expected: all pass, `docs-layout.test.tsx` unmodified.

- [ ] **Step 6: Format and commit**

```bash
bun run format
git add src/components/public-header.tsx src/components/public-header.test.tsx src/components/docs-layout.tsx
git commit -m "refactor(docs): extract PublicHeader for reuse by the blog

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Extract `markdownComponents` from `DocsPage`

**Files:**
- Create: `src/components/markdown-components.tsx`
- Modify: `src/components/docs-page.tsx`
- Regression gate (unmodified): `src/components/docs-page.test.tsx`, `src/components/docs-toc-anchors.test.tsx`

**Interfaces:**
- Produces: `markdownComponents: Components` (from `react-markdown`) — the styled map for `h2`, `h3`, `p`, `ul`, `ol`, `pre`, `code`, `table`, `th`, `td`. Consumers spread it and add their own overrides.

- [ ] **Step 1: Confirm the regression gate is green before touching anything**

Run: `bun test src/components/docs-page.test.tsx src/components/docs-toc-anchors.test.tsx`
Expected: all pass.

- [ ] **Step 2: Create `src/components/markdown-components.tsx`**

Lifted verbatim from `DocsPage`; `h1` and `a` deliberately stay with each consumer.

```tsx
import type { Components } from "react-markdown";
import { Panel } from "@/components/ui/panel";

// The terminal-styled element map shared by every markdown surface (/docs,
// /blog). h1 and a are intentionally absent: each consumer owns its title
// and its link rewriting.
export const markdownComponents: Components = {
	h2: ({ node, children, ...rest }) => (
		<h2 className="mt-8 mb-3 font-semibold text-base" {...rest}>
			<span className="text-muted-foreground">{"## "}</span>
			{children}
		</h2>
	),
	h3: ({ node, children, ...rest }) => (
		<h3
			className="mt-6 mb-2 font-semibold text-muted-foreground text-sm"
			{...rest}
		>
			{children}
		</h3>
	),
	p: ({ node, ...rest }) => <p className="my-3" {...rest} />,
	ul: ({ node, ...rest }) => (
		<ul className="my-3 list-disc space-y-1 pl-5" {...rest} />
	),
	ol: ({ node, ...rest }) => (
		<ol className="my-3 list-decimal space-y-1 pl-5" {...rest} />
	),
	pre: ({ node, ...rest }) => (
		<Panel className="my-4 overflow-x-auto">
			<pre className="p-3 text-xs" {...rest} />
		</Panel>
	),
	code: ({ node, ...rest }) => (
		<code className="text-primary text-xs" {...rest} />
	),
	table: ({ node, ...rest }) => (
		<div className="my-4 overflow-x-auto">
			<table className="w-full text-left text-xs" {...rest} />
		</div>
	),
	th: ({ node, ...rest }) => (
		<th
			className="border-border border-b px-3 py-2 font-medium text-muted-foreground"
			{...rest}
		/>
	),
	td: ({ node, ...rest }) => (
		<td className="border-border/50 border-b px-3 py-2" {...rest} />
	),
};
```

- [ ] **Step 3: Make `DocsPage` spread it**

In `src/components/docs-page.tsx`:

1. Add `import { markdownComponents } from "@/components/markdown-components";` and remove the now-unused `import { Panel } from "@/components/ui/panel";`.
2. Replace the `components={{ ... }}` prop so only `h1` and `a` remain:

```tsx
				<Markdown
					remarkPlugins={[remarkGfm]}
					rehypePlugins={[rehypeSlug]}
					components={{
						...markdownComponents,
						h1: ({ node, children, ...rest }) => (
							<h1 className="mb-4 font-semibold text-xl" {...rest}>
								<span className="text-muted-foreground">{"# "}</span>
								{children}
							</h1>
						),
						a: ({ href, children }) => (
							<DocLink href={href}>{children}</DocLink>
						),
					}}
				>
					{markdown}
				</Markdown>
```

Everything else in the file is untouched.

- [ ] **Step 4: Run the regression gate and the typecheck**

Run: `bun test src/components/docs-page.test.tsx src/components/docs-toc-anchors.test.tsx && bun run typecheck`
Expected: all pass, `tsc` clean (no unused-import errors).

- [ ] **Step 5: Format and commit**

```bash
bun run format
git add src/components/markdown-components.tsx src/components/docs-page.tsx
git commit -m "refactor(docs): extract the markdown element map for reuse by the blog

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: `BlogLayout` and `BlogIndex`

**Files:**
- Create: `src/components/blog-layout.tsx`, `src/components/blog-index.tsx`
- Test: `src/components/blog-index.test.tsx`

**Interfaces:**
- Consumes: `PublicHeader` (Task 4); `Article`, `formatDate` (Task 1); `PageHeader`, `Panel` (existing `src/components/ui/`).
- Produces:
  - `BlogLayout({ children }: { children: ReactNode })`
  - `BlogIndex({ articles }: { articles: Article[] })`

- [ ] **Step 1: Write the failing tests**

Create `src/components/blog-index.test.tsx`:

```tsx
import { expect, test } from "bun:test";
import {
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import type { Article } from "@/lib/blog";
import { fixtureArticle } from "@/lib/blog.fixture";
import { BlogIndex } from "./blog-index";
import { BlogLayout } from "./blog-layout";

// BlogIndex renders <Link>, which needs a router context to mount. The
// router is built with the same trailingSlash policy as src/router.tsx so
// hrefs keep their slash — the default ("never") would strip it.
async function renderIndex(articles: Article[]) {
	const rootRoute = createRootRoute({
		component: () => (
			<BlogLayout>
				<BlogIndex articles={articles} />
			</BlogLayout>
		),
	});
	const router = createRouter({ routeTree: rootRoute, trailingSlash: "preserve" });
	await router.navigate({ to: "/" });
	// biome-ignore lint/suspicious/noExplicitAny: test router typing shortcut
	render(<RouterProvider router={router as any} />);
}

test("shows an empty state when nothing is published", async () => {
	await renderIndex([]);
	expect(screen.getByText(/nothing published yet/i)).toBeTruthy();
});

test("wraps the page in the public header labelled blog", async () => {
	await renderIndex([]);
	expect(screen.getByText("blog", { selector: "span" })).toBeTruthy();
	expect(screen.getByRole("link", { name: "dashboard" })).toBeTruthy();
});

test("lists articles in manifest order with trailing-slash links, description and date", async () => {
	await renderIndex([
		fixtureArticle,
		{ ...fixtureArticle, slug: "second", title: "Second post" },
	]);
	const links = screen.getAllByRole("link", { name: /How AI|Second post/ });
	expect(links.map((l) => l.textContent)).toEqual([
		"How AI Outfit Generators Work",
		"Second post",
	]);
	expect(links[0].getAttribute("href")).toBe("/blog/ai-outfit-generator/");
	expect(links[1].getAttribute("href")).toBe("/blog/second/");
	expect(
		screen.getAllByText(
			"A plain-language look at how AI turns a photo into an outfit.",
		),
	).toHaveLength(2);
	expect(screen.getAllByText("8 Aug 2026")).toHaveLength(2);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/components/blog-index.test.tsx`
Expected: FAIL — `Cannot find module "./blog-index"`.

- [ ] **Step 3: Create `src/components/blog-layout.tsx`**

```tsx
import type { ReactNode } from "react";
import { PublicHeader } from "@/components/public-header";

export function BlogLayout({ children }: { children: ReactNode }) {
	return (
		<div className="min-h-screen">
			<PublicHeader section="blog" />
			<main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
		</div>
	);
}
```

- [ ] **Step 4: Create `src/components/blog-index.tsx`**

```tsx
import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { type Article, formatDate } from "@/lib/blog";

// Articles arrive newest-first from the manifest; render in the order given.
export function BlogIndex({ articles }: { articles: Article[] }) {
	return (
		<div className="flex flex-col gap-6">
			<PageHeader title="blog" subtitle="Notes on running your own box." />
			{articles.length === 0 ? (
				<Panel className="px-3 py-6 text-muted-foreground text-sm">
					Nothing published yet.
				</Panel>
			) : (
				<ul className="flex flex-col gap-5">
					{articles.map((article) => (
						<li key={article.slug}>
							<Link to="/blog/$slug/" params={{ slug: article.slug }}>
								{article.title}
							</Link>
							<p className="mt-1 text-muted-foreground text-sm">
								{article.meta_description}
							</p>
							<time
								dateTime={article.published_at}
								className="text-muted-foreground text-xs"
							>
								{formatDate(article.published_at)}
							</time>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
```

`to="/blog/$slug/"` will not typecheck until the route exists (Task 8). That is expected; `bun test` does not typecheck. If, in Task 8, `tsc` still rejects the trailing-slash `to`, replace the `Link` with a plain `<a href={`/blog/${article.slug}/`}>` — the contract only cares about the emitted href.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun test src/components/blog-index.test.tsx`
Expected: 3 pass.

- [ ] **Step 6: Format and commit**

```bash
bun run format
git add src/components/blog-layout.tsx src/components/blog-index.tsx src/components/blog-index.test.tsx
git commit -m "feat(blog): layout and index components

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: `BlogArticle` with `rehype-raw`

**Files:**
- Modify: `package.json` (via `bun add`)
- Create: `src/components/blog-article.tsx`
- Test: `src/components/blog-article.test.tsx`

**Interfaces:**
- Consumes: `markdownComponents` (Task 5); `Article`, `formatDate` (Task 1).
- Produces: `BlogArticle({ article, body }: { article: Article; body: string })` — `body` is the Markdown **with frontmatter already stripped**.

- [ ] **Step 1: Install the dependency**

Run: `bun add rehype-raw`
Expected: `package.json` and `bun.lock` updated.

- [ ] **Step 2: Write the failing tests**

Create `src/components/blog-article.test.tsx`:

```tsx
import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import type { Article } from "@/lib/blog";
import { fixtureArticle } from "@/lib/blog.fixture";
import { BlogArticle } from "./blog-article";

const body = [
	"## What an outfit generator actually does",
	"",
	"Body text starts here.",
	"",
	"![Three generated looks side by side](https://cdn.seopotion.com/orgs/abc/articles/123/inline-1.webp)",
	"",
	"![An older image with no size](https://cdn.seopotion.com/orgs/abc/articles/123/inline-2.webp)",
	"",
	'<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="How AI styling works"></iframe>',
	"",
].join("\n");

// No <Link> in BlogArticle, so no router is needed.
function renderArticle(article: Article = fixtureArticle) {
	render(<BlogArticle article={article} body={body} />);
}

test("renders the manifest title as the only h1", () => {
	renderArticle();
	const h1s = screen.getAllByRole("heading", { level: 1 });
	expect(h1s).toHaveLength(1);
	expect(h1s[0].textContent).toContain("How AI Outfit Generators Work");
	expect(
		screen.getByRole("heading", { level: 2 }).textContent,
	).toContain("What an outfit generator actually does");
});

test("renders the cover with its real dimensions", () => {
	renderArticle();
	const cover = screen.getByAltText("A phone showing a generated outfit");
	expect(cover.getAttribute("src")).toBe(fixtureArticle.cover);
	expect(cover.getAttribute("width")).toBe("1216");
	expect(cover.getAttribute("height")).toBe("640");
});

test("omits cover dimensions when the manifest has none", () => {
	renderArticle({ ...fixtureArticle, cover_width: null, cover_height: null });
	const cover = screen.getByAltText("A phone showing a generated outfit");
	expect(cover.getAttribute("width")).toBeNull();
	expect(cover.getAttribute("height")).toBeNull();
});

test("adds width and height to inline images from the manifest, lazily loaded", () => {
	renderArticle();
	const img = screen.getByAltText("Three generated looks side by side");
	expect(img.getAttribute("width")).toBe("1216");
	expect(img.getAttribute("height")).toBe("672");
	expect(img.getAttribute("loading")).toBe("lazy");
});

test("omits inline image dimensions when the manifest size is null", () => {
	renderArticle();
	const img = screen.getByAltText("An older image with no size");
	expect(img.getAttribute("width")).toBeNull();
	expect(img.getAttribute("height")).toBeNull();
});

test("keeps raw iframe embeds instead of printing them as text", () => {
	renderArticle();
	const iframe = document.querySelector("iframe");
	expect(iframe?.getAttribute("src")).toBe(
		"https://www.youtube.com/embed/dQw4w9WgXcQ",
	);
	expect(screen.queryByText(/<iframe/)).toBeNull();
});

test("shows the published date, and the updated date only once republished", () => {
	renderArticle();
	expect(screen.getByText("8 Aug 2026")).toBeTruthy();
	expect(screen.queryByText(/updated/i)).toBeNull();
});

test("shows the updated date after a republish", () => {
	renderArticle({ ...fixtureArticle, updated_at: "2026-08-20T00:00:00.000Z" });
	expect(screen.getByText(/updated 20 Aug 2026/)).toBeTruthy();
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `bun test src/components/blog-article.test.tsx`
Expected: FAIL — `Cannot find module "./blog-article"`.

- [ ] **Step 4: Create `src/components/blog-article.tsx`**

```tsx
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { markdownComponents } from "@/components/markdown-components";
import { type Article, formatDate } from "@/lib/blog";

// Renders one SEO Potion article. The body has no H1 (the title is ours),
// no cover (also ours), and embeds YouTube as a raw <iframe>, so raw HTML
// must be allowed. That HTML is trusted: it is committed into this repo by
// our own SEO Potion account.
export function BlogArticle({
	article,
	body,
}: {
	article: Article;
	body: string;
}) {
	const sizes = new Map(article.images.map((image) => [image.src, image]));

	return (
		<article className="text-sm leading-6">
			<h1 className="mb-2 font-semibold text-xl">
				<span className="text-muted-foreground">{"# "}</span>
				{article.title}
			</h1>
			<p className="mb-6 text-muted-foreground text-xs">
				<time dateTime={article.published_at}>
					{formatDate(article.published_at)}
				</time>
				{article.updated_at && (
					<>
						{" · "}
						<time dateTime={article.updated_at}>
							updated {formatDate(article.updated_at)}
						</time>
					</>
				)}
			</p>
			<img
				src={article.cover}
				alt={article.cover_alt}
				width={article.cover_width ?? undefined}
				height={article.cover_height ?? undefined}
				className="mb-6 h-auto w-full"
			/>
			<Markdown
				remarkPlugins={[remarkGfm]}
				rehypePlugins={[rehypeRaw]}
				components={{
					...markdownComponents,
					// Markdown can't carry dimensions; the manifest can. Skip any
					// whose size is null rather than guessing.
					img: ({ src, alt }) => {
						const size = typeof src === "string" ? sizes.get(src) : undefined;
						return (
							<img
								src={typeof src === "string" ? src : undefined}
								alt={alt ?? ""}
								width={size?.width ?? undefined}
								height={size?.height ?? undefined}
								loading="lazy"
								className="my-4 h-auto max-w-full"
							/>
						);
					},
					iframe: ({ node, ...rest }) => (
						<div className="my-4 aspect-video w-full">
							<iframe className="h-full w-full" {...rest} />
						</div>
					),
				}}
			>
				{body}
			</Markdown>
		</article>
	);
}
```

If Biome flags the `iframe` element for a missing `title`, it is passed through from the embed via `{...rest}`; add `// biome-ignore lint/a11y/useIframeTitle: title comes from the embed` above the line only if the linter complains.

- [ ] **Step 5: Run the tests and the typecheck**

Run: `bun test src/components/blog-article.test.tsx && bun run typecheck`
Expected: 8 pass; `tsc` clean.

- [ ] **Step 6: Format and commit**

```bash
bun run format
git add package.json bun.lock src/components/blog-article.tsx src/components/blog-article.test.tsx
git commit -m "feat(blog): article renderer with raw-HTML embeds and manifest image sizes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Content loader, routes, and router trailing-slash policy

**Files:**
- Create: `src/lib/blog-content.ts`, `src/routes/blog/index.tsx`, `src/routes/blog/$slug/index.tsx`
- Modify: `src/router.tsx`, `biome.json`
- Regenerated: `src/routeTree.gen.ts` (by the Vite plugin / `bun run generate-routes`)

**Interfaces:**
- Consumes: `parseManifest`, `stripFrontmatter`, `articleHead`, `blogIndexHead`, `Article` (Tasks 1–2); `BlogLayout`, `BlogIndex` (Task 6); `BlogArticle` (Task 7).
- Produces: `loadArticles(): Article[]`; `loadBody(slug: string): Promise<string | null>` (**frontmatter already stripped**); routes `/blog/` and `/blog/$slug/`.

This task has no unit test: the loader is quarantined and the routes cannot be tested. Its verification is `tsc`, the build, and real requests against the dev server.

- [ ] **Step 1: Exclude SEO Potion's folder from Biome**

In `biome.json`, add one line to `files.includes`, after the `routeTree.gen.ts` exclusion:

```json
			"!**/src/routeTree.gen.ts",
			"!**/src/content/blog/**",
			"!**/src/styles.css"
```

Reason: SEO Potion commits a 2-space-indented `manifest.json`; `biome ci` would fail formatting on it.

- [ ] **Step 2: Create the quarantined loader `src/lib/blog-content.ts`**

```ts
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
```

- [ ] **Step 3: Set the router's trailing-slash policy**

In `src/router.tsx`, add one option to `createTanStackRouter`:

```ts
	const router = createTanStackRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		// SEO Potion's URL contract is /blog/<slug>/ with the slash. The
		// default ("never") strips it from every generated href; "preserve"
		// keeps each link as written. Every other link in the app is written
		// without a slash and is unaffected.
		trailingSlash: "preserve",
	});
```

- [ ] **Step 4: Create `src/routes/blog/index.tsx`**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { BlogIndex } from "@/components/blog-index";
import { BlogLayout } from "@/components/blog-layout";
import { blogIndexHead } from "@/lib/blog";
import { loadArticles } from "@/lib/blog-content";

// Public, unauthenticated. Same page logged in or out.
export const Route = createFileRoute("/blog/")({
	staticData: { chrome: false },
	head: () => blogIndexHead(),
	loader: () => ({ articles: loadArticles() }),
	component: BlogIndexPage,
});

function BlogIndexPage() {
	const { articles } = Route.useLoaderData();
	return (
		<BlogLayout>
			<BlogIndex articles={articles} />
		</BlogLayout>
	);
}
```

- [ ] **Step 5: Create `src/routes/blog/$slug/index.tsx`**

An index route under `$slug/` so the generated path itself carries the trailing slash.

```tsx
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { BlogArticle } from "@/components/blog-article";
import { BlogLayout } from "@/components/blog-layout";
import { articleHead } from "@/lib/blog";
import { loadArticles, loadBody } from "@/lib/blog-content";

export const Route = createFileRoute("/blog/$slug/")({
	staticData: { chrome: false },
	// Only the trailing-slash form is canonical; send the other one there.
	beforeLoad: ({ location }) => {
		if (!location.pathname.endsWith("/")) {
			throw redirect({ href: `${location.pathname}/`, statusCode: 301 });
		}
	},
	loader: async ({ params }) => {
		const article = loadArticles().find((a) => a.slug === params.slug);
		if (!article) throw notFound();
		const body = await loadBody(params.slug);
		if (body === null) throw notFound();
		return { article, body };
	},
	head: ({ loaderData }) =>
		loaderData ? articleHead(loaderData.article) : {},
	component: ArticlePage,
});

function ArticlePage() {
	const { article, body } = Route.useLoaderData();
	return (
		<BlogLayout>
			<BlogArticle article={article} body={body} />
		</BlogLayout>
	);
}
```

- [ ] **Step 6: Regenerate the route tree and typecheck**

Run: `bun run generate-routes && bun run typecheck`
Expected: `src/routeTree.gen.ts` gains `/blog/` and `/blog/$slug/`; `tsc` clean. The generator may rewrite the `createFileRoute("...")` string literals — accept what it writes.

If `tsc` rejects `to="/blog/$slug/"` in `blog-index.tsx`, apply the fallback noted in Task 6 Step 4 (plain `<a href>`), and keep the router change (it is still what makes `Link`-free navigation land on the slash form).

- [ ] **Step 7: Verify at zero articles**

Run: `bun test && bun run build`
Expected: every test passes; the build succeeds with no `src/content/blog/` directory present.

- [ ] **Step 8: Verify the routes against the dev server with a throwaway fixture**

Create the fixture (do **not** `git add` it):

```bash
mkdir -p src/content/blog/articles
cat > src/content/blog/manifest.json <<'EOF'
{
  "version": 1,
  "generated_at": "2026-08-08T10:15:00.000Z",
  "articles": [
    {
      "slug": "ai-outfit-generator",
      "title": "How AI Outfit Generators Work",
      "meta_title": "How AI Outfit Generators Work | Guide",
      "meta_description": "A plain-language look at how AI turns a photo into an outfit.",
      "keyword": "ai outfit generator",
      "cover": "https://cdn.seopotion.com/orgs/abc/articles/123/cover.webp",
      "cover_alt": "A phone showing a generated outfit",
      "cover_width": 1216,
      "cover_height": 640,
      "images": [],
      "published_at": "2026-08-08T10:15:00.000Z",
      "updated_at": null,
      "path": "src/content/blog/articles/ai-outfit-generator.md"
    }
  ]
}
EOF
cat > src/content/blog/articles/ai-outfit-generator.md <<'EOF'
---
slug: "ai-outfit-generator"
title: "How AI Outfit Generators Work"
---
## What an outfit generator actually does

Body text starts here.

<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="How AI styling works"></iframe>
EOF
```

Start the dev server in the background (`bun run dev`), then:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/blog/
curl -s http://localhost:3000/blog/ | grep -o 'href="/blog/ai-outfit-generator/"'
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/blog/ai-outfit-generator/
curl -s http://localhost:3000/blog/ai-outfit-generator/ | grep -o '<link rel="canonical" href="https://piperbox.dev/blog/ai-outfit-generator/"'
curl -s http://localhost:3000/blog/ai-outfit-generator/ | grep -c 'application/ld+json'
curl -s http://localhost:3000/blog/ai-outfit-generator/ | grep -o '<iframe[^>]*youtube[^>]*>'
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:3000/blog/ai-outfit-generator
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/blog/nope/
```

Expected, line by line: `200`; the href match; `200`; the canonical match; `2`; an iframe tag; `301 http://localhost:3000/blog/ai-outfit-generator/`; `404`.

If the slash-less request returns `404` instead of `301`, the index route did not match the slash-less path. That is acceptable under the contract ("may redirect … must never fall through to the homepage"); record it in the commit message and move on.

Stop the dev server. **Delete the fixture:**

```bash
rm -rf src/content/blog
git status --short   # must not list anything under src/content/blog
```

- [ ] **Step 9: Format and commit**

```bash
bun run format
git add biome.json src/router.tsx src/lib/blog-content.ts src/routes/blog src/routeTree.gen.ts
git commit -m "feat(blog): /blog/ and /blog/\$slug/ routes over SEO Potion's committed content

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: `sitemap.xml` route and `robots.txt`

**Files:**
- Create: `src/routes/sitemap[.]xml.ts`
- Modify: `public/robots.txt`
- Regenerated: `src/routeTree.gen.ts`

**Interfaces:**
- Consumes: `buildSitemap` (Task 3); `loadArticles` (Task 8); `DOCS` from `src/content/docs/manifest.ts`.

- [ ] **Step 1: Create `src/routes/sitemap[.]xml.ts`**

Same shape as `src/routes/api/auth/session.ts`. The `[.]` escapes the dot so the route path is `/sitemap.xml`.

```ts
import { createFileRoute } from "@tanstack/react-router";
import { DOCS } from "@/content/docs/manifest";
import { loadArticles } from "@/lib/blog-content";
import { buildSitemap } from "@/lib/sitemap";

export const Route = createFileRoute("/sitemap.xml")({
	server: {
		handlers: {
			GET: () =>
				new Response(buildSitemap({ articles: loadArticles(), docs: DOCS }), {
					headers: { "Content-Type": "application/xml; charset=utf-8" },
				}),
		},
	},
});
```

- [ ] **Step 2: Add the sitemap line to `public/robots.txt`**

Append so the file reads:

```
# https://www.robotstxt.org/robotstxt.html
User-agent: *
Disallow:
Sitemap: https://piperbox.dev/sitemap.xml
```

- [ ] **Step 3: Regenerate, typecheck, and verify against the dev server**

Run: `bun run generate-routes && bun run typecheck`
Expected: `tsc` clean; the generator may rewrite the `createFileRoute` literal — accept it.

Start `bun run dev` in the background, then:

```bash
curl -s -D - http://localhost:3000/sitemap.xml | grep -i -o 'content-type: application/xml[^\r]*'
curl -s http://localhost:3000/sitemap.xml
curl -s http://localhost:3000/robots.txt | grep Sitemap
```

Expected: the XML content type; a `urlset` containing exactly `<loc>https://piperbox.dev/</loc>` (docs manifest and blog are both empty); the `Sitemap:` line. Stop the dev server.

- [ ] **Step 4: Format and commit**

```bash
bun run format
git add "src/routes/sitemap[.]xml.ts" public/robots.txt src/routeTree.gen.ts
git commit -m "feat(blog): sitemap.xml route and robots Sitemap line

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Link the blog from the landing page

**Files:**
- Modify: `src/components/landing-page.tsx` (`Header` nav, `Footer` links)
- Test: `src/components/landing-page.test.tsx`

**Interfaces:**
- Consumes: the `/blog/` route (Task 8).

- [ ] **Step 1: Write the failing test**

Append to `src/components/landing-page.test.tsx` (it already has `renderLanding` and the router imports):

```tsx
test("links to the blog from the nav and the footer", async () => {
	await renderLanding();
	const links = screen.getAllByRole("link", { name: "blog" });
	expect(links).toHaveLength(2);
	for (const link of links) {
		expect(link.getAttribute("href")).toBe("/blog/");
	}
});
```

Note: `renderLanding` builds its router with the default trailing-slash policy. If this test sees `/blog` (no slash) while the app itself is correct, change `createRouter({ routeTree: rootRoute })` in `renderLanding` to `createRouter({ routeTree: rootRoute, trailingSlash: "preserve" })` — the same policy `src/router.tsx` uses.

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/components/landing-page.test.tsx`
Expected: the new test FAILS — no links named "blog".

- [ ] **Step 3: Add the links**

In `src/components/landing-page.tsx`, inside `Header`'s `<nav>`, after the `docs` anchor:

```tsx
				<Link className="text-muted-foreground" to="/blog/">
					blog
				</Link>
```

Inside `Footer`'s `<span className="ml-auto flex gap-[18px]">`, after the `docs` anchor and before the `sign in` link:

```tsx
					<Link className="text-muted-foreground" to="/blog/">
						blog
					</Link>
```

`Link` is already imported in this file.

- [ ] **Step 4: Run the landing tests and the typecheck**

Run: `bun test src/components/landing-page.test.tsx && bun run typecheck`
Expected: all pass; `tsc` clean. If `tsc` rejects `to="/blog/"`, use `<a className="text-muted-foreground" href="/blog/">blog</a>` in both places instead.

- [ ] **Step 5: Format and commit**

```bash
bun run format
git add src/components/landing-page.tsx src/components/landing-page.test.tsx
git commit -m "feat(landing): link the blog from the nav and footer

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: End-to-end verification against the production build

**Files:** none committed. A throwaway fixture is created and deleted.

- [ ] **Step 1: Full gate at zero articles**

Run: `bun run verify`
Expected: Biome clean, `tsc` clean, all tests pass, build succeeds — with no `src/content/blog/` directory.

- [ ] **Step 2: Build with a fixture and run the production server**

Recreate the fixture from Task 8 Step 8 (same two `cat > … <<'EOF'` blocks), then:

```bash
bun run build
PORT=8080 bun .output/server/index.mjs
```

(Run the server in the background.)

- [ ] **Step 3: Exercise the contract against the real server**

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/blog/
curl -s http://localhost:8080/blog/ | grep -o 'href="/blog/ai-outfit-generator/"'
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/blog/ai-outfit-generator/
curl -s http://localhost:8080/blog/ai-outfit-generator/ | grep -c 'application/ld+json'
curl -s http://localhost:8080/blog/ai-outfit-generator/ | grep -o 'rel="canonical" href="https://piperbox.dev/blog/ai-outfit-generator/"'
curl -s http://localhost:8080/blog/ai-outfit-generator/ | grep -o 'property="og:url" content="https://piperbox.dev/blog/ai-outfit-generator/"'
curl -s http://localhost:8080/blog/ai-outfit-generator/ | grep -o '<iframe[^>]*youtube[^>]*>'
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:8080/blog/ai-outfit-generator
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/blog/nope/
curl -s -D - -o /dev/null http://localhost:8080/sitemap.xml | grep -i 'content-type'
curl -s http://localhost:8080/sitemap.xml | grep -o '<loc>[^<]*</loc>'
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/docs
```

Expected: `200`; the href; `200`; `2`; the canonical; the `og:url`; an iframe; `301 …/blog/ai-outfit-generator/` (or `404`, if Task 8 recorded that the slash-less form does not match — never `200`); `404`; `application/xml`; three `<loc>` lines — `/`, `/blog/`, `/blog/ai-outfit-generator/`; `200` (docs unaffected).

Stop the server.

- [ ] **Step 4: Remove the fixture and re-verify**

```bash
rm -rf src/content/blog
git status --short   # nothing under src/content/blog
bun run verify
```

Expected: `git status` shows nothing under `src/content/blog`; `verify` passes.

- [ ] **Step 5: Push and open the PR**

```bash
git push -u origin HEAD
gh pr create --base main --title "[app] blog section published by SEO Potion" --body "$(cat <<'EOF'
Public /blog/ rendering articles that SEO Potion commits into src/content/blog/ via its GitHub custom-site integration, plus the SEO output the contract leaves to the site: canonical, Open Graph/Twitter, BlogPosting + BreadcrumbList JSON-LD, sitemap.xml, robots Sitemap line.

Spec: docs/superpowers/specs/2026-09-10-blog-seo-potion-design.md

- Quarantined import.meta.glob loader; build is green with no content committed.
- /blog/<slug>/ with trailing slash (router trailingSlash: "preserve"); slash-less form redirects; unknown slug is a real 404.
- PublicHeader and the markdown element map extracted from the docs components; /docs unchanged (existing docs tests are the regression gate).
- New dependency: rehype-raw (YouTube iframes in bodies).

After merge, connect SEO Potion with: branch main, content folder src/content/blog, post URL base https://piperbox.dev/blog.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review

**Spec coverage.** Content/loading → Task 8. Types and pure helpers → Task 1. Routes, redirect, 404, `preserve` → Task 8. `PublicHeader` and markdown map extractions → Tasks 4, 5. `BlogLayout`/`BlogIndex`/`BlogArticle` incl. img sizes, iframe box, dates, cover → Tasks 6, 7. `SITE_ORIGIN` → Task 1. `articleHead`/`blogIndexHead`/JSON-LD/escaping → Task 2. `buildSitemap` + route + robots → Tasks 3, 9. Landing links → Task 10. `rehype-raw` → Task 7. Biome exclusion (not in spec; required so `biome ci` survives SEO Potion's JSON) → Task 8 Step 1. Manual end-to-end + zero-article gate → Tasks 8, 11. Success criteria 1–4 → Task 11.

**Type consistency.** `Article`/`ArticleImage` (T1) used by T2, T3, T6, T7, T8. `Head` (T2) returned by both head builders and consumed by T8 routes. `loadBody` returns stripped body (T8) and `BlogArticle` documents that it expects a stripped body (T7). `buildSitemap({ articles, docs })` (T3) matches the call in T9. `PublicHeader({ section })` (T4) used by T6's `BlogLayout`. `markdownComponents` (T5) used by T7. `fixtureArticle` lives in `src/lib/blog.fixture.ts` (T1) and is imported by T2, T3, T6, T7 tests.

**Known uncertainty, with fallbacks in place.** Whether `to="/blog/$slug/"` typechecks (fallback: plain anchor, T6/T8/T10) and whether the index route matches the slash-less path (fallback: 404 is contract-acceptable, T8 Step 8).
