# Docs Site Bedrock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public `/docs` surface that renders markdown synced from `piperbox/piper`, with zero documentation content committed — the machinery only.

**Architecture:** A `bun run sync:docs` script fetches piper's `docs/*.md` into `src/content/docs/` as a committed snapshot; a hand-authored manifest in this repo supplies nav order; `react-markdown` renders each document with an explicit component map onto the existing terminal design system. All logic lives in pure helpers and prop-driven components so it is testable; the one Vite-only construct (`import.meta.glob`) is quarantined in a module that only routes import.

**Tech Stack:** TanStack Start, React 19, Tailwind 4, Biome, `bun test` + Testing Library, `react-markdown` + `remark-gfm` + `rehype-slug` + `github-slugger`.

**Spec:** `docs/superpowers/specs/2026-07-25-docs-site-design.md`

## Global Constraints

- **Bun only.** Never `npm`/`yarn`/`node`. Install with `bun add`.
- **Repo slug is `piperbox/piper`.** Canonical URL: `https://github.com/piperbox/piper`.
- **Do not change `get.openpiper.dev`.** It is live DNS; renaming it before the host exists ships a copy button with a dead URL.
- **Do not change `import-wizard.tsx:698`'s `placeholder="getpiper/example"`.** Out of scope; flagged only.
- **No documentation content.** `DOCS` ships as `[]`; no `.md` files are committed.
- **`import.meta.glob` throws under `bun test`.** It may appear **only** in `src/lib/docs-content.ts`, which only `src/routes/docs/*` may import. No test may transitively import it.
- **Tests never live in `src/routes/`** — the file router scans that directory. Routes stay thin; logic lives in `src/components/` and `src/lib/`.
- **Nothing links to `/docs`.** The landing page's docs links keep pointing at GitHub.
- Tabs for indentation, double quotes — Biome enforces it. Run `bun run format` before committing.
- Import alias is `@/` → `src/`.
- Every task ends green on `bun test`. The final gate is `bun run verify`.
- Commit trailer on every commit:
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  ```

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/links.ts` | Canonical external URLs (repo, install command). Shared by landing page, docs layout, `docHref`. |
| `src/lib/docs.ts` | Pure helpers: `docHref`, `extractHeadings`, `leadParagraph`, `slugFromPath`. No React, no IO. |
| `src/content/docs/manifest.ts` | Hand-authored nav order/labels. Ships empty. |
| `src/lib/docs-content.ts` | **Quarantined.** The `import.meta.glob` call and nothing else. |
| `src/components/docs-page.tsx` | Markdown → React via `react-markdown` + component map. Takes markdown as a prop. |
| `src/components/docs-layout.tsx` | Top bar, manifest sidebar, TOC rail. Takes docs list as a prop. |
| `src/components/docs-index.tsx` | Index listing + empty state. Takes entries as a prop. |
| `src/routes/docs/index.tsx`, `src/routes/docs/$slug.tsx` | Thin routes; the only importers of `docs-content.ts`. |
| `scripts/sync-docs.ts` | Fetch upstream markdown into `src/content/docs/`. |

---

### Task 1: Shared links constant and the `piperbox` rename

**Files:**
- Create: `src/lib/links.ts`
- Modify: `src/components/landing-page.tsx:5-6` (delete both local consts, import instead)
- Modify: `src/components/landing-page.test.tsx:26,29,65,71`

**Interfaces:**
- Consumes: nothing.
- Produces: `REPO_URL: string` (`"https://github.com/piperbox/piper"`) and `INSTALL_CMD: string` (`"curl -fsSL https://get.openpiper.dev/install.sh | sh"`), both from `@/lib/links`.

Context: `landing-page.tsx` uses `GITHUB_URL` at lines 99, 109, 152, 156, 294, 302 and `INSTALL_CMD` at 74, 147. Only the two `const` declarations change; the usages keep their existing names if you name the imports identically — but rename the import to `REPO_URL` for clarity and update all six usages.

- [ ] **Step 1: Update the failing test assertions**

In `src/components/landing-page.test.tsx`, change the test at line 65 from `openpiper` to `piperbox`:

```tsx
test("docs links point to the piperbox github repo", async () => {
	await renderLanding();
	const links = screen.getAllByRole("link", { name: "docs" });
	expect(links.length).toBeGreaterThan(0);
	for (const link of links) {
		expect(link.getAttribute("href")).toBe(
			"https://github.com/piperbox/piper",
		);
	}
});
```

Leave the install-command test's URL alone (`get.openpiper.dev` is live DNS), but rename its title at line 26 so it stops implying an org:

```tsx
test("shows the install command", async () => {
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/components/landing-page.test.tsx`
Expected: FAIL — the docs-links test reports `https://github.com/openpiper/piper` where `https://github.com/piperbox/piper` was expected.

- [ ] **Step 3: Create the shared constants**

```ts
// src/lib/links.ts
// Canonical external URLs. Shared by the landing page, the docs chrome, and
// docs.ts's GitHub-blob fallback for links with no site equivalent.
export const REPO_URL = "https://github.com/piperbox/piper";

// NB: get.openpiper.dev is live DNS, renamed only once the host is repointed.
export const INSTALL_CMD = "curl -fsSL https://get.openpiper.dev/install.sh | sh";
```

- [ ] **Step 4: Point the landing page at them**

In `src/components/landing-page.tsx`, delete lines 5-6 and add to the imports:

```tsx
import { INSTALL_CMD, REPO_URL } from "@/lib/links";
```

Then replace all six `GITHUB_URL` occurrences (lines 99, 109, 152, 156, 294, 302) with `REPO_URL`. `INSTALL_CMD` keeps its name, so lines 74 and 147 are unchanged.

- [ ] **Step 5: Run tests and typecheck**

Run: `bun test src/components/landing-page.test.tsx && bun run typecheck`
Expected: PASS, and no unused-variable errors (`noUnusedLocals` is on — a leftover `GITHUB_URL` would fail here).

- [ ] **Step 6: Commit**

```bash
bun run format
git add src/lib/links.ts src/components/landing-page.tsx src/components/landing-page.test.tsx
git commit -m "$(cat <<'EOF'
refactor: extract shared links and rename openpiper to piperbox

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `docHref` link rewriting

**Files:**
- Create: `src/lib/docs.ts`
- Create: `src/lib/docs.test.ts`

**Interfaces:**
- Consumes: `REPO_URL` from `@/lib/links` (Task 1).
- Produces: `docHref(href: string): { href: string; external: boolean }`. Task 5 uses it in the `a` component map.

Rules, in order: absolute `http(s)://` → unchanged, `external: true`. Bare `#anchor` → unchanged, `external: false`. `*.md` (with optional `#anchor`) → `/docs/<basename>#anchor`, `external: false`. Any other relative path → `<REPO_URL>/blob/main/<path>`, `external: true`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/docs.test.ts
import { expect, test } from "bun:test";
import { docHref } from "./docs";

test("absolute urls pass through as external", () => {
	expect(docHref("https://example.com/x")).toEqual({
		href: "https://example.com/x",
		external: true,
	});
});

test("bare anchors pass through as internal", () => {
	expect(docHref("#install")).toEqual({ href: "#install", external: false });
});

test("markdown links become docs routes", () => {
	expect(docHref("custom-domains.md")).toEqual({
		href: "/docs/custom-domains",
		external: false,
	});
});

test("markdown links keep their anchor", () => {
	expect(docHref("getting-started.md#install")).toEqual({
		href: "/docs/getting-started#install",
		external: false,
	});
});

test("markdown links in a subdirectory use the basename", () => {
	expect(docHref("../docs/manual-setup.md")).toEqual({
		href: "/docs/manual-setup",
		external: false,
	});
});

test("other relative paths fall back to the repo blob url", () => {
	expect(docHref("packaging/systemd/piperd.service")).toEqual({
		href: "https://github.com/piperbox/piper/blob/main/packaging/systemd/piperd.service",
		external: true,
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/lib/docs.test.ts`
Expected: FAIL — cannot resolve `./docs`.

- [ ] **Step 3: Implement `docHref`**

```ts
// src/lib/docs.ts
import { REPO_URL } from "@/lib/links";

export type DocLink = { href: string; external: boolean };

// Upstream markdown is written for GitHub, so its links are repo-relative.
// Sibling *.md files have a site equivalent; everything else only exists in
// the repo, so it points back at GitHub.
export function docHref(href: string): DocLink {
	if (/^https?:\/\//.test(href)) return { href, external: true };
	if (href.startsWith("#")) return { href, external: false };

	const [path, anchor] = href.split("#");
	if (path.endsWith(".md")) {
		const slug = path.slice(0, -3).split("/").pop();
		return {
			href: `/docs/${slug}${anchor ? `#${anchor}` : ""}`,
			external: false,
		};
	}

	return {
		href: `${REPO_URL}/blob/main/${href.replace(/^\.?\//, "")}`,
		external: true,
	};
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test src/lib/docs.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
bun run format
git add src/lib/docs.ts src/lib/docs.test.ts
git commit -m "$(cat <<'EOF'
feat: add docHref to rewrite upstream markdown links

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Heading extraction, lead paragraph, slug-from-path

**Files:**
- Modify: `src/lib/docs.ts`
- Modify: `src/lib/docs.test.ts`

**Interfaces:**
- Consumes: `docHref` (Task 2).
- Produces:
  - `extractHeadings(md: string): Heading[]` where `type Heading = { depth: 2 | 3; text: string; id: string }`
  - `leadParagraph(md: string): string`
  - `slugFromPath(path: string): string`

Two correctness requirements that are load-bearing, not defensive:

1. **Code fences must not yield headings.** Piper's docs are dense with shell; `# install the App on your repo` inside a bash fence would otherwise become a TOC entry. Requiring a zero-indent `#` additionally excludes the 4-space indented code blocks that `custom-domains.md` uses.
2. **The slugger must see every heading, h1–h6, in document order — but only h2/h3 are returned.** `rehype-slug` (Task 5) slugs all headings with the same `github-slugger`, and the slugger dedupes by appending `-1`, `-2`. If `extractHeadings` skipped an h1 that shares text with a later h2, its counter would diverge from `rehype-slug`'s and the TOC would link to anchors that do not exist.

- [ ] **Step 1: Install `github-slugger`**

Run: `bun add github-slugger`

- [ ] **Step 2: Write the failing tests**

Append to `src/lib/docs.test.ts`:

```ts
import { extractHeadings, leadParagraph, slugFromPath } from "./docs";

test("extracts h2 and h3 headings with github anchors", () => {
	const md = "# Title\n\n## Box-wide base domain\n\n### Via the control API\n";
	expect(extractHeadings(md)).toEqual([
		{ depth: 2, text: "Box-wide base domain", id: "box-wide-base-domain" },
		{ depth: 3, text: "Via the control API", id: "via-the-control-api" },
	]);
});

test("ignores headings inside fenced code blocks", () => {
	const md = [
		"## Git deploys",
		"",
		"```bash",
		"# install the App on your repo in GitHub, then:",
		"git push",
		"```",
		"",
		"## Next",
	].join("\n");
	expect(extractHeadings(md).map((h) => h.text)).toEqual([
		"Git deploys",
		"Next",
	]);
});

test("ignores indented code blocks", () => {
	const md = "## Real\n\n    # not a heading\n";
	expect(extractHeadings(md).map((h) => h.text)).toEqual(["Real"]);
});

test("counts skipped headings so anchors match rehype-slug", () => {
	// The h1 "Setup" consumes the bare `setup` slug, so the h2 must be `setup-1`.
	const md = "# Setup\n\n## Setup\n";
	expect(extractHeadings(md)).toEqual([
		{ depth: 2, text: "Setup", id: "setup-1" },
	]);
});

test("reads the first paragraph after the h1", () => {
	const md = "# Getting started\n\nThe full journey, in order.\n\nMore text.\n";
	expect(leadParagraph(md)).toBe("The full journey, in order.");
});

test("returns an empty lead when there is no prose", () => {
	expect(leadParagraph("# Title\n")).toBe("");
});

test("derives a slug from a content path", () => {
	expect(slugFromPath("../content/docs/getting-started.md")).toBe(
		"getting-started",
	);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `bun test src/lib/docs.test.ts`
Expected: FAIL — `extractHeadings`, `leadParagraph`, `slugFromPath` are not exported.

- [ ] **Step 4: Implement the three helpers**

Append to `src/lib/docs.ts` (and add `import GithubSlugger from "github-slugger";` at the top):

```ts
export type Heading = { depth: 2 | 3; text: string; id: string };

// Feed the slugger every heading, h1-h6, so its dedupe counters stay in step
// with rehype-slug's; return only the h2/h3 the TOC renders.
export function extractHeadings(md: string): Heading[] {
	const slugger = new GithubSlugger();
	const headings: Heading[] = [];
	let inFence = false;

	for (const line of md.split("\n")) {
		if (/^\s*(```|~~~)/.test(line)) {
			inFence = !inFence;
			continue;
		}
		if (inFence) continue;

		// Zero-indent only: an indented `#` is a code block, not a heading.
		const match = /^(#{1,6}) +(.+?)\s*$/.exec(line);
		if (!match) continue;

		const depth = match[1].length;
		const text = match[2];
		const id = slugger.slug(text);
		if (depth === 2 || depth === 3) headings.push({ depth, text, id });
	}

	return headings;
}

export function leadParagraph(md: string): string {
	const body = md.replace(/^#\s+.*$/m, "");
	const paragraph = body
		.split("\n\n")
		.map((block) => block.trim())
		.find((block) => block !== "" && !block.startsWith("#"));
	return paragraph ? paragraph.replace(/\s+/g, " ") : "";
}

export function slugFromPath(path: string): string {
	return path.split("/").pop()?.replace(/\.md$/, "") ?? "";
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun test src/lib/docs.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 6: Commit**

```bash
bun run format
git add src/lib/docs.ts src/lib/docs.test.ts package.json bun.lock
git commit -m "$(cat <<'EOF'
feat: add heading, lead-paragraph, and slug helpers for docs

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Manifest and the quarantined content loader

**Files:**
- Create: `src/content/docs/manifest.ts`
- Create: `src/lib/docs-content.ts`

**Interfaces:**
- Consumes: `slugFromPath` (Task 3).
- Produces:
  - `type DocEntry = { slug: string; title: string }` and `DOCS: DocEntry[]` from `@/content/docs/manifest`
  - `docSources(): Record<string, string>` (slug → raw markdown) from `@/lib/docs-content`

**This task has no tests, deliberately.** `docs-content.ts` contains `import.meta.glob`, a Vite-only transform that throws `TypeError: import.meta.glob is not a function` under `bun test` (verified). Quarantining it here — imported only by routes, which the house rules already leave untested — is what keeps every other module testable. Do not import `@/lib/docs-content` from anything under `src/components/` or `src/lib/`.

- [ ] **Step 1: Create the empty manifest**

```ts
// src/content/docs/manifest.ts
// Nav order and labels live here, not as frontmatter upstream: GitHub renders
// YAML frontmatter as a table atop the file, degrading the GitHub reading
// experience that keeping the source in piperbox/piper is meant to protect.
export type DocEntry = { slug: string; title: string };

// Empty until piper's docs are reworked. Add entries after `bun run sync:docs`.
export const DOCS: DocEntry[] = [];
```

- [ ] **Step 2: Create the quarantined loader**

```ts
// src/lib/docs-content.ts
// QUARANTINE: import.meta.glob is a Vite-only transform and throws under
// `bun test`. This module must be imported ONLY from src/routes/docs/*.
// Everything else takes markdown as a prop so it stays testable.
import { slugFromPath } from "@/lib/docs";

export function docSources(): Record<string, string> {
	const modules = import.meta.glob("../content/docs/*.md", {
		query: "?raw",
		eager: true,
		import: "default",
	}) as Record<string, string>;

	return Object.fromEntries(
		Object.entries(modules).map(([path, md]) => [slugFromPath(path), md]),
	);
}
```

- [ ] **Step 3: Verify typecheck and the full suite still pass**

Run: `bun run typecheck && bun test`
Expected: PASS. Typecheck resolves `import.meta.glob` because `vite/client` is already in `tsconfig.json`'s `types`. The test suite passes because nothing imports `docs-content.ts` yet.

- [ ] **Step 4: Verify the build resolves the empty glob**

Run: `bun run build`
Expected: PASS. An empty `src/content/docs/` yields `{}` rather than a build error.

- [ ] **Step 5: Commit**

```bash
bun run format
git add src/content/docs/manifest.ts src/lib/docs-content.ts
git commit -m "$(cat <<'EOF'
feat: add docs manifest and quarantined content loader

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `DocsPage` — markdown rendered as React

**Files:**
- Create: `src/components/docs-page.tsx`
- Create: `src/components/docs-page.test.tsx`

**Interfaces:**
- Consumes: `docHref`, `extractHeadings` (Tasks 2-3); `Panel` from `@/components/ui/panel`.
- Produces: `<DocsPage markdown={string} />`. Task 7's `$slug` route renders it.

Notes for the implementer:

- `react-markdown` v9+ takes the markdown as `children` and **dropped the `className` prop** — wrap it in a `<div>` for styling.
- Custom components receive a `node` prop that must be destructured away; spreading it onto a DOM element triggers React warnings.
- `rehype-slug` puts the `id` on heading elements, so the `h2`/`h3` overrides receive `id` via `...rest`.
- `DocsPage` renders `<Link>`, which needs a router context to mount. Copy the `renderLanding` helper pattern from `src/components/landing-page.test.tsx:10-17`.

- [ ] **Step 1: Install the markdown dependencies**

Run: `bun add react-markdown remark-gfm rehype-slug`

- [ ] **Step 2: Write the failing tests**

```tsx
// src/components/docs-page.test.tsx
import { expect, test } from "bun:test";
import {
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { DocsPage } from "./docs-page";

// DocsPage renders <Link>, which needs a router context to mount.
async function renderDoc(markdown: string) {
	const rootRoute = createRootRoute({
		component: () => <DocsPage markdown={markdown} />,
	});
	const router = createRouter({ routeTree: rootRoute });
	await router.navigate({ to: "/" });
	// biome-ignore lint/suspicious/noExplicitAny: test router typing shortcut
	render(<RouterProvider router={router as any} />);
}

test("renders the document title and prose", async () => {
	await renderDoc("# Getting started\n\nThe full journey.\n");
	expect(
		screen.getByRole("heading", { level: 1 }).textContent,
	).toContain("Getting started");
	expect(screen.getByText("The full journey.")).toBeTruthy();
});

test("gives headings github-compatible anchor ids", async () => {
	await renderDoc("# T\n\n## Box-wide base domain\n");
	expect(
		screen.getByRole("heading", { level: 2 }).getAttribute("id"),
	).toBe("box-wide-base-domain");
});

test("rewrites markdown links to docs routes", async () => {
	await renderDoc("# T\n\n[getting started](getting-started.md#install)\n");
	expect(
		screen.getByRole("link", { name: "getting started" }).getAttribute("href"),
	).toBe("/docs/getting-started#install");
});

test("opens external links in a new tab", async () => {
	await renderDoc("# T\n\n[site](https://example.com)\n");
	const link = screen.getByRole("link", { name: "site" });
	expect(link.getAttribute("target")).toBe("_blank");
	expect(link.getAttribute("rel")).toBe("noreferrer");
});

test("renders fenced code blocks", async () => {
	await renderDoc("# T\n\n```bash\npiper connect\n```\n");
	expect(screen.getByText("piper connect")).toBeTruthy();
});

test("renders gfm tables", async () => {
	await renderDoc("# T\n\n| Feature | State |\n| --- | --- |\n| Relay | ok |\n");
	expect(screen.getByRole("table")).toBeTruthy();
	expect(screen.getByRole("columnheader", { name: "Feature" })).toBeTruthy();
	expect(screen.getByRole("cell", { name: "Relay" })).toBeTruthy();
});

test("lists h2 and h3 headings in the table of contents", async () => {
	await renderDoc("# T\n\n## Install\n\n### Linux\n");
	const toc = screen.getByRole("navigation", { name: "On this page" });
	expect(toc.textContent).toContain("Install");
	expect(toc.textContent).toContain("Linux");
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `bun test src/components/docs-page.test.tsx`
Expected: FAIL — cannot resolve `./docs-page`.

- [ ] **Step 4: Implement `DocsPage`**

```tsx
// src/components/docs-page.tsx
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import Markdown from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { Panel } from "@/components/ui/panel";
import { docHref, extractHeadings } from "@/lib/docs";

function DocLink({ href, children }: { href?: string; children?: ReactNode }) {
	const link = docHref(href ?? "");
	if (link.external) {
		return (
			<a href={link.href} target="_blank" rel="noreferrer">
				{children}
			</a>
		);
	}
	return <Link to={link.href}>{children}</Link>;
}

export function DocsPage({ markdown }: { markdown: string }) {
	const headings = extractHeadings(markdown);

	return (
		<div className="flex gap-8">
			<article className="min-w-0 flex-1 text-sm leading-6">
				<Markdown
					remarkPlugins={[remarkGfm]}
					rehypePlugins={[rehypeSlug]}
					components={{
						h1: ({ node, children, ...rest }) => (
							<h1 className="mb-4 font-semibold text-xl" {...rest}>
								<span className="text-muted-foreground">{"# "}</span>
								{children}
							</h1>
						),
						h2: ({ node, children, ...rest }) => (
							<h2 className="mt-8 mb-3 font-semibold text-base" {...rest}>
								<span className="text-muted-foreground">{"## "}</span>
								{children}
							</h2>
						),
						h3: ({ node, children, ...rest }) => (
							<h3
								className="mt-6 mb-2 font-semibold text-muted-foreground text-sm"
								{...rest}
							>
								{children}
							</h3>
						),
						p: ({ node, ...rest }) => <p className="my-3" {...rest} />,
						ul: ({ node, ...rest }) => (
							<ul className="my-3 list-disc space-y-1 pl-5" {...rest} />
						),
						ol: ({ node, ...rest }) => (
							<ol className="my-3 list-decimal space-y-1 pl-5" {...rest} />
						),
						pre: ({ node, ...rest }) => (
							<Panel className="my-4 overflow-x-auto">
								<pre className="p-3 text-xs" {...rest} />
							</Panel>
						),
						code: ({ node, ...rest }) => (
							<code className="text-primary text-xs" {...rest} />
						),
						a: ({ node, href, children }) => (
							<DocLink href={href}>{children}</DocLink>
						),
						table: ({ node, ...rest }) => (
							<div className="my-4 overflow-x-auto">
								<table className="w-full text-left text-xs" {...rest} />
							</div>
						),
						th: ({ node, ...rest }) => (
							<th
								className="border-border border-b px-3 py-2 font-medium text-muted-foreground"
								{...rest}
							/>
						),
						td: ({ node, ...rest }) => (
							<td className="border-border/50 border-b px-3 py-2" {...rest} />
						),
					}}
				>
					{markdown}
				</Markdown>
			</article>

			{headings.length > 0 && (
				<nav
					aria-label="On this page"
					className="hidden w-48 shrink-0 self-start text-xs lg:block"
				>
					<div className="mb-2 text-[11px] text-muted-foreground uppercase tracking-wider">
						On this page
					</div>
					<ul className="space-y-1">
						{headings.map((h) => (
							<li key={h.id} className={h.depth === 3 ? "pl-3" : undefined}>
								<a href={`#${h.id}`}>{h.text}</a>
							</li>
						))}
					</ul>
				</nav>
			)}
		</div>
	);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun test src/components/docs-page.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
bun run format
git add src/components/docs-page.tsx src/components/docs-page.test.tsx package.json bun.lock
git commit -m "$(cat <<'EOF'
feat: render docs markdown onto the terminal design system

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `DocsLayout` and `DocsIndex`

**Files:**
- Create: `src/components/docs-layout.tsx`
- Create: `src/components/docs-layout.test.tsx`
- Create: `src/components/docs-index.tsx`
- Create: `src/components/docs-index.test.tsx`

**Interfaces:**
- Consumes: `DocEntry` (Task 4), `leadParagraph` (Task 3), `REPO_URL` (Task 1), `Panel`.
- Produces: `<DocsLayout docs={DocEntry[]}>{children}</DocsLayout>` and `<DocsIndex docs={DocEntry[]} leads={Record<string, string>} />`. Task 7 renders both.

Both take their data as props — never importing `@/lib/docs-content` — which is what keeps them testable.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/docs-layout.test.tsx
import { expect, test } from "bun:test";
import {
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { DocsLayout } from "./docs-layout";

async function renderLayout(docs: { slug: string; title: string }[]) {
	const rootRoute = createRootRoute({
		component: () => <DocsLayout docs={docs}>body</DocsLayout>,
	});
	const router = createRouter({ routeTree: rootRoute });
	await router.navigate({ to: "/" });
	// biome-ignore lint/suspicious/noExplicitAny: test router typing shortcut
	render(<RouterProvider router={router as any} />);
}

test("lists every manifest entry in the sidebar", async () => {
	await renderLayout([
		{ slug: "getting-started", title: "Getting started" },
		{ slug: "custom-domains", title: "Custom domains" },
	]);
	expect(
		screen.getByRole("link", { name: "Getting started" }).getAttribute("href"),
	).toBe("/docs/getting-started");
	expect(screen.getByRole("link", { name: "Custom domains" })).toBeTruthy();
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

```tsx
// src/components/docs-index.test.tsx
import { expect, test } from "bun:test";
import {
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { DocsIndex } from "./docs-index";

async function renderIndex(
	docs: { slug: string; title: string }[],
	leads: Record<string, string> = {},
) {
	const rootRoute = createRootRoute({
		component: () => <DocsIndex docs={docs} leads={leads} />,
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

test("lists each doc with its lead paragraph", async () => {
	await renderIndex(
		[{ slug: "getting-started", title: "Getting started" }],
		{ "getting-started": "The full journey, in order." },
	);
	expect(
		screen.getByRole("link", { name: /Getting started/ }).getAttribute("href"),
	).toBe("/docs/getting-started");
	expect(screen.getByText("The full journey, in order.")).toBeTruthy();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/components/docs-layout.test.tsx src/components/docs-index.test.tsx`
Expected: FAIL — cannot resolve `./docs-layout` / `./docs-index`.

- [ ] **Step 3: Implement `DocsLayout`**

```tsx
// src/components/docs-layout.tsx
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { DocEntry } from "@/content/docs/manifest";
import { REPO_URL } from "@/lib/links";

export function DocsLayout({
	docs,
	children,
}: {
	docs: DocEntry[];
	children: ReactNode;
}) {
	return (
		<div className="min-h-screen">
			<header className="flex items-center gap-4 border-border border-b px-4 py-3 text-xs">
				<Link to="/" className="font-semibold">
					piper
				</Link>
				<span className="text-muted-foreground">docs</span>
				<div className="ml-auto flex items-center gap-4">
					<a href={REPO_URL} target="_blank" rel="noreferrer">
						github
					</a>
					<Link to="/apps">dashboard</Link>
				</div>
			</header>

			<div className="mx-auto flex max-w-5xl gap-8 px-4 py-8">
				{docs.length > 0 && (
					<nav
						aria-label="Documentation"
						className="hidden w-44 shrink-0 self-start text-xs lg:block"
					>
						<ul className="space-y-1">
							{docs.map((doc) => (
								<li key={doc.slug}>
									<Link to="/docs/$slug" params={{ slug: doc.slug }}>
										{doc.title}
									</Link>
								</li>
							))}
						</ul>
					</nav>
				)}
				<main className="min-w-0 flex-1">{children}</main>
			</div>
		</div>
	);
}
```

- [ ] **Step 4: Implement `DocsIndex`**

```tsx
// src/components/docs-index.tsx
import { Link } from "@tanstack/react-router";
import { Panel } from "@/components/ui/panel";
import type { DocEntry } from "@/content/docs/manifest";
import { PageHeader } from "@/components/ui/page-header";

export function DocsIndex({
	docs,
	leads,
}: {
	docs: DocEntry[];
	leads: Record<string, string>;
}) {
	return (
		<div className="flex flex-col gap-6">
			<PageHeader title="docs" subtitle="Guides for running piper." />
			{docs.length === 0 ? (
				<Panel className="px-3 py-6 text-muted-foreground text-sm">
					No docs published yet — read them on GitHub in the meantime.
				</Panel>
			) : (
				<ul className="flex flex-col gap-4">
					{docs.map((doc) => (
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
			)}
		</div>
	);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun test src/components/docs-layout.test.tsx src/components/docs-index.test.tsx`
Expected: PASS, 5 tests.

Note: the `<Link to="/docs/$slug">` calls will not typecheck until Task 7 creates the routes and the route tree regenerates. If `bun run typecheck` fails here with an unknown-route error, that is expected — it resolves in Task 7. Tests pass regardless, because the test router uses a bare root route.

- [ ] **Step 6: Commit**

```bash
bun run format
git add src/components/docs-layout.tsx src/components/docs-layout.test.tsx src/components/docs-index.tsx src/components/docs-index.test.tsx
git commit -m "$(cat <<'EOF'
feat: add docs layout chrome and index listing

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Routes

**Files:**
- Create: `src/routes/docs/index.tsx`
- Create: `src/routes/docs/$slug.tsx`

**Interfaces:**
- Consumes: `DOCS` (Task 4), `docSources` (Task 4), `DocsLayout`, `DocsIndex` (Task 6), `DocsPage` (Task 5), `leadParagraph` (Task 3).
- Produces: the `/docs` and `/docs/$slug` routes.

These are the **only** modules permitted to import `@/lib/docs-content`. Both are public and shell-free — `staticData: { chrome: false }` follows the pattern `src/routes/index.tsx` set for the landing page, so the authed `AppFrame` (org switcher, invites) does not wrap them and `/docs` works logged out. Structure mirrors the existing `boxes/index.tsx` + `boxes/$base.tsx` pair. No tests: tests never live in `src/routes/`.

- [ ] **Step 1: Create the index route**

```tsx
// src/routes/docs/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { DocsIndex } from "@/components/docs-index";
import { DocsLayout } from "@/components/docs-layout";
import { DOCS } from "@/content/docs/manifest";
import { leadParagraph } from "@/lib/docs";
import { docSources } from "@/lib/docs-content";

export const Route = createFileRoute("/docs/")({
	staticData: { chrome: false },
	component: DocsIndexPage,
});

function DocsIndexPage() {
	const sources = docSources();
	const leads = Object.fromEntries(
		DOCS.map((doc) => [doc.slug, leadParagraph(sources[doc.slug] ?? "")]),
	);
	return (
		<DocsLayout docs={DOCS}>
			<DocsIndex docs={DOCS} leads={leads} />
		</DocsLayout>
	);
}
```

- [ ] **Step 2: Create the slug route**

```tsx
// src/routes/docs/$slug.tsx
import { createFileRoute, notFound } from "@tanstack/react-router";
import { DocsLayout } from "@/components/docs-layout";
import { DocsPage } from "@/components/docs-page";
import { DOCS } from "@/content/docs/manifest";
import { docSources } from "@/lib/docs-content";

export const Route = createFileRoute("/docs/$slug")({
	staticData: { chrome: false },
	loader: ({ params }) => {
		const markdown = docSources()[params.slug];
		if (!markdown) throw notFound();
		return { markdown };
	},
	component: DocPage,
});

function DocPage() {
	const { markdown } = Route.useLoaderData();
	return (
		<DocsLayout docs={DOCS}>
			<DocsPage markdown={markdown} />
		</DocsLayout>
	);
}
```

- [ ] **Step 3: Regenerate the route tree and typecheck**

Run: `bun run generate-routes && bun run typecheck`
Expected: PASS. The `<Link to="/docs/$slug">` calls from Task 6 now resolve.

- [ ] **Step 4: Verify the page renders in the dev server**

Run: `bun run dev`, then open `http://localhost:3000/docs`
Expected: the docs chrome with the "No docs published yet" panel, no sidebar (empty manifest), and no app shell. `http://localhost:3000/docs/nope` 404s. Stop the server when done.

- [ ] **Step 5: Commit**

```bash
bun run format
git add src/routes/docs
git commit -m "$(cat <<'EOF'
feat: add public /docs routes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: The sync script

**Files:**
- Create: `scripts/sync-docs.ts`
- Create: `scripts/sync-docs.test.ts`
- Modify: `package.json` (add the `sync:docs` script)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `bun run sync:docs`, plus two exported pure functions the tests drive: `rawUrl(file: string): string` and `fetchDocs(fetchImpl: typeof fetch): Promise<{ files: Record<string, string>; sha: string }>`.

No pinned ref by design: the snapshot is committed, so the git commit *is* the pin. `source.json` records which piper commit the snapshot came from, making each sync diff self-describing. The script must fail loudly on a 404 or an empty body rather than committing a truncated docs site.

- [ ] **Step 1: Write the failing tests**

```ts
// scripts/sync-docs.test.ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test scripts/sync-docs.test.ts`
Expected: FAIL — cannot resolve `./sync-docs`.

- [ ] **Step 3: Implement the script**

```ts
// scripts/sync-docs.ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test scripts/sync-docs.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Add the package script**

In `package.json`, add to `"scripts"`:

```json
"sync:docs": "bun run scripts/sync-docs.ts",
```

- [ ] **Step 6: Commit**

```bash
bun run format
git add scripts package.json
git commit -m "$(cat <<'EOF'
feat: add bun run sync:docs to snapshot piper's docs

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Full verification

**Files:** none created; this task only verifies and fixes.

- [ ] **Step 1: Run the full gate**

Run: `bun run verify`
Expected: PASS — Biome, then `tsc --noEmit`, then `bun test`, then `vite build`.

- [ ] **Step 2: Confirm the success criteria from the spec**

- [ ] `bun run verify` passes with an empty manifest and zero committed docs.
- [ ] `/docs` renders its empty state; `/docs/unknown` 404s (checked in Task 7 Step 4).
- [ ] `grep -rn "openpiper" src/` returns only `get.openpiper.dev` in `src/lib/links.ts`.
- [ ] `grep -rn "docs-content" src/components src/lib` returns nothing — the quarantine holds.

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin fco/docs-site-bedrock
gh pr create --title "[app] docs site bedrock at /docs (no content yet)" --body "$(cat <<'EOF'
Machinery for a public `/docs` surface that renders markdown synced from
`piperbox/piper`. **No documentation content ships** — the manifest is empty
and nothing links to `/docs` — because piper's prose needs rework first.

- `bun run sync:docs` snapshots upstream docs into `src/content/docs/`
- `react-markdown` rendering mapped onto the terminal design system
- `openpiper` → `piperbox` rename, via a new shared `src/lib/links.ts`

Spec: `docs/superpowers/specs/2026-07-25-docs-site-design.md`

Once content lands, running the sync and adding manifest entries lights up the
site with no code changes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
