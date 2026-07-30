import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "./page-header";

test("renders the title with a # prefix", () => {
	render(<PageHeader title="boxes" />);
	expect(screen.getByRole("heading").textContent).toBe("# boxes");
});

test("renders kicker and subtitle when given", () => {
	render(
		<PageHeader kicker="your hardware" title="boxes" subtitle="4 boxes" />,
	);
	expect(screen.getByText("your hardware")).toBeTruthy();
	expect(screen.getByText("4 boxes")).toBeTruthy();
});

test("omits kicker and subtitle when absent", () => {
	render(<PageHeader title="apps" />);
	expect(screen.queryByText("your hardware")).toBeNull();
});

test("renders an h2 when as='h2' so in-page sections don't add a second h1", () => {
	render(<PageHeader title="env" as="h2" />);
	expect(screen.getByRole("heading", { level: 2 }).textContent).toContain(
		"env",
	);
});
