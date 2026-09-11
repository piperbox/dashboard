import { expect, test } from "bun:test";
import {
	allPages,
	type DocEntry,
	docHref,
	extractHeadings,
	leadParagraph,
	slugFromPath,
} from "./docs";

const DOCS: DocEntry[] = [
	{ slug: "install", file: "guides/install.md", title: "Install" },
	{
		slug: "first-deploy",
		file: "guides/first-deploy.md",
		title: "First deploy",
	},
	{ slug: "cli", file: "reference/cli.md", title: "CLI" },
];

test("absolute urls pass through as external", () => {
	expect(docHref("https://example.com/x", "guides/install.md", DOCS)).toEqual({
		href: "https://example.com/x",
		external: true,
	});
});

test("bare anchors pass through as internal", () => {
	expect(docHref("#install", "guides/install.md", DOCS)).toEqual({
		href: "#install",
		external: false,
	});
});

test("a page in the same folder becomes its docs route", () => {
	expect(docHref("first-deploy.md", "guides/install.md", DOCS)).toEqual({
		href: "/docs/first-deploy",
		external: false,
	});
});

test("same-folder links keep their anchor", () => {
	expect(docHref("install.md#apt", "guides/first-deploy.md", DOCS)).toEqual({
		href: "/docs/install#apt",
		external: false,
	});
});

test("a page in another folder resolves through the manifest", () => {
	expect(
		docHref("../reference/cli.md#verbs", "guides/install.md", DOCS),
	).toEqual({
		href: "/docs/cli#verbs",
		external: false,
	});
	expect(docHref("../guides/install.md", "reference/cli.md", DOCS)).toEqual({
		href: "/docs/install",
		external: false,
	});
});

test("a page the manifest does not list falls back to the repo blob url", () => {
	// Real case: guides/install.md links to ../self-host/relay.md, which the
	// site does not publish.
	expect(
		docHref("../self-host/relay.md#configure", "guides/install.md", DOCS),
	).toEqual({
		href: "https://github.com/piperbox/piper/blob/main/docs/self-host/relay.md#configure",
		external: true,
	});
});

test("other relative paths fall back to the blob url, relative to the linking folder", () => {
	expect(
		docHref("packaging/systemd/piperd.service", "guides/install.md", DOCS),
	).toEqual({
		href: "https://github.com/piperbox/piper/blob/main/docs/guides/packaging/systemd/piperd.service",
		external: true,
	});
});

test("a link that climbs out of docs/ lands on the repo file", () => {
	expect(docHref("../../CLAUDE.md", "guides/install.md", DOCS)).toEqual({
		href: "https://github.com/piperbox/piper/blob/main/CLAUDE.md",
		external: true,
	});
});

test("an absolute url ending in .md stays external", () => {
	expect(
		docHref("https://example.com/a.md", "guides/install.md", DOCS),
	).toEqual({
		href: "https://example.com/a.md",
		external: true,
	});
});

test("an anchor containing .md is treated as a bare anchor, not markdown", () => {
	expect(docHref("#anchor.md", "guides/install.md", DOCS)).toEqual({
		href: "#anchor.md",
		external: false,
	});
});

test("a trailing empty anchor does not produce a dangling #", () => {
	expect(docHref("install.md#", "guides/first-deploy.md", DOCS)).toEqual({
		href: "/docs/install",
		external: false,
	});
});

test("extracts h2 and h3 headings with github anchors", () => {
	const md = "# Title\n\n## Box-wide base domain\n\n### Via the control API\n";
	expect(extractHeadings(md)).toEqual([
		{ depth: 2, text: "Box-wide base domain", id: "box-wide-base-domain" },
		{ depth: 3, text: "Via the control API", id: "via-the-control-api" },
	]);
});

test("ignores headings inside fenced code blocks", () => {
	const md = [
		"## Git deploys",
		"",
		"```bash",
		"# install the App on your repo in GitHub, then:",
		"git push",
		"```",
		"",
		"## Next",
	].join("\n");
	expect(extractHeadings(md).map((h) => h.text)).toEqual([
		"Git deploys",
		"Next",
	]);
});

test("ignores indented code blocks", () => {
	const md = "## Real\n\n    # not a heading\n";
	expect(extractHeadings(md).map((h) => h.text)).toEqual(["Real"]);
});

test("counts skipped headings so anchors match rehype-slug", () => {
	// The h1 "Setup" consumes the bare `setup` slug, so the h2 must be `setup-1`.
	const md = "# Setup\n\n## Setup\n";
	expect(extractHeadings(md)).toEqual([
		{ depth: 2, text: "Setup", id: "setup-1" },
	]);
});

test("reads the first paragraph after the h1", () => {
	const md = "# Getting started\n\nThe full journey, in order.\n\nMore text.\n";
	expect(leadParagraph(md)).toBe("The full journey, in order.");
});

test("returns an empty lead when there is no prose", () => {
	expect(leadParagraph("# Title\n")).toBe("");
});

test("derives a slug from a content path", () => {
	expect(slugFromPath("../content/docs/getting-started.md")).toBe(
		"getting-started",
	);
});

test("allPages flattens sections in manifest order", () => {
	const pages = allPages({
		sections: [
			{
				title: "Guides",
				pages: [
					{ slug: "install", file: "guides/install.md", title: "Install" },
				],
			},
			{
				title: "Reference",
				pages: [{ slug: "cli", file: "reference/cli.md", title: "CLI" }],
			},
		],
	});
	expect(pages.map((page) => page.slug)).toEqual(["install", "cli"]);
});
