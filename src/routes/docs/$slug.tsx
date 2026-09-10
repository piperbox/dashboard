import { createFileRoute, notFound } from "@tanstack/react-router";
import { DocsLayout } from "@/components/docs-layout";
import { DocsPage } from "@/components/docs-page";
import { DOCS } from "@/content/docs/manifest";
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
		<DocsLayout docs={DOCS}>
			<DocsPage markdown={markdown} />
		</DocsLayout>
	);
}
