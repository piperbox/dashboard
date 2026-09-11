import { createFileRoute } from "@tanstack/react-router";
import manifest from "@/content/docs/manifest.json";
import { allPages } from "@/lib/docs";
import { loadLeads } from "@/lib/docs-content";
import { buildLlmsTxt } from "@/lib/llms";

export const Route = createFileRoute("/llms.txt")({
	server: {
		handlers: {
			GET: async () =>
				new Response(
					buildLlmsTxt(manifest, await loadLeads(allPages(manifest))),
					{ headers: { "Content-Type": "text/plain; charset=utf-8" } },
				),
		},
	},
});
