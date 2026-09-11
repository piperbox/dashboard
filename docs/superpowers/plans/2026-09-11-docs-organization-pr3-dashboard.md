# Docs Organization PR 3: Manifest-Driven Docs Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dashboard's `/docs` site a pure function of piper's `docs/manifest.json`: sync follows the manifest, the sidebar and index render its sections, cross-folder links resolve, `/llms.txt` and `/docs/<slug>.md` serve agents, and the landing page links `/docs`.

**Architecture:** `bun run sync:docs` fetches `docs/manifest.json` from piper `main` and every file it names, writing them flattened by slug into `src/content/docs/` next to a verbatim copy of the manifest. The hand-authored `manifest.ts` goes away; layout, index, sitemap, and routes import the synced JSON. `docHref` becomes folder-aware and resolves targets through the manifest. Two server routes with no React rendering serve `/llms.txt` (built by a pure function from the manifest plus each page's lead paragraph) and the raw markdown at `/docs/<slug>.md`.

**Tech Stack:** TanStack Start (router 1.170), React 19, Biome, `bun test` + Testing Library. No new dependencies.

**Spec:** piper repo, `docs/superpowers/specs/2026-09-11-docs-organization-design.md` (section "Dashboard repo"), online at https://github.com/piperbox/piper/blob/main/docs/superpowers/specs/2026-09-11-docs-organization-design.md. PR 1 (piperbox/piper#561) and PR 2 (piperbox/piper#562) have merged, so piper `main` carries the manifest and all twelve published pages.

## Global Constraints

- **Bun only.** Never `npm`/`yarn`/`node`. First thing in a fresh worktree: `bun install --frozen-lockfile`.
- **Work in a worktree.** The main checkout at `/Users/fco/Documents/projects/getpiper/dashboard` has stale worktrees under `.claude/worktrees/`, each carrying a `biome.json`; `biome ci .` walks into them and fails with "nested root configuration". Inside a worktree of its own, `bun run verify` is clean.
- **Synced content is never hand-edited.** `src/content/docs/*.md`, `src/content/docs/manifest.json`, and `src/content/docs/source.json` are written only by `bun run sync:docs`. Committing them is the only manual step.
- **The manifest shape is piper's, verbatim:** `{ "sections": [ { "title", "pages": [ { "slug", "file", "title" } ] } ] }`. `file` is relative to piper's `docs/` (e.g. `guides/install.md`, `reference/cli.md`). Do not add fields.
- **`import.meta.glob` throws under `bun test`.** It may appear **only** in `src/lib/docs-content.ts`, which only files under `src/routes/**` may import. No test may transitively import it.
- **Tests never live in `src/routes/`.** Routes stay thin; logic lives in `src/lib/` and `src/components/`.
- **Every docs route is public and shell-free** (`staticData: { chrome: false }` on page routes; server routes render nothing).
- **`/llms.txt` shape** (llmstxt.org): `# Piper`, blank line, one `> ` blockquote paragraph, then per manifest section a `## <title>` and one `- [<title>](https://piperbox.dev/docs/<slug>.md): <lead>` line per page. Served as `text/plain; charset=utf-8`.
- **`/docs/<slug>.md`** returns exactly the bytes the sync wrote, as `text/plain; charset=utf-8`; unknown slug → 404.
- **Vite's dev server answers `.md` URLs itself** ("Cannot GET") unless the request accepts HTML. Browsers are fine; with curl add `-H 'Accept: text/html'`, or test against the production build (`bun run build && PORT=3124 bun .output/server/index.mjs`), which serves every client. `/llms.txt` and `/sitemap.xml` have no such quirk.
- **Regenerating routes:** `bun run generate-routes` updates `src/routeTree.gen.ts` but drops the trailing `declare module '@tanstack/react-start'` block; `bun run build` (part of `verify`) writes it back. Commit the tree as `bun run build` leaves it.
- Tabs, double quotes, organized imports: Biome enforces it. Run `bun run format` before every commit.
- Import alias is `@/` → `src/`.
- Every task ends green on `bun test` and `bun run typecheck`. The final gate is `bun run verify`.
- Conventional commits; every commit ends with:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  ```

## File Structure

| File | Responsibility |
| --- | --- |
| `scripts/sync-docs.ts` | **Rewrite.** Fetch manifest → pages; write `<slug>.md`, `manifest.json`, `source.json`; clear stale `.md`. |
| `scripts/sync-docs.test.ts` | **Rewrite.** Injected `fetch`; fail-loud on missing manifest, missing page, empty page. |
| `biome.json` | Exclude `src/content/docs/*.json` (synced, not ours to format; precedent: `src/content/blog`). |
| `src/content/docs/manifest.json`, `*.md`, `source.json` | **Synced snapshot, committed.** |
| `src/content/docs/manifest.ts` | Task 1: two-line shim deriving `DOCS` from the JSON. Task 2: **deleted.** |
| `src/content/docs/manifest.test.ts` | Manifest pages ⇔ synced files, both directions. |
| `src/lib/docs.ts` | Types `DocEntry`, `Section`, `Manifest`; `allPages`; folder-aware `docHref(href, fromFile, docs)`. |
| `src/lib/docs-content.ts` | Quarantine. `loadDoc` unchanged; gains `loadLeads`. |
| `src/lib/llms.ts` (+ test) | `buildLlmsTxt(manifest, leads)`, pure. |
| `src/lib/sitemap.ts` | Type import moves to `@/lib/docs`. |
| `src/components/docs-layout.tsx` | Sidebar takes `sections`, renders section headers. |
| `src/components/docs-index.tsx` | Index takes `sections`, renders section headings. |
| `src/components/docs-page.tsx` | Takes `file` and `docs` so links resolve through the manifest. |
| `src/routes/docs/index.tsx`, `src/routes/docs/$slug.tsx`, `src/routes/sitemap[.]xml.ts` | Import the synced JSON. |
| `src/routes/docs/{$slug}[.]md.ts` | **Create.** Raw markdown server route. |
| `src/routes/llms[.]txt.ts` | **Create.** `llms.txt` server route. |
| `src/components/landing-page.tsx` (+ test) | Three docs links → `/docs`. |

Design decisions taken here, beyond the spec's wording:

- The spec says "`DocEntry` gains `section`". This plan keeps piper's nested shape instead (`Section { title, pages }`) and passes `sections` to the layout and index, which then need no grouping code. `allPages(manifest)` flattens where a flat list is wanted (sitemap, link resolution).
- The spec writes `docHref(href, fromFile)`. The lookup table is an explicit third argument, `docHref(href, fromFile, docs)`, so `docs.ts` stays free of content imports and the tests use fixtures.

---

### Task 1: Manifest-driven sync and the committed snapshot

**Files:**
- Modify: `scripts/sync-docs.ts` (rewrite)
- Modify: `scripts/sync-docs.test.ts` (rewrite)
- Modify: `biome.json`
- Modify: `src/content/docs/manifest.ts` (becomes a shim; Task 2 deletes it)
- Create by running the sync: `src/content/docs/manifest.json`, `src/content/docs/source.json`, twelve `src/content/docs/<slug>.md`

**Interfaces:**
- Consumes: nothing.
- Produces: `fetchDocs(fetchImpl): Promise<{ files: Record<string, string>; sha: string }>` where `files` is keyed by output filename (`manifest.json`, `install.md`, …); `rawUrl(file)`. The committed `src/content/docs/manifest.json` that every later task imports.

Why the shim: `DocsLayout`, `DocsIndex`, `buildSitemap`, and three routes import `DOCS` from `manifest.ts` today. Deriving `DOCS` from the synced JSON keeps them all working, and `manifest.test.ts` passing, without touching them in this task. Task 2 replaces the consumers and deletes the shim.

- [ ] **Step 1: Rewrite the sync test**

Replace `scripts/sync-docs.test.ts` with:

```ts
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
	await expect(
		fetchDocs(fakeFetch({ "manifest.json": "{}" })),
	).rejects.toThrow(/sections/);
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun test scripts/sync-docs.test.ts`
Expected: FAIL — the manifest test fails because the current script fetches its hard-coded three files and never reads a manifest; the 404 test fails on `/manifest\.json: 404/` because the fake 404s `getting-started.md` first.

- [ ] **Step 3: Rewrite the sync script**

Replace `scripts/sync-docs.ts` with:

```ts
// Syncs piper's published docs into src/content/docs/ as a committed
// snapshot. piper's docs/manifest.json is the single owner of what is
// published; this script follows it. No pinned ref: the commit that lands
// the snapshot IS the pin.
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";

const REPO = "piperbox/piper";
const OUT_DIR = new URL("../src/content/docs/", import.meta.url);

type Manifest = {
	sections: { title: string; pages: { slug: string; file: string }[] }[];
};

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
```

- [ ] **Step 4: Run the sync tests**

Run: `bun test scripts/sync-docs.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Exclude synced JSON from Biome**

The manifest is copied verbatim (piper formats it with two spaces) and `source.json` is two-space too; Biome's tab formatter would flag both. Markdown is not a Biome file type, so only JSON needs the exclusion. In `biome.json`, add one line to `files.includes` after the blog exclusion:

```json
			"!**/src/content/blog",
			"!**/src/content/docs/*.json",
			"!**/src/styles.css"
```

- [ ] **Step 6: Turn the manifest into a shim over the synced JSON**

Replace `src/content/docs/manifest.ts` with:

```ts
// Nav order and labels come from piper's docs/manifest.json, synced by
// `bun run sync:docs`. Flat for now; sections arrive with the layout work.
import manifest from "./manifest.json";

export type DocEntry = { slug: string; title: string };

export const DOCS: DocEntry[] = manifest.sections.flatMap(
	(section) => section.pages,
);
```

`manifest.test.ts` is unchanged: it still compares `DOCS` slugs to the `.md` files in the directory, which is exactly the check we want on a fresh snapshot.

- [ ] **Step 7: Run the sync**

Run: `bun run sync:docs`
Expected: `synced 12 docs from piperbox/piper@<sha>`. `ls src/content/docs` shows `api.md custom-domains.md direct-serve.md env.md first-deploy.md git-deploys.md install.md lan-control.md manifest.json manifest.test.ts manifest.ts relay-login.md remote-control.md source.json tui.md`. `manifest.json` is byte-identical to piper's (`curl -s https://raw.githubusercontent.com/piperbox/piper/main/docs/manifest.json | diff - src/content/docs/manifest.json` prints nothing).

- [ ] **Step 8: Typecheck, lint, and run the whole suite**

Run: `bun run format && bun run check && bun run typecheck && bun test`
Expected: all PASS. `manifest.test.ts` passes because the twelve slugs in the JSON equal the twelve `.md` files.

- [ ] **Step 9: Commit**

```bash
git add scripts/sync-docs.ts scripts/sync-docs.test.ts biome.json src/content/docs
git commit -m "$(cat <<'EOF'
feat: sync docs by piper's manifest and commit the snapshot

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Manifest types in `lib`, sectioned sidebar and index, shim deleted

**Files:**
- Modify: `src/lib/docs.ts` (add types and `allPages`)
- Modify: `src/lib/docs.test.ts` (add one test)
- Modify: `src/components/docs-layout.tsx`, `src/components/docs-layout.test.tsx`
- Modify: `src/components/docs-index.tsx`, `src/components/docs-index.test.tsx`
- Modify: `src/lib/sitemap.ts`, `src/lib/sitemap.test.ts`
- Modify: `src/routes/docs/index.tsx`, `src/routes/docs/$slug.tsx`, `src/routes/sitemap[.]xml.ts`
- Modify: `src/content/docs/manifest.test.ts`
- Modify: `scripts/sync-docs.ts` (import the `Manifest` type instead of declaring it)
- Delete: `src/content/docs/manifest.ts`

**Interfaces:**
- Consumes: the synced `src/content/docs/manifest.json` (Task 1).
- Produces, from `@/lib/docs`: `type DocEntry = { slug: string; file: string; title: string }`, `type Section = { title: string; pages: DocEntry[] }`, `type Manifest = { sections: Section[] }`, `allPages(manifest: Manifest): DocEntry[]`. `DocsLayout({ sections, children })`, `DocsIndex({ sections, leads })`.

- [ ] **Step 1: Add the failing `allPages` test**

Append to `src/lib/docs.test.ts` (and add `allPages` to its import from `./docs`):

```ts
test("allPages flattens sections in manifest order", () => {
	const pages = allPages({
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
	expect(pages.map((page) => page.slug)).toEqual(["install", "cli"]);
});
```

Run: `bun test src/lib/docs.test.ts`
Expected: FAIL — `allPages` is not exported.

- [ ] **Step 2: Add the types and `allPages` to `src/lib/docs.ts`**

Insert directly below the `import` block, above `export type DocLink`:

```ts
// Mirrors piper's docs/manifest.json, the single owner of what is published,
// in what order, under which title. `file` is relative to piper's docs/.
export type DocEntry = { slug: string; file: string; title: string };
export type Section = { title: string; pages: DocEntry[] };
export type Manifest = { sections: Section[] };

export function allPages(manifest: Manifest): DocEntry[] {
	return manifest.sections.flatMap((section) => section.pages);
}
```

Run: `bun test src/lib/docs.test.ts`
Expected: PASS.

- [ ] **Step 3: Write the failing layout test**

Replace `src/components/docs-layout.test.tsx` with:

```tsx
import { expect, test } from "bun:test";
import {
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import type { Section } from "@/lib/docs";
import { DocsLayout } from "./docs-layout";

async function renderLayout(sections: Section[]) {
	const rootRoute = createRootRoute({
		component: () => <DocsLayout sections={sections}>body</DocsLayout>,
	});
	const router = createRouter({ routeTree: rootRoute });
	await router.navigate({ to: "/" });
	// biome-ignore lint/suspicious/noExplicitAny: test router typing shortcut
	render(<RouterProvider router={router as any} />);
}

const SECTIONS: Section[] = [
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
];

test("lists every page under its section header, in manifest order", async () => {
	await renderLayout(SECTIONS);
	const nav = screen.getByRole("navigation", { name: "Documentation" });
	const text = nav.textContent ?? "";
	const order = ["Guides", "Install", "The TUI", "Reference", "CLI"].map((s) =>
		text.indexOf(s),
	);
	expect(order.every((i) => i >= 0)).toBe(true);
	expect([...order].sort((a, b) => a - b)).toEqual(order);
	expect(
		screen.getByRole("link", { name: "Install" }).getAttribute("href"),
	).toBe("/docs/install");
	expect(screen.getByRole("link", { name: "CLI" }).getAttribute("href")).toBe(
		"/docs/cli",
	);
});

test("renders no sidebar when the manifest is empty", async () => {
	await renderLayout([]);
	expect(screen.queryByRole("navigation", { name: "Documentation" })).toBe(
		null,
	);
});

test("links to the piperbox repo", async () => {
	await renderLayout([]);
	expect(
		screen.getByRole("link", { name: /github/i }).getAttribute("href"),
	).toBe("https://github.com/piperbox/piper");
});

test("renders its children", async () => {
	await renderLayout([]);
	expect(screen.getByText("body")).toBeTruthy();
});
```

Run: `bun test src/components/docs-layout.test.tsx`
Expected: FAIL — `DocsLayout` still reads a `docs` prop, which is now undefined.

- [ ] **Step 4: Rewrite the layout**

Replace `src/components/docs-layout.tsx` with:

```tsx
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { PublicHeader } from "@/components/public-header";
import type { Section } from "@/lib/docs";

export function DocsLayout({
	sections,
	children,
}: {
	sections: Section[];
	children: ReactNode;
}) {
	return (
		<div className="min-h-screen">
			<PublicHeader section="docs" />

			<div className="mx-auto flex max-w-5xl gap-8 px-4 py-8">
				{sections.length > 0 && (
					<nav
						aria-label="Documentation"
						className="hidden w-44 shrink-0 self-start text-xs lg:block"
					>
						{sections.map((section) => (
							<div key={section.title} className="mb-4">
								<div className="mb-2 text-[11px] text-muted-foreground uppercase tracking-wider">
									{section.title}
								</div>
								<ul className="space-y-1">
									{section.pages.map((doc) => (
										<li key={doc.slug}>
											<Link to="/docs/$slug" params={{ slug: doc.slug }}>
												{doc.title}
											</Link>
										</li>
									))}
								</ul>
							</div>
						))}
					</nav>
				)}
				<main className="min-w-0 flex-1">{children}</main>
			</div>
		</div>
	);
}
```

Run: `bun test src/components/docs-layout.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write the failing index test**

Replace `src/components/docs-index.test.tsx` with:

```tsx
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
				pages: [{ slug: "install", file: "guides/install.md", title: "Install" }],
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
```

Run: `bun test src/components/docs-index.test.tsx`
Expected: FAIL — no section headings; `sections` is not a prop.

- [ ] **Step 6: Rewrite the index**

Replace `src/components/docs-index.tsx` with:

```tsx
import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import type { Section } from "@/lib/docs";

export function DocsIndex({
	sections,
	leads,
}: {
	sections: Section[];
	leads: Record<string, string>;
}) {
	return (
		<div className="flex flex-col gap-6">
			<PageHeader
				title="docs"
				subtitle="Guides and reference for running piper."
			/>
			{sections.length === 0 ? (
				<Panel className="px-3 py-6 text-muted-foreground text-sm">
					No docs published yet — read them on GitHub in the meantime.
				</Panel>
			) : (
				sections.map((section) => (
					<section key={section.title} className="flex flex-col gap-4">
						<h2 className="text-[11px] text-muted-foreground uppercase tracking-wider">
							{section.title}
						</h2>
						<ul className="flex flex-col gap-4">
							{section.pages.map((doc) => (
								<li key={doc.slug}>
									<Link to="/docs/$slug" params={{ slug: doc.slug }}>
										{doc.title}
									</Link>
									{leads[doc.slug] && (
										<p className="mt-1 text-muted-foreground text-sm">
											{leads[doc.slug]}
										</p>
									)}
								</li>
							))}
						</ul>
					</section>
				))
			)}
		</div>
	);
}
```

Run: `bun test src/components/docs-index.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 7: Move the sitemap's type import and fixture**

In `src/lib/sitemap.ts`, replace the first import line:

```ts
import type { DocEntry } from "@/lib/docs";
```

In `src/lib/sitemap.test.ts`, the docs fixture gains its file:

```ts
		docs: [
			{
				slug: "getting-started",
				file: "guides/getting-started.md",
				title: "Getting started",
			},
		],
```

Run: `bun test src/lib/sitemap.test.ts`
Expected: PASS (unchanged behaviour; the fixture now satisfies the fuller type).

- [ ] **Step 8: Point the routes at the synced JSON**

Replace `src/routes/docs/index.tsx` with:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { DocsIndex } from "@/components/docs-index";
import { DocsLayout } from "@/components/docs-layout";
import manifest from "@/content/docs/manifest.json";
import { allPages, leadParagraph } from "@/lib/docs";
import { loadDoc } from "@/lib/docs-content";

export const Route = createFileRoute("/docs/")({
	staticData: { chrome: false },
	loader: async () => {
		const entries = await Promise.all(
			allPages(manifest).map(async (doc) => {
				const md = await loadDoc(doc.slug);
				return [doc.slug, md ? leadParagraph(md) : ""] as const;
			}),
		);
		return { leads: Object.fromEntries(entries) };
	},
	component: DocsIndexPage,
});

function DocsIndexPage() {
	const { leads } = Route.useLoaderData();
	return (
		<DocsLayout sections={manifest.sections}>
			<DocsIndex sections={manifest.sections} leads={leads} />
		</DocsLayout>
	);
}
```

Replace `src/routes/docs/$slug.tsx` with:

```tsx
import { createFileRoute, notFound } from "@tanstack/react-router";
import { DocsLayout } from "@/components/docs-layout";
import { DocsPage } from "@/components/docs-page";
import manifest from "@/content/docs/manifest.json";
import { loadDoc } from "@/lib/docs-content";

export const Route = createFileRoute("/docs/$slug")({
	staticData: { chrome: false },
	loader: async ({ params }) => {
		const markdown = await loadDoc(params.slug);
		if (!markdown) throw notFound();
		return { markdown };
	},
	component: DocPage,
});

function DocPage() {
	const { markdown } = Route.useLoaderData();
	return (
		<DocsLayout sections={manifest.sections}>
			<DocsPage markdown={markdown} />
		</DocsLayout>
	);
}
```

Replace `src/routes/sitemap[.]xml.ts` with:

```ts
import { createFileRoute } from "@tanstack/react-router";
import manifest from "@/content/docs/manifest.json";
import { loadArticles } from "@/lib/blog-content";
import { allPages } from "@/lib/docs";
import { buildSitemap } from "@/lib/sitemap";

export const Route = createFileRoute("/sitemap.xml")({
	server: {
		handlers: {
			GET: () =>
				new Response(
					buildSitemap({ articles: loadArticles(), docs: allPages(manifest) }),
					{ headers: { "Content-Type": "application/xml; charset=utf-8" } },
				),
		},
	},
});
```

- [ ] **Step 9: Delete the shim and rewrite its test against the JSON**

```bash
git rm -q src/content/docs/manifest.ts
```

Replace `src/content/docs/manifest.test.ts` with:

```ts
import { expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { allPages } from "@/lib/docs";
import manifest from "./manifest.json";

// `bun run sync:docs` writes both the manifest and the *.md files here and
// clears stale pages, so a clean sync makes them agree by construction. This
// guards the other ways they drift: a hand-deleted page, a half-applied sync,
// a manifest edited by hand. A manifest page with no file renders a nav link
// that 404s; a file with no page is unreachable from nav.
//
// Read the directory with node:fs rather than importing @/lib/docs-content:
// that module contains import.meta.glob, which throws under `bun test`.
test("manifest pages and synced markdown files are the same set", () => {
	const files = readdirSync(new URL(".", import.meta.url))
		.filter((name) => name.endsWith(".md"))
		.map((name) => name.replace(/\.md$/, ""))
		.sort();
	const slugs = allPages(manifest)
		.map((doc) => doc.slug)
		.sort();

	expect(slugs).toEqual(files);
});
```

- [ ] **Step 10: Let the sync script import the shared type**

In `scripts/sync-docs.ts`, delete the local `type Manifest = {...};` declaration and add, after the `node:fs/promises` import:

```ts
import type { Manifest } from "@/lib/docs";
```

(A type-only import is erased, so `bun run sync:docs` still runs without resolving `@/`; `tsc` resolves it through `tsconfig.json` `paths`.)

- [ ] **Step 11: Typecheck, lint, test**

Run: `bun run format && bun run check && bun run typecheck && bun test`
Expected: all PASS. `grep -rn "content/docs/manifest\"" src scripts` returns nothing — no consumer of the deleted module remains.

- [ ] **Step 12: Commit**

```bash
git add -A scripts src
git commit -m "$(cat <<'EOF'
feat: render docs sections from the synced manifest, drop manifest.ts

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Folder-aware `docHref`

**Files:**
- Modify: `src/lib/docs.ts` (`docHref`)
- Modify: `src/lib/docs.test.ts` (the `docHref` block)
- Modify: `src/components/docs-page.tsx`, `src/components/docs-page.test.tsx`
- Modify: `src/components/docs-toc-anchors.test.tsx` (pass the new props)
- Modify: `src/routes/docs/$slug.tsx`

**Interfaces:**
- Consumes: `DocEntry`, `allPages` (Task 2).
- Produces: `docHref(href: string, fromFile: string, docs: DocEntry[]): DocLink`; `DocsPage({ markdown, file, docs })`.

Upstream pages link `install.md#apt` within a folder and `../reference/cli.md` or `../self-host/relay.md` across folders. A target the manifest lists gets its site route; anything else gets a GitHub blob URL, which is the right result for `self-host/` (not published) and for repo files like `../../CLAUDE.md`.

- [ ] **Step 1: Rewrite the `docHref` tests**

In `src/lib/docs.test.ts`, replace every `docHref` test (the first ten tests, up through "a trailing empty anchor does not produce a dangling #") with the block below, and add `type DocEntry` to the import from `./docs`:

```ts
const DOCS: DocEntry[] = [
	{ slug: "install", file: "guides/install.md", title: "Install" },
	{ slug: "first-deploy", file: "guides/first-deploy.md", title: "First deploy" },
	{ slug: "cli", file: "reference/cli.md", title: "CLI" },
];

test("absolute urls pass through as external", () => {
	expect(docHref("https://example.com/x", "guides/install.md", DOCS)).toEqual({
		href: "https://example.com/x",
		external: true,
	});
});

test("bare anchors pass through as internal", () => {
	expect(docHref("#install", "guides/install.md", DOCS)).toEqual({
		href: "#install",
		external: false,
	});
});

test("a page in the same folder becomes its docs route", () => {
	expect(docHref("first-deploy.md", "guides/install.md", DOCS)).toEqual({
		href: "/docs/first-deploy",
		external: false,
	});
});

test("same-folder links keep their anchor", () => {
	expect(docHref("install.md#apt", "guides/first-deploy.md", DOCS)).toEqual({
		href: "/docs/install#apt",
		external: false,
	});
});

test("a page in another folder resolves through the manifest", () => {
	expect(docHref("../reference/cli.md#verbs", "guides/install.md", DOCS)).toEqual({
		href: "/docs/cli#verbs",
		external: false,
	});
	expect(docHref("../guides/install.md", "reference/cli.md", DOCS)).toEqual({
		href: "/docs/install",
		external: false,
	});
});

test("a page the manifest does not list falls back to the repo blob url", () => {
	// Real case: guides/install.md links to ../self-host/relay.md, which the
	// site does not publish.
	expect(docHref("../self-host/relay.md#configure", "guides/install.md", DOCS)).toEqual({
		href: "https://github.com/piperbox/piper/blob/main/docs/self-host/relay.md#configure",
		external: true,
	});
});

test("other relative paths fall back to the blob url, relative to the linking folder", () => {
	expect(
		docHref("packaging/systemd/piperd.service", "guides/install.md", DOCS),
	).toEqual({
		href: "https://github.com/piperbox/piper/blob/main/docs/guides/packaging/systemd/piperd.service",
		external: true,
	});
});

test("a link that climbs out of docs/ lands on the repo file", () => {
	expect(docHref("../../CLAUDE.md", "guides/install.md", DOCS)).toEqual({
		href: "https://github.com/piperbox/piper/blob/main/CLAUDE.md",
		external: true,
	});
});

test("an absolute url ending in .md stays external", () => {
	expect(docHref("https://example.com/a.md", "guides/install.md", DOCS)).toEqual({
		href: "https://example.com/a.md",
		external: true,
	});
});

test("an anchor containing .md is treated as a bare anchor, not markdown", () => {
	expect(docHref("#anchor.md", "guides/install.md", DOCS)).toEqual({
		href: "#anchor.md",
		external: false,
	});
});

test("a trailing empty anchor does not produce a dangling #", () => {
	expect(docHref("install.md#", "guides/first-deploy.md", DOCS)).toEqual({
		href: "/docs/install",
		external: false,
	});
});
```

Run: `bun test src/lib/docs.test.ts`
Expected: FAIL — `docHref` takes one argument; cross-folder cases return blob URLs containing `..`.

- [ ] **Step 2: Rewrite `docHref`**

In `src/lib/docs.ts`, replace the comment and function from `// Upstream markdown is written for GitHub` through the end of `docHref` with:

```ts
// Upstream markdown is written for GitHub, so a link is relative to the
// linking file's folder under docs/ in the piper repo: a guide links to
// `install.md` and to `../reference/cli.md`. A target the manifest lists has
// a site route; anything else exists only in the repo and points at GitHub,
// which is the right answer for the self-host/ pages the site does not
// publish.
export function docHref(
	href: string,
	fromFile: string,
	docs: DocEntry[],
): DocLink {
	if (/^https?:\/\//.test(href)) return { href, external: true };
	if (href.startsWith("#")) return { href, external: false };

	const [path, anchor] = href.split("#");
	const suffix = anchor ? `#${anchor}` : "";
	const target = resolveFromDocs(fromFile, path);
	const page = docs.find((doc) => `docs/${doc.file}` === target);
	if (page) return { href: `/docs/${page.slug}${suffix}`, external: false };
	return { href: `${REPO_URL}/blob/main/${target}${suffix}`, external: true };
}

// Resolves `path` against the folder of `fromFile` (both relative to docs/)
// into a repo-relative path such as `docs/reference/cli.md`.
function resolveFromDocs(fromFile: string, path: string): string {
	const segments = ["docs", ...fromFile.split("/").slice(0, -1)];
	for (const part of path.split("/")) {
		if (part === "..") segments.pop();
		else if (part !== "." && part !== "") segments.push(part);
	}
	return segments.join("/");
}
```

Run: `bun test src/lib/docs.test.ts`
Expected: PASS.

- [ ] **Step 3: Update the page tests**

In `src/components/docs-page.test.tsx`, replace the `renderDoc` helper as follows, and add `import type { DocEntry } from "@/lib/docs";` to the imports.

```tsx
const DOCS: DocEntry[] = [
	{ slug: "install", file: "guides/install.md", title: "Install" },
	{ slug: "cli", file: "reference/cli.md", title: "CLI" },
];

// DocsPage renders <Link>, which needs a router context to mount.
async function renderDoc(markdown: string, file = "guides/first-deploy.md") {
	const rootRoute = createRootRoute({
		component: () => <DocsPage markdown={markdown} file={file} docs={DOCS} />,
	});
	const router = createRouter({ routeTree: rootRoute });
	await router.navigate({ to: "/" });
	// biome-ignore lint/suspicious/noExplicitAny: test router typing shortcut
	render(<RouterProvider router={router as any} />);
}
```

Replace the test "rewrites markdown links to docs routes" with these three:

```tsx
test("rewrites same-folder markdown links to docs routes", async () => {
	await renderDoc("# T\n\n[install](install.md#apt)\n");
	expect(
		screen.getByRole("link", { name: "install" }).getAttribute("href"),
	).toBe("/docs/install#apt");
});

test("rewrites cross-folder markdown links through the manifest", async () => {
	await renderDoc("# T\n\n[cli](../reference/cli.md#verbs)\n");
	expect(screen.getByRole("link", { name: "cli" }).getAttribute("href")).toBe(
		"/docs/cli#verbs",
	);
});

test("links to pages the site does not publish open the repo in a new tab", async () => {
	await renderDoc("# T\n\n[relay](../self-host/relay.md)\n");
	const link = screen.getByRole("link", { name: "relay" });
	expect(link.getAttribute("href")).toBe(
		"https://github.com/piperbox/piper/blob/main/docs/self-host/relay.md",
	);
	expect(link.getAttribute("target")).toBe("_blank");
});
```

In `src/components/docs-toc-anchors.test.tsx`, change the rendered component to pass the new props (link resolution is irrelevant to that test):

```tsx
		component: () => (
			<DocsPage markdown={markdown} file="guides/install.md" docs={[]} />
		),
```

Run: `bun test src/components/docs-page.test.tsx src/components/docs-toc-anchors.test.tsx`
Expected: FAIL — `DocsPage` ignores `file`/`docs`; hrefs come out wrong for the cross-folder cases.

- [ ] **Step 4: Thread `file` and `docs` through `DocsPage`**

In `src/components/docs-page.tsx`, add `import type { DocEntry } from "@/lib/docs";` next to the existing `@/lib/docs` import (or extend that import to `import { type DocEntry, docHref, extractHeadings } from "@/lib/docs";`), then replace `DocLink` and the `DocsPage` signature:

```tsx
function DocLink({
	href,
	file,
	docs,
	children,
}: {
	href?: string;
	file: string;
	docs: DocEntry[];
	children?: ReactNode;
}) {
	const link = docHref(href ?? "", file, docs);
	if (link.external) {
		return (
			<a href={link.href} target="_blank" rel="noreferrer">
				{children}
			</a>
		);
	}
	// Bare in-page anchors (e.g. "#install") aren't a route TanStack Router
	// knows about — Link would resolve them against the current route ("/").
	if (link.href.startsWith("#")) {
		return <a href={link.href}>{children}</a>;
	}
	return <Link to={link.href}>{children}</Link>;
}

export function DocsPage({
	markdown,
	file,
	docs,
}: {
	markdown: string;
	file: string;
	docs: DocEntry[];
}) {
```

and the `a:` entry of the component map:

```tsx
						a: ({ href, children }) => (
							<DocLink href={href} file={file} docs={docs}>
								{children}
							</DocLink>
						),
```

Run: `bun test src/components`
Expected: PASS.

- [ ] **Step 5: Let the page route supply the file**

Replace `src/routes/docs/$slug.tsx` with:

```tsx
import { createFileRoute, notFound } from "@tanstack/react-router";
import { DocsLayout } from "@/components/docs-layout";
import { DocsPage } from "@/components/docs-page";
import manifest from "@/content/docs/manifest.json";
import { allPages } from "@/lib/docs";
import { loadDoc } from "@/lib/docs-content";

export const Route = createFileRoute("/docs/$slug")({
	staticData: { chrome: false },
	loader: async ({ params }) => {
		const page = allPages(manifest).find((doc) => doc.slug === params.slug);
		const markdown = page ? await loadDoc(params.slug) : null;
		if (!page || !markdown) throw notFound();
		return { markdown, file: page.file };
	},
	component: DocPage,
});

function DocPage() {
	const { markdown, file } = Route.useLoaderData();
	return (
		<DocsLayout sections={manifest.sections}>
			<DocsPage markdown={markdown} file={file} docs={allPages(manifest)} />
		</DocsLayout>
	);
}
```

- [ ] **Step 6: Typecheck, lint, test, and look at a real cross-folder link**

Run: `bun run format && bun run check && bun run typecheck && bun test`
Expected: all PASS.

Run: `bun run dev`, open `http://localhost:3000/docs/install`. The "Run piperd yourself" link opens `https://github.com/piperbox/piper/blob/main/docs/self-host/piperd.md#macos-dev-box` in a new tab; on `http://localhost:3000/docs/cli` the "TUI" link in the first paragraph goes to `/docs/tui`. Stop the server.

- [ ] **Step 7: Commit**

```bash
git add src/lib/docs.ts src/lib/docs.test.ts src/components/docs-page.tsx src/components/docs-page.test.tsx src/components/docs-toc-anchors.test.tsx 'src/routes/docs/$slug.tsx'
git commit -m "$(cat <<'EOF'
feat: resolve docs links relative to their folder through the manifest

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `/llms.txt` and `/docs/<slug>.md`

**Files:**
- Create: `src/lib/llms.ts`, `src/lib/llms.test.ts`
- Modify: `src/lib/docs-content.ts` (add `loadLeads`; widen the quarantine comment)
- Modify: `src/routes/docs/index.tsx` (use `loadLeads`)
- Create: `src/routes/llms[.]txt.ts`
- Create: `src/routes/docs/{$slug}[.]md.ts`
- Regenerated: `src/routeTree.gen.ts`

**Interfaces:**
- Consumes: `Manifest`, `DocEntry`, `allPages`, `leadParagraph` (`@/lib/docs`); `loadDoc` (`@/lib/docs-content`); `SITE_ORIGIN` (`@/lib/links`).
- Produces: `buildLlmsTxt(manifest: Manifest, leads: Record<string, string>): string`; `loadLeads(docs: DocEntry[]): Promise<Record<string, string>>`; the two routes.

The file name `docs/{$slug}[.]md.ts` is TanStack's escaped form for a dynamic segment with a literal `.md` suffix; the generator emits the path `/docs/{$slug}.md` and `params.slug` is the bare slug. Verified on router 1.170.17: the production build serves `/docs/install.md` while `/docs/install` still reaches the page route.

- [ ] **Step 1: Write the failing `llms.txt` builder test**

Create `src/lib/llms.test.ts`:

```ts
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
					pages: [{ slug: "install", file: "guides/install.md", title: "Install" }],
				},
			],
		},
		{},
	);
	expect(txt).toContain("- [Install](https://piperbox.dev/docs/install.md)\n");
});
```

Run: `bun test src/lib/llms.test.ts`
Expected: FAIL — module `./llms` not found.

- [ ] **Step 2: Write the builder**

Create `src/lib/llms.ts`:

```ts
import type { Manifest } from "@/lib/docs";
import { SITE_ORIGIN } from "@/lib/links";

const DESCRIPTION =
	"Piper is an open-source PaaS: `git push` becomes a live HTTPS URL on hardware you own, including a Raspberry Pi behind CGNAT. Each link below is the raw markdown of one documentation page.";

// llms.txt in the llmstxt.org shape: an H1, a blockquote summary, then one H2
// per manifest section with a bulleted link per page and the page's lead
// paragraph as its summary. Links point at the raw markdown route.
export function buildLlmsTxt(
	manifest: Manifest,
	leads: Record<string, string>,
): string {
	const sections = manifest.sections.map((section) => {
		const items = section.pages.map((page) => {
			const lead = leads[page.slug];
			const link = `- [${page.title}](${SITE_ORIGIN}/docs/${page.slug}.md)`;
			return lead ? `${link}: ${lead}` : link;
		});
		return `## ${section.title}\n\n${items.join("\n")}`;
	});
	return `# Piper\n\n> ${DESCRIPTION}\n\n${sections.join("\n\n")}\n`;
}
```

Run: `bun test src/lib/llms.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 3: Add `loadLeads` to the quarantined loader**

Replace `src/lib/docs-content.ts` with:

```ts
// QUARANTINE: import.meta.glob is a Vite-only transform and throws under
// `bun test`. This module must be imported ONLY from src/routes/**.
// Everything else takes markdown as a prop so it stays testable.
import { type DocEntry, leadParagraph, slugFromPath } from "@/lib/docs";

// Deliberately NOT eager: an eager glob inlines every document into the chunk
// that statically imports this module, so the whole corpus would ship to every
// visitor. Lazy importers give each document its own chunk, fetched only by the
// route that renders it.
const modules = import.meta.glob("../content/docs/*.md", {
	query: "?raw",
	import: "default",
}) as Record<string, () => Promise<string>>;

export async function loadDoc(slug: string): Promise<string | null> {
	const path = Object.keys(modules).find((p) => slugFromPath(p) === slug);
	return path ? await modules[path]() : null;
}

// Lead paragraph per slug, for the index and llms.txt.
export async function loadLeads(
	docs: DocEntry[],
): Promise<Record<string, string>> {
	const entries = await Promise.all(
		docs.map(async (doc) => {
			const md = await loadDoc(doc.slug);
			return [doc.slug, md ? leadParagraph(md) : ""] as const;
		}),
	);
	return Object.fromEntries(entries);
}
```

- [ ] **Step 4: Use it from the index route**

Replace `src/routes/docs/index.tsx` with:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { DocsIndex } from "@/components/docs-index";
import { DocsLayout } from "@/components/docs-layout";
import manifest from "@/content/docs/manifest.json";
import { allPages } from "@/lib/docs";
import { loadLeads } from "@/lib/docs-content";

export const Route = createFileRoute("/docs/")({
	staticData: { chrome: false },
	loader: async () => ({ leads: await loadLeads(allPages(manifest)) }),
	component: DocsIndexPage,
});

function DocsIndexPage() {
	const { leads } = Route.useLoaderData();
	return (
		<DocsLayout sections={manifest.sections}>
			<DocsIndex sections={manifest.sections} leads={leads} />
		</DocsLayout>
	);
}
```

- [ ] **Step 5: Create the `llms.txt` route**

Create `src/routes/llms[.]txt.ts`:

```ts
import { createFileRoute } from "@tanstack/react-router";
import manifest from "@/content/docs/manifest.json";
import { allPages } from "@/lib/docs";
import { loadLeads } from "@/lib/docs-content";
import { buildLlmsTxt } from "@/lib/llms";

export const Route = createFileRoute("/llms.txt")({
	server: {
		handlers: {
			GET: async () =>
				new Response(
					buildLlmsTxt(manifest, await loadLeads(allPages(manifest))),
					{ headers: { "Content-Type": "text/plain; charset=utf-8" } },
				),
		},
	},
});
```

- [ ] **Step 6: Create the raw markdown route**

Create `src/routes/docs/{$slug}[.]md.ts`:

```ts
import { createFileRoute } from "@tanstack/react-router";
import { loadDoc } from "@/lib/docs-content";

// The bytes the sync wrote, for agents that want markdown rather than HTML.
// Vite's dev server answers *.md URLs itself unless the request accepts
// text/html; the production build serves this route to every client.
export const Route = createFileRoute("/docs/{$slug}.md")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				const markdown = await loadDoc(params.slug);
				if (markdown === null) {
					return new Response("not found", { status: 404 });
				}
				return new Response(markdown, {
					headers: { "Content-Type": "text/plain; charset=utf-8" },
				});
			},
		},
	},
});
```

- [ ] **Step 7: Regenerate the route tree, typecheck, test**

Run: `bun run generate-routes && bun run format && bun run check && bun run typecheck && bun test`
Expected: all PASS. `src/routeTree.gen.ts` gains `/llms.txt` and `/docs/{$slug}.md`. The generator may rewrite the `createFileRoute("...")` literals; accept what it writes.

- [ ] **Step 8: Verify both routes against the production build**

Run:

```bash
bun run build && (PORT=3124 bun .output/server/index.mjs &) && sleep 2
curl -s http://localhost:3124/llms.txt | head -8
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" http://localhost:3124/docs/install.md
curl -s http://localhost:3124/docs/install.md | diff - src/content/docs/install.md && echo "raw bytes identical"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3124/docs/nope.md
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3124/docs/install
pkill -f ".output/server/index.mjs"; rm -rf .output
```

Expected: `llms.txt` starts with `# Piper`, a blank line, the `> ` summary, then `## Guides` and `- [Install](https://piperbox.dev/docs/install.md): One command installs …`; `200 text/plain; charset=utf-8`; `raw bytes identical`; `404`; `200`. `git status` shows `src/routeTree.gen.ts` in its post-build form (with the trailing `declare module` block).

- [ ] **Step 9: Commit**

```bash
git add src/lib/llms.ts src/lib/llms.test.ts src/lib/docs-content.ts src/routes/docs/index.tsx 'src/routes/llms[.]txt.ts' 'src/routes/docs/{$slug}[.]md.ts' src/routeTree.gen.ts
git commit -m "$(cat <<'EOF'
feat: serve /llms.txt and raw markdown at /docs/<slug>.md

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Landing page links `/docs`

**Files:**
- Modify: `src/components/landing-page.tsx` (three anchors: nav ≈ line 98, hero ≈ line 178, footer ≈ line 292)
- Modify: `src/components/landing-page.test.tsx` (the "docs links point to the piperbox github repo" test ≈ line 95)

**Interfaces:**
- Consumes: the `/docs` route (exists).
- Produces: nothing downstream.

The docs-site spec kept `/docs` unlinked until content existed. It exists now.

- [ ] **Step 1: Update the failing test**

Replace the test "docs links point to the piperbox github repo" with:

```tsx
test("docs links point to the docs site", async () => {
	await renderLanding();
	const links = screen.getAllByRole("link", { name: "docs" });
	expect(links.length).toBeGreaterThan(0);
	for (const link of links) {
		expect(link.getAttribute("href")).toBe("/docs");
	}
	expect(
		screen.getByRole("link", { name: /read the docs/ }).getAttribute("href"),
	).toBe("/docs");
});
```

Run: `bun test src/components/landing-page.test.tsx`
Expected: FAIL — hrefs are the GitHub URL.

- [ ] **Step 2: Flip the three links**

In `src/components/landing-page.tsx` (`Link` is already imported), replace each of the three `<a … href={REPO_URL} …>` anchors whose text is `docs` or `read the docs →`. The nav one:

```tsx
				<Link className="text-muted-foreground" to="/docs">
					docs
				</Link>
```

The hero one (keep the surrounding `<span className="text-border">|</span>` and the star link as they are):

```tsx
					<Link to="/docs">read the docs →</Link>
```

The footer one:

```tsx
					<Link className="text-muted-foreground" to="/docs">
						docs
					</Link>
```

The `github` and `★ star on github` anchors keep `href={REPO_URL}`.

Run: `bun test src/components/landing-page.test.tsx`
Expected: PASS.

- [ ] **Step 3: Typecheck, lint, test**

Run: `bun run format && bun run check && bun run typecheck && bun test`
Expected: all PASS. `grep -c "REPO_URL" src/components/landing-page.tsx` is at least 2 (the GitHub links remain).

- [ ] **Step 4: Commit**

```bash
git add src/components/landing-page.tsx src/components/landing-page.test.tsx
git commit -m "$(cat <<'EOF'
feat: landing page links the docs site instead of GitHub

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Full verification and the PR

**Files:** none created; this task verifies, then pushes.

- [ ] **Step 1: Prove the sync is idempotent and the tree needs no hand edits**

Run: `bun run sync:docs && git status --short`
Expected: only `src/content/docs/source.json` is modified (its `syncedAt`). Then `git checkout -- src/content/docs/source.json`. If any other file changed, piper `main` moved since Task 1; re-run the sync and commit the new snapshot as `chore: resync docs snapshot`.

- [ ] **Step 2: Run the full gate**

Run: `bun run verify`
Expected: exit 0 — Biome, then `tsc --noEmit`, then `bun test`, then `vite build`. `git status` is clean afterwards (the build leaves `src/routeTree.gen.ts` as committed).

- [ ] **Step 3: Walk the success criteria from the spec**

- [ ] `bun run sync:docs` then `bun run verify` produced the site with zero hand edits (Step 1 + Step 2).
- [ ] `/llms.txt` lists all twelve pages with their lead paragraphs under `## Guides` and `## Reference`; `/docs/install.md` is byte-identical to the synced file (Task 4 Step 8; repeat against a fresh `bun run build` if anything changed since).
- [ ] `grep -rl "@/lib/docs-content" src/components src/lib` returns nothing — the quarantine holds.
- [ ] `ls src/content/docs/manifest.ts` fails — the hand-authored manifest is gone.
- [ ] `bun run dev`, then in a browser: `/` shows "docs" in the nav pointing at `/docs`; `/docs` shows the Guides and Reference headings with all twelve leads; `/docs/cli` renders the sidebar with both sections and its "TUI" link goes to `/docs/tui`. Stop the server.

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin ozykhan/docs-manifest-sync
gh pr create --base main --title "[app] docs site follows piper's manifest: sections, llms.txt, raw markdown" --body "$(cat <<'EOF'
The docs site becomes a pure function of piper's `docs/manifest.json`. PR 3 of 3 for the docs organization spec; the piper side landed in piperbox/piper#561 and piperbox/piper#562.

- `bun run sync:docs` fetches the manifest and every page it names, writes them flattened by slug plus a verbatim copy of the manifest, and clears stale pages. The twelve-page snapshot is committed.
- `manifest.ts` is gone. Layout, index, sitemap, and routes read the synced JSON; the sidebar and index render section headers in manifest order.
- `docHref(href, fromFile, docs)` resolves `install.md` and `../reference/cli.md` relative to the linking file's folder and maps through the manifest. Anything unlisted (`self-host/`, repo files) falls back to a GitHub blob URL.
- Two server routes for agents: `/llms.txt` (llmstxt.org shape, each page's lead as its summary) and `/docs/<slug>.md` (the raw bytes, `text/plain`).
- The landing page's docs links point at `/docs`.

Dev note: Vite's dev server answers `/docs/<slug>.md` itself unless the request accepts HTML (browsers do; `curl` needs `-H 'Accept: text/html'`). The production build serves it to every client.

Spec: https://github.com/piperbox/piper/blob/main/docs/superpowers/specs/2026-09-11-docs-organization-design.md
Plan: `docs/superpowers/plans/2026-09-11-docs-organization-pr3-dashboard.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Report the PR URL. Squash-merge is the human's call after the `verify` check passes.

## After merge

Two follow-ups surfaced while planning; file them in `piperbox/dashboard` once the PR merges, labelled `enhancement` + priority + size:

- `[app] docs pages: per-page <title> and description` — every `/docs/*` page still carries the root "Piper Dashboard" title and description; the page H1 and lead paragraph are the obvious values (`head()` on the two docs routes, like the blog routes). P3, size/S.
- `[repo] scheduled docs sync PR` — a workflow that runs `bun run sync:docs` on a schedule and opens a PR when the snapshot changes; the docs-site spec deferred it as "a later, additive step". P3, size/S.

Also note for the maintainer: the main checkout's `.claude/worktrees/` holds two stale worktrees (`dashboard-gsc-readiness-41c9a0`, `landing-page-implementation-86de5d`) whose branches have merged; `git worktree remove` on each restores `bun run verify` in the main checkout.
