import { expect, test } from "bun:test";
import {
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import type { Section } from "@/lib/docs";
import { DocsIndex } from "./docs-index";

async function renderIndex(
	sections: Section[],
	leads: Record<string, string> = {},
) {
	const rootRoute = createRootRoute({
		component: () => <DocsIndex sections={sections} leads={leads} />,
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

test("lists each section's docs with their lead paragraphs", async () => {
	await renderIndex(
		[
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
		{ install: "One command installs piper.", cli: "Every piper verb." },
	);
	expect(screen.getByRole("heading", { name: "Guides" })).toBeTruthy();
	expect(screen.getByRole("heading", { name: "Reference" })).toBeTruthy();
	expect(
		screen.getByRole("link", { name: "Install" }).getAttribute("href"),
	).toBe("/docs/install");
	expect(screen.getByText("One command installs piper.")).toBeTruthy();
	expect(screen.getByText("Every piper verb.")).toBeTruthy();
});
