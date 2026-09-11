import { createFileRoute } from "@tanstack/react-router";
import { DocsIndex } from "@/components/docs-index";
import { DocsLayout } from "@/components/docs-layout";
import manifest from "@/content/docs/manifest.json";
import { allPages, docsIndexHead } from "@/lib/docs";
import { loadLeads } from "@/lib/docs-content";

export const Route = createFileRoute("/docs/")({
	staticData: { chrome: false },
	head: () => docsIndexHead(allPages(manifest)),
	loader: async () => ({ leads: await loadLeads(allPages(manifest)) }),
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
