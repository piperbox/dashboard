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
