import type { Components } from "react-markdown";
import { Panel } from "@/components/ui/panel";

// The terminal-styled element map shared by every markdown surface (/docs,
// /blog). h1 and a are intentionally absent: each consumer owns its title
// and its link rewriting.
export const markdownComponents: Components = {
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
};
