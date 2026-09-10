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
