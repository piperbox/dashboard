import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import Markdown from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { Panel } from "@/components/ui/panel";
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
						h1: ({ node, children, ...rest }) => (
							<h1 className="mb-4 font-semibold text-xl" {...rest}>
								<span className="text-muted-foreground">{"# "}</span>
								{children}
							</h1>
						),
						h2: ({ node, children, ...rest }) => (
							<h2 className="mt-8 mb-3 font-semibold text-base" {...rest}>
								<span className="text-muted-foreground">{"## "}</span>
								{children}
							</h2>
						),
						h3: ({ node, children, ...rest }) => (
							<h3
								className="mt-6 mb-2 font-semibold text-muted-foreground text-sm"
								{...rest}
							>
								{children}
							</h3>
						),
						p: ({ node, ...rest }) => <p className="my-3" {...rest} />,
						ul: ({ node, ...rest }) => (
							<ul className="my-3 list-disc space-y-1 pl-5" {...rest} />
						),
						ol: ({ node, ...rest }) => (
							<ol className="my-3 list-decimal space-y-1 pl-5" {...rest} />
						),
						pre: ({ node, ...rest }) => (
							<Panel className="my-4 overflow-x-auto">
								<pre className="p-3 text-xs" {...rest} />
							</Panel>
						),
						code: ({ node, ...rest }) => (
							<code className="text-primary text-xs" {...rest} />
						),
						a: ({ href, children }) => (
							<DocLink href={href}>{children}</DocLink>
						),
						table: ({ node, ...rest }) => (
							<div className="my-4 overflow-x-auto">
								<table className="w-full text-left text-xs" {...rest} />
							</div>
						),
						th: ({ node, ...rest }) => (
							<th
								className="border-border border-b px-3 py-2 font-medium text-muted-foreground"
								{...rest}
							/>
						),
						td: ({ node, ...rest }) => (
							<td className="border-border/50 border-b px-3 py-2" {...rest} />
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
