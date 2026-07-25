import GithubSlugger from "github-slugger";
import { toString as mdastToString } from "mdast-util-to-string";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { REPO_URL } from "@/lib/links";

export type DocLink = { href: string; external: boolean };

// Upstream markdown is written for GitHub, so its links are relative to
// docs/ in the piper repo. A sibling *.md file has a site equivalent;
// everything else (including .md files in subdirectories, which aren't
// synced) only exists in the repo, so it points back at GitHub.
export function docHref(href: string): DocLink {
	if (/^https?:\/\//.test(href)) return { href, external: true };
	if (href.startsWith("#")) return { href, external: false };

	const [path, anchor] = href.split("#");
	if (path.endsWith(".md") && !path.includes("/")) {
		const slug = path.slice(0, -3);
		return {
			href: `/docs/${slug}${anchor ? `#${anchor}` : ""}`,
			external: false,
		};
	}

	return {
		href: `${REPO_URL}/blob/main/docs/${href.replace(/^\.?\//, "")}`,
		external: true,
	};
}

export type Heading = { depth: 2 | 3; text: string; id: string };

// Parse with the same pipeline DocsPage renders through (remark + gfm), so the
// TOC's anchor ids agree with rehype-slug's by construction rather than by two
// implementations happening to match. A regex scanner drifts on setext
// headings, ATX closing sequences, and inline markup inside a heading — each
// of which desyncs github-slugger's dedupe counter and silently breaks every
// anchor after it. See src/components/docs-toc-anchors.test.tsx.
//
// Feed the slugger every heading, h1-h6, in document order for that same
// reason; return only the h2/h3 the TOC renders.
export function extractHeadings(md: string): Heading[] {
	const tree = unified().use(remarkParse).use(remarkGfm).parse(md);
	const slugger = new GithubSlugger();
	const headings: Heading[] = [];

	visit(tree, "heading", (node) => {
		const text = mdastToString(node);
		const id = slugger.slug(text);
		if (node.depth === 2 || node.depth === 3) {
			headings.push({ depth: node.depth, text, id });
		}
	});

	return headings;
}

export function leadParagraph(md: string): string {
	const body = md.replace(/^#\s+.*$/m, "");
	const paragraph = body
		.split("\n\n")
		.map((block) => block.trim())
		.find((block) => block !== "" && !block.startsWith("#"));
	return paragraph ? paragraph.replace(/\s+/g, " ") : "";
}

export function slugFromPath(path: string): string {
	return path.split("/").pop()?.replace(/\.md$/, "") ?? "";
}
