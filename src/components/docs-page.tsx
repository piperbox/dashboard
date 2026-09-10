import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import Markdown from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { markdownComponents } from "@/components/markdown-components";
import { docHref, extractHeadings } from "@/lib/docs";

function DocLink({ href, children }: { href?: string; children?: ReactNode }) {
	const link = docHref(href ?? "");
	if (link.external) {
		return (
			<a href={link.href} target="_blank" rel="noreferrer">
				{children}
			</a>
		);
	}
	// Bare in-page anchors (e.g. "#install") aren't a route TanStack Router
	// knows about — Link would resolve them against the current route ("/").
	if (link.href.startsWith("#")) {
		return <a href={link.href}>{children}</a>;
	}
	return <Link to={link.href}>{children}</Link>;
}

export function DocsPage({ markdown }: { markdown: string }) {
	const headings = extractHeadings(markdown);

	return (
		<div className="flex gap-8">
			<article className="min-w-0 flex-1 text-sm leading-6">
				<Markdown
					remarkPlugins={[remarkGfm]}
					rehypePlugins={[rehypeSlug]}
					components={{
						...markdownComponents,
						h1: ({ node, children, ...rest }) => (
							<h1 className="mb-4 font-semibold text-xl" {...rest}>
								<span className="text-muted-foreground">{"# "}</span>
								{children}
							</h1>
						),
						a: ({ href, children }) => (
							<DocLink href={href}>{children}</DocLink>
						),
					}}
				>
					{markdown}
				</Markdown>
			</article>

			{headings.length > 0 && (
				<nav
					aria-label="On this page"
					className="hidden w-48 shrink-0 self-start text-xs lg:block"
				>
					<div className="mb-2 text-[11px] text-muted-foreground uppercase tracking-wider">
						On this page
					</div>
					<ul className="space-y-1">
						{headings.map((h) => (
							<li key={h.id} className={h.depth === 3 ? "pl-3" : undefined}>
								<a href={`#${h.id}`}>{h.text}</a>
							</li>
						))}
					</ul>
				</nav>
			)}
		</div>
	);
}
