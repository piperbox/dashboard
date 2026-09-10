import type { Article } from "@/lib/blog";

// One article shaped exactly like SEO Potion's manifest entry, with both a
// sized and an unsized inline image.
export const fixtureArticle: Article = {
	slug: "ai-outfit-generator",
	title: "How AI Outfit Generators Work",
	meta_title: "How AI Outfit Generators Work | Guide",
	meta_description:
		"A plain-language look at how AI turns a photo into an outfit.",
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
