import { expect, test } from "bun:test";
import { fetchDocs, rawUrl } from "./sync-docs";

test("builds raw urls against piperbox/piper main", () => {
	expect(rawUrl("getting-started.md")).toBe(
		"https://raw.githubusercontent.com/piperbox/piper/main/docs/getting-started.md",
	);
});

function fakeFetch(bodies: Record<string, string>, status = 200) {
	return (async (input: string | URL) => {
		const url = String(input);
		if (url.includes("/commits/")) {
			return new Response(JSON.stringify({ sha: "abc123" }), { status: 200 });
		}
		const key = url.split("/").pop() ?? "";
		return new Response(bodies[key] ?? "", { status });
	}) as unknown as typeof fetch;
}

test("returns every document keyed by filename plus the source sha", async () => {
	const result = await fetchDocs(
		fakeFetch({
			"getting-started.md": "# Getting started\n",
			"custom-domains.md": "# Custom domains\n",
			"manual-setup.md": "# Manual setup\n",
		}),
	);
	expect(result.sha).toBe("abc123");
	expect(result.files["getting-started.md"]).toBe("# Getting started\n");
	expect(Object.keys(result.files).length).toBe(3);
});

test("throws when a document is missing upstream", async () => {
	expect(fetchDocs(fakeFetch({}, 404))).rejects.toThrow(/404/);
});

test("throws when a document is empty", async () => {
	expect(
		fetchDocs(
			fakeFetch({
				"getting-started.md": "",
				"custom-domains.md": "# Custom domains\n",
				"manual-setup.md": "# Manual setup\n",
			}),
		),
	).rejects.toThrow(/empty/i);
});
