import { expect, test } from "bun:test";
import { fetchDocs, rawUrl } from "./sync-docs";

const MANIFEST = JSON.stringify({
	sections: [
		{
			title: "Guides",
			pages: [{ slug: "install", file: "guides/install.md", title: "Install" }],
		},
		{
			title: "Reference",
			pages: [{ slug: "cli", file: "reference/cli.md", title: "CLI" }],
		},
	],
});

const PAGES: Record<string, string> = {
	"manifest.json": MANIFEST,
	"guides/install.md": "# Install\n",
	"reference/cli.md": "# CLI reference\n",
};

// Serves `bodies` by path under docs/; anything else is a 404, like raw
// GitHub. The commits endpoint always answers with a fixed sha.
function fakeFetch(bodies: Record<string, string>) {
	return (async (input: string | URL) => {
		const url = String(input);
		if (url.includes("/commits/")) {
			return new Response(JSON.stringify({ sha: "abc123" }), { status: 200 });
		}
		const path = url.split("/main/docs/")[1] ?? "";
		const body = bodies[path];
		return body === undefined
			? new Response("404: Not Found", { status: 404 })
			: new Response(body, { status: 200 });
	}) as unknown as typeof fetch;
}

test("builds raw urls against piperbox/piper main, under docs/", () => {
	expect(rawUrl("guides/install.md")).toBe(
		"https://raw.githubusercontent.com/piperbox/piper/main/docs/guides/install.md",
	);
});

test("fetches the manifest, then every page it names, keyed by output filename", async () => {
	const result = await fetchDocs(fakeFetch(PAGES));
	expect(result.sha).toBe("abc123");
	expect(result.files["manifest.json"]).toBe(MANIFEST);
	expect(result.files["install.md"]).toBe("# Install\n");
	expect(result.files["cli.md"]).toBe("# CLI reference\n");
	expect(Object.keys(result.files).sort()).toEqual([
		"cli.md",
		"install.md",
		"manifest.json",
	]);
});

test("throws when the manifest is missing upstream", async () => {
	await expect(fetchDocs(fakeFetch({}))).rejects.toThrow(/manifest\.json: 404/);
});

test("throws when the manifest has no sections", async () => {
	await expect(fetchDocs(fakeFetch({ "manifest.json": "{}" }))).rejects.toThrow(
		/sections/,
	);
});

test("throws when a page the manifest names is missing upstream", async () => {
	await expect(
		fetchDocs(
			fakeFetch({
				"manifest.json": MANIFEST,
				"guides/install.md": "# Install\n",
			}),
		),
	).rejects.toThrow(/reference\/cli\.md: 404/);
});

test("throws when a page is empty", async () => {
	await expect(
		fetchDocs(fakeFetch({ ...PAGES, "guides/install.md": "" })),
	).rejects.toThrow(/empty/i);
});
