import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import type { DocEntry } from "@/content/docs/manifest";

export function DocsIndex({
	docs,
	leads,
}: {
	docs: DocEntry[];
	leads: Record<string, string>;
}) {
	return (
		<div className="flex flex-col gap-6">
			<PageHeader title="docs" subtitle="Guides for running piper." />
			{docs.length === 0 ? (
				<Panel className="px-3 py-6 text-muted-foreground text-sm">
					No docs published yet — read them on GitHub in the meantime.
				</Panel>
			) : (
				<ul className="flex flex-col gap-4">
					{docs.map((doc) => (
						<li key={doc.slug}>
							<Link to="/docs/$slug" params={{ slug: doc.slug }}>
								{doc.title}
							</Link>
							{leads[doc.slug] && (
								<p className="mt-1 text-muted-foreground text-sm">
									{leads[doc.slug]}
								</p>
							)}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
