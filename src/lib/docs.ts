import GithubSlugger from "github-slugger";
import { REPO_URL } from "@/lib/links";

export type DocLink = { href: string; external: boolean };

// Upstream markdown is written for GitHub, so its links are repo-relative.
// Sibling *.md files have a site equivalent; everything else only exists in
// the repo, so it points back at GitHub.
export function docHref(href: string): DocLink {
	if (/^https?:\/\//.test(href)) return { href, external: true };
	if (href.startsWith("#")) return { href, external: false };

	const [path, anchor] = href.split("#");
	if (path.endsWith(".md")) {
		const slug = path.slice(0, -3).split("/").pop();
		return {
			href: `/docs/${slug}${anchor ? `#${anchor}` : ""}`,
			external: false,
		};
	}

	return {
		href: `${REPO_URL}/blob/main/${href.replace(/^\.?\//, "")}`,
		external: true,
	};
}

export type Heading = { depth: 2 | 3; text: string; id: string };

// Feed the slugger every heading, h1-h6, so its dedupe counters stay in step
// with rehype-slug's; return only the h2/h3 the TOC renders.
export function extractHeadings(md: string): Heading[] {
	const slugger = new GithubSlugger();
	const headings: Heading[] = [];
	let inFence = false;

	for (const line of md.split("\n")) {
		if (/^\s*(```|~~~)/.test(line)) {
			inFence = !inFence;
			continue;
		}
		if (inFence) continue;

		// Zero-indent only: an indented `#` is a code block, not a heading.
		const match = /^(#{1,6}) +(.+?)\s*$/.exec(line);
		if (!match) continue;

		const depth = match[1].length;
		const text = match[2];
		const id = slugger.slug(text);
		if (depth === 2 || depth === 3) headings.push({ depth, text, id });
	}

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
