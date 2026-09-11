import { createFileRoute, notFound } from "@tanstack/react-router";
import { DocsLayout } from "@/components/docs-layout";
import { DocsPage } from "@/components/docs-page";
import manifest from "@/content/docs/manifest.json";
import { docHead } from "@/lib/docs";
import { loadDoc } from "@/lib/docs-content";

export const Route = createFileRoute("/docs/$slug")({
	staticData: { chrome: false },
	loader: async ({ params }) => {
		const markdown = await loadDoc(params.slug);
		if (!markdown) throw notFound();
		return { markdown };
	},
	head: ({ params }) => docHead(params.slug),
	component: DocPage,
});

function DocPage() {
	const { markdown } = Route.useLoaderData();
	return (
		<DocsLayout sections={manifest.sections}>
			<DocsPage markdown={markdown} />
		</DocsLayout>
	);
}
