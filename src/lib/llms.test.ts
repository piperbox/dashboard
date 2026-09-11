import { expect, test } from "bun:test";
import type { Manifest } from "./docs";
import { buildLlmsTxt } from "./llms";

const MANIFEST: Manifest = {
	sections: [
		{
			title: "Guides",
			pages: [
				{ slug: "install", file: "guides/install.md", title: "Install" },
				{ slug: "tui", file: "guides/tui.md", title: "The TUI" },
			],
		},
		{
			title: "Reference",
			pages: [{ slug: "cli", file: "reference/cli.md", title: "CLI" }],
		},
	],
};

test("renders the llmstxt.org shape: title, summary, one section per manifest section", () => {
	const txt = buildLlmsTxt(MANIFEST, {
		install: "One command installs piper.",
		tui: "Bare piper opens the TUI.",
		cli: "Every piper verb.",
	});
	expect(txt).toBe(
		[
			"# Piper",
			"",
			"> Piper is an open-source PaaS: `git push` becomes a live HTTPS URL on hardware you own, including a Raspberry Pi behind CGNAT. Each link below is the raw markdown of one documentation page.",
			"",
			"## Guides",
			"",
			"- [Install](https://piperbox.dev/docs/install.md): One command installs piper.",
			"- [The TUI](https://piperbox.dev/docs/tui.md): Bare piper opens the TUI.",
			"",
			"## Reference",
			"",
			"- [CLI](https://piperbox.dev/docs/cli.md): Every piper verb.",
			"",
		].join("\n"),
	);
});

test("omits the summary for a page with no lead", () => {
	const txt = buildLlmsTxt(
		{
			sections: [
				{
					title: "Guides",
					pages: [
						{ slug: "install", file: "guides/install.md", title: "Install" },
					],
				},
			],
		},
		{},
	);
	expect(txt).toContain("- [Install](https://piperbox.dev/docs/install.md)\n");
});
