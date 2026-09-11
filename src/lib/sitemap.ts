import { type Article, articleUrl, BLOG_URL } from "@/lib/blog";
import type { DocEntry } from "@/lib/docs";
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
		for (const doc of docs)
			entries.push({ loc: `${SITE_ORIGIN}/docs/${doc.slug}` });
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
