import { expect, test } from "bun:test";
import {
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { DocsIndex } from "./docs-index";

async function renderIndex(
	docs: { slug: string; title: string }[],
	leads: Record<string, string> = {},
) {
	const rootRoute = createRootRoute({
		component: () => <DocsIndex docs={docs} leads={leads} />,
	});
	const router = createRouter({ routeTree: rootRoute });
	await router.navigate({ to: "/" });
	// biome-ignore lint/suspicious/noExplicitAny: test router typing shortcut
	render(<RouterProvider router={router as any} />);
}

test("shows an empty state when no docs are published", async () => {
	await renderIndex([]);
	expect(screen.getByText(/no docs published yet/i)).toBeTruthy();
});

test("lists each doc with its lead paragraph", async () => {
	await renderIndex([{ slug: "getting-started", title: "Getting started" }], {
		"getting-started": "The full journey, in order.",
	});
	expect(
		screen.getByRole("link", { name: /Getting started/ }).getAttribute("href"),
	).toBe("/docs/getting-started");
	expect(screen.getByText("The full journey, in order.")).toBeTruthy();
});
