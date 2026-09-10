import { expect, test } from "bun:test";
import {
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import type { Article } from "@/lib/blog";
import { fixtureArticle } from "@/lib/blog.fixture";
import { BlogIndex } from "./blog-index";
import { BlogLayout } from "./blog-layout";

// BlogIndex renders <Link>, which needs a router context to mount. The
// router is built with the same trailingSlash policy as src/router.tsx so
// hrefs keep their slash — the default ("never") would strip it.
async function renderIndex(articles: Article[]) {
	const rootRoute = createRootRoute({
		component: () => (
			<BlogLayout>
				<BlogIndex articles={articles} />
			</BlogLayout>
		),
	});
	const router = createRouter({
		routeTree: rootRoute,
		trailingSlash: "preserve",
	});
	await router.navigate({ to: "/" });
	// biome-ignore lint/suspicious/noExplicitAny: test router typing shortcut
	render(<RouterProvider router={router as any} />);
}

test("shows an empty state when nothing is published", async () => {
	await renderIndex([]);
	expect(screen.getByText(/nothing published yet/i)).toBeTruthy();
});

test("wraps the page in the public header labelled blog", async () => {
	await renderIndex([]);
	expect(screen.getByText("blog", { selector: "span" })).toBeTruthy();
	expect(screen.getByRole("link", { name: "dashboard" })).toBeTruthy();
});

test("lists articles in manifest order with trailing-slash links, description and date", async () => {
	await renderIndex([
		fixtureArticle,
		{ ...fixtureArticle, slug: "second", title: "Second post" },
	]);
	const links = screen.getAllByRole("link", { name: /How AI|Second post/ });
	expect(links.map((l) => l.textContent)).toEqual([
		"How AI Outfit Generators Work",
		"Second post",
	]);
	expect(links[0].getAttribute("href")).toBe("/blog/ai-outfit-generator/");
	expect(links[1].getAttribute("href")).toBe("/blog/second/");
	expect(
		screen.getAllByText(
			"A plain-language look at how AI turns a photo into an outfit.",
		),
	).toHaveLength(2);
	expect(screen.getAllByText("8 Aug 2026")).toHaveLength(2);
});
