import GithubSlugger from "github-slugger";
import { toString as mdastToString } from "mdast-util-to-string";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { REPO_URL, SITE_ORIGIN } from "@/lib/links";

// Mirrors piper's docs/manifest.json, the single owner of what is published,
// in what order, under which title. `file` is relative to piper's docs/.
export type DocEntry = { slug: string; file: string; title: string };
export type Section = { title: string; pages: DocEntry[] };
export type Manifest = { sections: Section[] };

export function allPages(manifest: Manifest): DocEntry[] {
	return manifest.sections.flatMap((section) => section.pages);
}

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

const NOINDEX = { name: "robots", content: "noindex" };

// Canonical to the fixed production origin so previews and staging hosts
// don't index as duplicates; the index is noindex while it has nothing to show.
export function docsIndexHead(docs: DocEntry[]) {
	return {
		meta: docs.length === 0 ? [NOINDEX] : [],
		links: [{ rel: "canonical", href: `${SITE_ORIGIN}/docs` }],
	};
}

export function docHead(slug: string) {
	return {
		meta: [],
		links: [{ rel: "canonical", href: `${SITE_ORIGIN}/docs/${slug}` }],
	};
}
