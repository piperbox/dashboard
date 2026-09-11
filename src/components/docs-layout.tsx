import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { PublicHeader } from "@/components/public-header";
import type { Section } from "@/lib/docs";

export function DocsLayout({
	sections,
	children,
}: {
	sections: Section[];
	children: ReactNode;
}) {
	return (
		<div className="min-h-screen">
			<PublicHeader section="docs" />

			<div className="mx-auto flex max-w-5xl gap-8 px-4 py-8">
				{sections.length > 0 && (
					<nav
						aria-label="Documentation"
						className="hidden w-44 shrink-0 self-start text-xs lg:block"
					>
						{sections.map((section) => (
							<div key={section.title} className="mb-4">
								<div className="mb-2 text-[11px] text-muted-foreground uppercase tracking-wider">
									{section.title}
								</div>
								<ul className="space-y-1">
									{section.pages.map((doc) => (
										<li key={doc.slug}>
											<Link to="/docs/$slug" params={{ slug: doc.slug }}>
												{doc.title}
											</Link>
										</li>
									))}
								</ul>
							</div>
						))}
					</nav>
				)}
				<main className="min-w-0 flex-1">{children}</main>
			</div>
		</div>
	);
}
