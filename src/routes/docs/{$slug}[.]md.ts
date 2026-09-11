import { createFileRoute } from "@tanstack/react-router";
import { loadDoc } from "@/lib/docs-content";

// The bytes the sync wrote, for agents that want markdown rather than HTML.
// Vite's dev server answers *.md URLs itself unless the request accepts
// text/html; the production build serves this route to every client.
export const Route = createFileRoute("/docs/{$slug}.md")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				const markdown = await loadDoc(params.slug);
				if (markdown === null) {
					return new Response("not found", { status: 404 });
				}
				return new Response(markdown, {
					headers: { "Content-Type": "text/plain; charset=utf-8" },
				});
			},
		},
	},
});
