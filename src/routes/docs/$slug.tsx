import { createFileRoute, notFound } from "@tanstack/react-router";
import { DocsLayout } from "@/components/docs-layout";
import { DocsPage } from "@/components/docs-page";
import { DOCS } from "@/content/docs/manifest";
import { docSources } from "@/lib/docs-content";

export const Route = createFileRoute("/docs/$slug")({
	staticData: { chrome: false },
	loader: ({ params }) => {
		const markdown = docSources()[params.slug];
		if (!markdown) throw notFound();
		return { markdown };
	},
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
