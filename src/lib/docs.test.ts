import { expect, test } from "bun:test";
import { docHref } from "./docs";

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
