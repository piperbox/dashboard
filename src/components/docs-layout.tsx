import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { DocEntry } from "@/content/docs/manifest";
import { REPO_URL } from "@/lib/links";

export function DocsLayout({
	docs,
	children,
}: {
	docs: DocEntry[];
	children: ReactNode;
}) {
	return (
		<div className="min-h-screen">
			<header className="flex items-center gap-4 border-border border-b px-4 py-3 text-xs">
				<Link to="/" className="font-semibold">
					piper
				</Link>
				<span className="text-muted-foreground">docs</span>
				<div className="ml-auto flex items-center gap-4">
					<a href={REPO_URL} target="_blank" rel="noreferrer">
						github
					</a>
					<Link to="/apps">dashboard</Link>
				</div>
			</header>

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
