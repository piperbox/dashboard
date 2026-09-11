import { createFileRoute } from "@tanstack/react-router";
import { DocsIndex } from "@/components/docs-index";
import { DocsLayout } from "@/components/docs-layout";
import manifest from "@/content/docs/manifest.json";
import { allPages, leadParagraph } from "@/lib/docs";
import { loadDoc } from "@/lib/docs-content";

export const Route = createFileRoute("/docs/")({
	staticData: { chrome: false },
	loader: async () => {
		const entries = await Promise.all(
			allPages(manifest).map(async (doc) => {
				const md = await loadDoc(doc.slug);
				return [doc.slug, md ? leadParagraph(md) : ""] as const;
			}),
		);
		return { leads: Object.fromEntries(entries) };
	},
	component: DocsIndexPage,
});

function DocsIndexPage() {
	const { leads } = Route.useLoaderData();
	return (
		<DocsLayout sections={manifest.sections}>
			<DocsIndex sections={manifest.sections} leads={leads} />
		</DocsLayout>
	);
}
