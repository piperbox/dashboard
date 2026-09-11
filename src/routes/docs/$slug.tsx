import { createFileRoute, notFound } from "@tanstack/react-router";
import { DocsLayout } from "@/components/docs-layout";
import { DocsPage } from "@/components/docs-page";
import manifest from "@/content/docs/manifest.json";
import { allPages, docHead } from "@/lib/docs";
import { loadDoc } from "@/lib/docs-content";

export const Route = createFileRoute("/docs/$slug")({
	staticData: { chrome: false },
	loader: async ({ params }) => {
		const page = allPages(manifest).find((doc) => doc.slug === params.slug);
		const markdown = page ? await loadDoc(params.slug) : null;
		if (!page || !markdown) throw notFound();
		return { markdown, file: page.file };
	},
	head: ({ params }) => docHead(params.slug),
	component: DocPage,
});

function DocPage() {
	const { markdown, file } = Route.useLoaderData();
	return (
		<DocsLayout sections={manifest.sections}>
			<DocsPage markdown={markdown} file={file} docs={allPages(manifest)} />
		</DocsLayout>
	);
}
