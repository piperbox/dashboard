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
