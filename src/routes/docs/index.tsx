import { createFileRoute } from "@tanstack/react-router";
import { DocsIndex } from "@/components/docs-index";
import { DocsLayout } from "@/components/docs-layout";
import { DOCS } from "@/content/docs/manifest";
import { leadParagraph } from "@/lib/docs";
import { docSources } from "@/lib/docs-content";

export const Route = createFileRoute("/docs/")({
	staticData: { chrome: false },
	component: DocsIndexPage,
});

function DocsIndexPage() {
	const sources = docSources();
	const leads = Object.fromEntries(
		DOCS.map((doc) => [doc.slug, leadParagraph(sources[doc.slug] ?? "")]),
	);
	return (
		<DocsLayout docs={DOCS}>
			<DocsIndex docs={DOCS} leads={leads} />
		</DocsLayout>
	);
}
