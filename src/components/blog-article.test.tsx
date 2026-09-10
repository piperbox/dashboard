import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import type { Article } from "@/lib/blog";
import { fixtureArticle } from "@/lib/blog.fixture";
import { BlogArticle } from "./blog-article";

const body = [
	"## What an outfit generator actually does",
	"",
	"Body text starts here.",
	"",
	"![Three generated looks side by side](https://cdn.seopotion.com/orgs/abc/articles/123/inline-1.webp)",
	"",
	"![An older image with no size](https://cdn.seopotion.com/orgs/abc/articles/123/inline-2.webp)",
	"",
	'<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="How AI styling works"></iframe>',
	"",
].join("\n");

// No <Link> in BlogArticle, so no router is needed.
function renderArticle(article: Article = fixtureArticle) {
	render(<BlogArticle article={article} body={body} />);
}

test("renders the manifest title as the only h1", () => {
	renderArticle();
	const h1s = screen.getAllByRole("heading", { level: 1 });
	expect(h1s).toHaveLength(1);
	expect(h1s[0].textContent).toContain("How AI Outfit Generators Work");
	expect(screen.getByRole("heading", { level: 2 }).textContent).toContain(
		"What an outfit generator actually does",
	);
});

test("renders the cover with its real dimensions", () => {
	renderArticle();
	const cover = screen.getByAltText("A phone showing a generated outfit");
	expect(cover.getAttribute("src")).toBe(fixtureArticle.cover);
	expect(cover.getAttribute("width")).toBe("1216");
	expect(cover.getAttribute("height")).toBe("640");
});

test("omits cover dimensions when the manifest has none", () => {
	renderArticle({ ...fixtureArticle, cover_width: null, cover_height: null });
	const cover = screen.getByAltText("A phone showing a generated outfit");
	expect(cover.getAttribute("width")).toBeNull();
	expect(cover.getAttribute("height")).toBeNull();
});

test("adds width and height to inline images from the manifest, lazily loaded", () => {
	renderArticle();
	const img = screen.getByAltText("Three generated looks side by side");
	expect(img.getAttribute("width")).toBe("1216");
	expect(img.getAttribute("height")).toBe("672");
	expect(img.getAttribute("loading")).toBe("lazy");
});

test("omits inline image dimensions when the manifest size is null", () => {
	renderArticle();
	const img = screen.getByAltText("An older image with no size");
	expect(img.getAttribute("width")).toBeNull();
	expect(img.getAttribute("height")).toBeNull();
});

test("keeps raw iframe embeds instead of printing them as text", () => {
	renderArticle();
	const iframe = document.querySelector("iframe");
	expect(iframe?.getAttribute("src")).toBe(
		"https://www.youtube.com/embed/dQw4w9WgXcQ",
	);
	expect(screen.queryByText(/<iframe/)).toBeNull();
});

test("shows the published date, and the updated date only once republished", () => {
	renderArticle();
	expect(screen.getByText("8 Aug 2026")).toBeTruthy();
	expect(screen.queryByText(/updated/i)).toBeNull();
});

test("shows the updated date after a republish", () => {
	renderArticle({ ...fixtureArticle, updated_at: "2026-08-20T00:00:00.000Z" });
	expect(screen.getByText(/updated 20 Aug 2026/)).toBeTruthy();
});
