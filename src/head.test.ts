import { expect, test } from "bun:test";
import { Route as RootRoute } from "./routes/__root";
import { Route as IndexRoute } from "./routes/index";

type Meta = { name?: string; title?: string; content?: string };
type Link = { rel?: string; href?: string; type?: string };

const headOf = (route: { options: { head?: unknown } }) => {
	const head = route.options.head as
		| ((ctx: unknown) => { meta?: Meta[]; links?: Link[] })
		| undefined;
	return head?.({}) ?? {};
};

const metaOf = (route: { options: { head?: unknown } }): Meta[] =>
	headOf(route).meta ?? [];

const describedBy = (route: { options: { head?: unknown } }): string =>
	metaOf(route).find((m) => m.name === "description")?.content ?? "";

const titleOf = (route: { options: { head?: unknown } }): string =>
	metaOf(route).find((m) => m.title !== undefined)?.title ?? "";

test("the root head carries a default description for dashboard pages", () => {
	const description = describedBy(RootRoute);
	expect(description).toContain("Piper");
	expect(description.length).toBeLessThanOrEqual(160);
});

test("the landing page overrides the default with its own description", () => {
	const landing = describedBy(IndexRoute);
	expect(landing).toContain("Piper");
	expect(landing.length).toBeLessThanOrEqual(160);
	expect(landing).not.toBe(describedBy(RootRoute));
});

test("the landing page overrides the dashboard title with marketing copy", () => {
	const title = titleOf(IndexRoute);
	expect(title).toContain("Piper");
	expect(title).not.toBe(titleOf(RootRoute));
	expect(title.length).toBeLessThanOrEqual(60);
});

test("the root head links the icon set and the web app manifest", () => {
	const links = headOf(RootRoute).links ?? [];
	// The SVG is what Chrome actually picks; the .ico is the fallback for
	// browsers that ignore it, and is also what a bare /favicon.ico hits.
	expect(links).toContainEqual({
		rel: "icon",
		type: "image/svg+xml",
		href: "/favicon.svg",
	});
	expect(links).toContainEqual({
		rel: "icon",
		type: "image/x-icon",
		href: "/favicon.ico",
	});
	expect(links.some((l) => l.rel === "manifest")).toBe(true);
});
