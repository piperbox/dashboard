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

// Upstream markdown is written for GitHub, so a link is relative to the
// linking file's folder under docs/ in the piper repo: a guide links to
// `install.md` and to `../reference/cli.md`. A target the manifest lists has
// a site route; anything else exists only in the repo and points at GitHub,
// which is the right answer for the self-host/ pages the site does not
// publish.
export function docHref(
	href: string,
	fromFile: string,
	docs: DocEntry[],
): DocLink {
	if (/^https?:\/\//.test(href)) return { href, external: true };
	if (href.startsWith("#")) return { href, external: false };

	const [path, anchor] = href.split("#");
	const suffix = anchor ? `#${anchor}` : "";
	const target = resolveFromDocs(fromFile, path);
	const page = docs.find((doc) => `docs/${doc.file}` === target);
	if (page) return { href: `/docs/${page.slug}${suffix}`, external: false };
	return { href: `${REPO_URL}/blob/main/${target}${suffix}`, external: true };
}

// Resolves `path` against the folder of `fromFile` (both relative to docs/)
// into a repo-relative path such as `docs/reference/cli.md`.
function resolveFromDocs(fromFile: string, path: string): string {
	const segments = ["docs", ...fromFile.split("/").slice(0, -1)];
	for (const part of path.split("/")) {
		if (part === "..") segments.pop();
		else if (part !== "." && part !== "") segments.push(part);
	}
	return segments.join("/");
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
