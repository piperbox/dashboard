import type { AnyRouteMatch } from "@tanstack/react-router";
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

// Exactly what a route's head() returns, so routes can be one-liners.
export type Head = {
	meta: AnyRouteMatch["meta"];
	links: AnyRouteMatch["links"];
	scripts: AnyRouteMatch["headScripts"];
};

const ORGANIZATION = {
	"@type": "Organization",
	name: "Piper",
	url: SITE_ORIGIN,
};

// "<" → "<" so a "</script>" inside a title can't terminate the tag.
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
						{
							property: "og:image:width",
							content: String(article.cover_width),
						},
						{
							property: "og:image:height",
							content: String(article.cover_height),
						},
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
					{
						"@type": "ListItem",
						position: 1,
						name: "Home",
						item: `${SITE_ORIGIN}/`,
					},
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
