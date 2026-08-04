import { expect, test } from "bun:test";

const publicFile = (name: string) =>
	Bun.file(new URL(`../public/${name}`, import.meta.url));

const manifest = await publicFile("manifest.json").json();
const css = await Bun.file(new URL("./styles.css", import.meta.url)).text();

test("the web app manifest names Piper, not the scaffold it came from", () => {
	expect(manifest.name).toContain("Piper");
	expect(manifest.short_name).toContain("Piper");
	expect(JSON.stringify(manifest)).not.toContain("TanStack");
});

test("manifest colors are the app's own tokens", () => {
	// Read off styles.css so a palette change can't silently desync the
	// browser chrome the manifest paints on mobile.
	const token = (name: string) =>
		css.match(new RegExp(`${name}: (#[0-9a-f]+)`))?.[1];
	expect(manifest.background_color).toBe(token("--background"));
	expect(manifest.theme_color).toBe(token("--background"));
});

test("every icon the manifest declares exists", async () => {
	const srcs: string[] = manifest.icons.map((i: { src: string }) => i.src);
	expect(srcs.length).toBeGreaterThan(0);
	for (const src of srcs) {
		expect(await publicFile(src).exists()).toBe(true);
	}
});

test("the SVG favicon draws the amber prompt caret", async () => {
	const svg = await publicFile("favicon.svg").text();
	expect(svg).toContain("#ffb454");
	// No <text>: the mark is geometry, so it does not depend on a font being
	// available wherever the icon gets rendered.
	expect(svg).not.toContain("<text");
});
