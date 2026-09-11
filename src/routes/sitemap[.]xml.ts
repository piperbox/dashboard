import { createFileRoute } from "@tanstack/react-router";
import manifest from "@/content/docs/manifest.json";
import { loadArticles } from "@/lib/blog-content";
import { allPages } from "@/lib/docs";
import { buildSitemap } from "@/lib/sitemap";

export const Route = createFileRoute("/sitemap.xml")({
	server: {
		handlers: {
			GET: () =>
				new Response(
					buildSitemap({ articles: loadArticles(), docs: allPages(manifest) }),
					{ headers: { "Content-Type": "application/xml; charset=utf-8" } },
				),
		},
	},
});
