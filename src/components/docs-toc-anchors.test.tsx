import { expect, test } from "bun:test";
import {
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { extractHeadings } from "@/lib/docs";
import { DocsPage } from "./docs-page";

// The table of contents links to anchors that rehype-slug generates during
// render, but `extractHeadings` computes those ids independently. If the two
// ever disagree on WHICH headings exist, github-slugger's dedupe counters
// desync and every subsequent anchor on the page silently points nowhere.
//
// This renders each fixture and asserts the ids the TOC will emit are exactly
// the ids present in the rendered document, in order.
async function renderedHeadingIds(markdown: string): Promise<string[]> {
	const rootRoute = createRootRoute({
		component: () => <DocsPage markdown={markdown} />,
	});
	const router = createRouter({ routeTree: rootRoute });
	await router.navigate({ to: "/" });
	// biome-ignore lint/suspicious/noExplicitAny: test router typing shortcut
	const { container } = render(<RouterProvider router={router as any} />);
	return [...container.querySelectorAll("article h2[id], article h3[id]")].map(
		(el) => el.id,
	);
}

const FIXTURES: Record<string, string> = {
	"plain atx headings": "# Title\n\n## Install\n\n### Linux\n",
	"repeated text needing dedupe": "# Setup\n\n## Setup\n\n## Setup\n",
	"an h1 that shares text with a later h2": "# Setup\n\n## Setup\n",
	"setext headings": "Title\n=====\n\nSection\n-------\n\n## After\n",
	"atx closing sequences": "# T #\n\n## Heading ##\n\n### Deeper ###\n",
	"a link inside a heading": "# T\n\n## See [the guide](getting-started.md)\n",
	"emphasis inside a heading":
		"# T\n\n## The _fast_ path\n\n### A `code` span\n",
	"a heading inside a code fence":
		"## Real\n\n```bash\n# install the App on your repo\n```\n\n## Also real\n",
	"an indented code block": "## Real\n\n    # not a heading\n\n## Also real\n",
};

for (const [name, markdown] of Object.entries(FIXTURES)) {
	test(`toc ids match rendered anchor ids: ${name}`, async () => {
		const rendered = await renderedHeadingIds(markdown);
		const fromExtract = extractHeadings(markdown).map((h) => h.id);
		expect(fromExtract).toEqual(rendered);
	});
}
