// Syncs piper's user-facing docs into src/content/docs/ as a committed
// snapshot. No pinned ref: the commit that lands the snapshot IS the pin.
import { mkdir, writeFile } from "node:fs/promises";

const REPO = "piperbox/piper";
const FILES = ["getting-started.md", "custom-domains.md", "manual-setup.md"];
const OUT_DIR = new URL("../src/content/docs/", import.meta.url);

export function rawUrl(file: string): string {
	return `https://raw.githubusercontent.com/${REPO}/main/docs/${file}`;
}

export async function fetchDocs(fetchImpl: typeof fetch) {
	const shaResponse = await fetchImpl(
		`https://api.github.com/repos/${REPO}/commits/main`,
	);
	if (!shaResponse.ok) {
		throw new Error(`failed to read ${REPO} head: ${shaResponse.status}`);
	}
	const { sha } = (await shaResponse.json()) as { sha: string };

	const files: Record<string, string> = {};
	for (const file of FILES) {
		const response = await fetchImpl(rawUrl(file));
		if (!response.ok) {
			throw new Error(`failed to fetch ${file}: ${response.status}`);
		}
		const body = await response.text();
		if (body.trim() === "") throw new Error(`fetched ${file} but it was empty`);
		files[file] = body;
	}
	return { files, sha };
}

if (import.meta.main) {
	const { files, sha } = await fetchDocs(fetch);
	await mkdir(OUT_DIR, { recursive: true });
	for (const [name, body] of Object.entries(files)) {
		await writeFile(new URL(name, OUT_DIR), body);
	}
	await writeFile(
		new URL("source.json", OUT_DIR),
		`${JSON.stringify({ repo: REPO, sha, syncedAt: new Date().toISOString() }, null, 2)}\n`,
	);
	console.log(`synced ${Object.keys(files).length} docs from ${REPO}@${sha}`);
	console.log("next: add entries to src/content/docs/manifest.ts");
}
