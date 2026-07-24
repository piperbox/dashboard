import { createFileRoute } from "@tanstack/react-router";
import { DocsIndex } from "@/components/docs-index";
import { DocsLayout } from "@/components/docs-layout";
import { DOCS } from "@/content/docs/manifest";
import { leadParagraph } from "@/lib/docs";
import { loadDoc } from "@/lib/docs-content";

export const Route = createFileRoute("/docs/")({
	staticData: { chrome: false },
	loader: async () => {
		const entries = await Promise.all(
			DOCS.map(async (doc) => {
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
		<DocsLayout docs={DOCS}>
			<DocsIndex docs={DOCS} leads={leads} />
		</DocsLayout>
	);
}
