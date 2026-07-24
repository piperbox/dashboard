import { expect, test } from "bun:test";
import { docHref, extractHeadings, leadParagraph, slugFromPath } from "./docs";

test("absolute urls pass through as external", () => {
	expect(docHref("https://example.com/x")).toEqual({
		href: "https://example.com/x",
		external: true,
	});
});

test("bare anchors pass through as internal", () => {
	expect(docHref("#install")).toEqual({ href: "#install", external: false });
});

test("markdown links become docs routes", () => {
	expect(docHref("custom-domains.md")).toEqual({
		href: "/docs/custom-domains",
		external: false,
	});
});

test("markdown links keep their anchor", () => {
	expect(docHref("getting-started.md#install")).toEqual({
		href: "/docs/getting-started#install",
		external: false,
	});
});

test("markdown links in a subdirectory use the basename", () => {
	expect(docHref("../docs/manual-setup.md")).toEqual({
		href: "/docs/manual-setup",
		external: false,
	});
});

test("other relative paths fall back to the repo blob url", () => {
	expect(docHref("packaging/systemd/piperd.service")).toEqual({
		href: "https://github.com/piperbox/piper/blob/main/packaging/systemd/piperd.service",
		external: true,
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
