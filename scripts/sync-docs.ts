// Syncs piper's published docs into src/content/docs/ as a committed
// snapshot. piper's docs/manifest.json is the single owner of what is
// published; this script follows it. No pinned ref: the commit that lands
// the snapshot IS the pin.
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import type { Manifest } from "@/lib/docs";

const REPO = "piperbox/piper";
const OUT_DIR = new URL("../src/content/docs/", import.meta.url);

export function rawUrl(file: string): string {
	return `https://raw.githubusercontent.com/${REPO}/main/docs/${file}`;
}

async function fetchText(
	fetchImpl: typeof fetch,
	file: string,
): Promise<string> {
	const response = await fetchImpl(rawUrl(file));
	if (!response.ok) {
		throw new Error(`failed to fetch ${file}: ${response.status}`);
	}
	const body = await response.text();
	if (body.trim() === "") throw new Error(`fetched ${file} but it was empty`);
	return body;
}

// Returns every file the snapshot consists of, keyed by its name under
// src/content/docs/: the manifest verbatim plus one `<slug>.md` per page.
export async function fetchDocs(fetchImpl: typeof fetch) {
	const shaResponse = await fetchImpl(
		`https://api.github.com/repos/${REPO}/commits/main`,
	);
	if (!shaResponse.ok) {
		throw new Error(`failed to read ${REPO} head: ${shaResponse.status}`);
	}
	const { sha } = (await shaResponse.json()) as { sha: string };

	const manifestText = await fetchText(fetchImpl, "manifest.json");
	const manifest = JSON.parse(manifestText) as Manifest;
	if (!Array.isArray(manifest.sections)) {
		throw new Error("manifest.json has no sections array");
	}
	const files: Record<string, string> = { "manifest.json": manifestText };
	for (const page of manifest.sections.flatMap((section) => section.pages)) {
		files[`${page.slug}.md`] = await fetchText(fetchImpl, page.file);
	}
	return { files, sha };
}

if (import.meta.main) {
	const { files, sha } = await fetchDocs(fetch);
	await mkdir(OUT_DIR, { recursive: true });
	// A page dropped upstream must not linger as a stale snapshot file.
	for (const name of await readdir(OUT_DIR)) {
		if (name.endsWith(".md")) await unlink(new URL(name, OUT_DIR));
	}
	for (const [name, body] of Object.entries(files)) {
		await writeFile(new URL(name, OUT_DIR), body);
	}
	await writeFile(
		new URL("source.json", OUT_DIR),
		`${JSON.stringify({ repo: REPO, sha, syncedAt: new Date().toISOString() }, null, 2)}\n`,
	);
	console.log(
		`synced ${Object.keys(files).length - 1} docs from ${REPO}@${sha}`,
	);
}
