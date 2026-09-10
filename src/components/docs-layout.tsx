import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { PublicHeader } from "@/components/public-header";
import type { DocEntry } from "@/content/docs/manifest";

export function DocsLayout({
	docs,
	children,
}: {
	docs: DocEntry[];
	children: ReactNode;
}) {
	return (
		<div className="min-h-screen">
			<PublicHeader section="docs" />

			<div className="mx-auto flex max-w-5xl gap-8 px-4 py-8">
				{docs.length > 0 && (
					<nav
						aria-label="Documentation"
						className="hidden w-44 shrink-0 self-start text-xs lg:block"
					>
						<ul className="space-y-1">
							{docs.map((doc) => (
								<li key={doc.slug}>
									<Link to="/docs/$slug" params={{ slug: doc.slug }}>
										{doc.title}
									</Link>
								</li>
							))}
						</ul>
					</nav>
				)}
				<main className="min-w-0 flex-1">{children}</main>
			</div>
		</div>
	);
}
