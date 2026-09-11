import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import type { Section } from "@/lib/docs";

export function DocsIndex({
	sections,
	leads,
}: {
	sections: Section[];
	leads: Record<string, string>;
}) {
	return (
		<div className="flex flex-col gap-6">
			<PageHeader
				title="docs"
				subtitle="Guides and reference for running piper."
			/>
			{sections.length === 0 ? (
				<Panel className="px-3 py-6 text-muted-foreground text-sm">
					No docs published yet — read them on GitHub in the meantime.
				</Panel>
			) : (
				sections.map((section) => (
					<section key={section.title} className="flex flex-col gap-4">
						<h2 className="text-[11px] text-muted-foreground uppercase tracking-wider">
							{section.title}
						</h2>
						<ul className="flex flex-col gap-4">
							{section.pages.map((doc) => (
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
					</section>
				))
			)}
		</div>
	);
}
