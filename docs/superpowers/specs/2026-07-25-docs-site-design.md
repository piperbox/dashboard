# Docs site (bedrock)

A public, unauthenticated docs surface at `/docs`, rendering markdown that
lives in the **piper repo** (`piperbox/piper`), synced into this repo as a
committed snapshot. This ships the **machinery only** — no documentation
content — because piper's prose needs rework before it is worth publishing.

## Background

Today the landing page's "docs" links point straight at
`github.com/openpiper/piper` (`src/components/landing-page.tsx:6`, used at
lines 103/153/306). There is no docs page.

Piper's user-facing docs already exist upstream as `docs/getting-started.md`,
`docs/custom-domains.md`, and `docs/manual-setup.md`. They are written as
GitHub-repo prose: no frontmatter (titles are the `# H1`), relative
cross-links such as `[getting started](getting-started.md#install)`, and
GitHub-slug anchors such as `#per-app-domains-piper-domains--no-dns-token`.

### Source-of-truth decision

Markdown stays in `piperbox/piper`. That repo is the project's public face and
developers should be able to read the docs there, next to the code they
describe. The dashboard is a **renderer**, never the origin.

### Branding

The org rename `getpiper` → `openpiper` → **`piperbox`** lands its final hop
here. Repo slug is `piperbox/piper` (the repo itself is not renamed). The
GitHub App was also renamed `getpiper` → `piperbox`, but that is transparent
to this codebase: the install URL is not hardcoded, it arrives from the relay
as `installUrl` (`src/server/relay.ts`, asserted in `relay.test.ts:611`).

## Scope

**In:** `bun run sync:docs` sync script; `/docs` and `/docs/$slug` routes; a
`DocsLayout` (top bar, sidebar, TOC rail); markdown→React rendering mapped
onto the terminal design system; pure helpers for link rewriting, heading
extraction, and lead-paragraph extraction; an empty-manifest empty state;
extraction of a shared `src/lib/links.ts` and the `openpiper` → `piperbox`
rename at its two call sites in `landing-page.tsx`.

**Out:** any documentation content (manifest ships empty); syntax
highlighting; docs search; versioned docs; the `get.openpiper.dev` →
`get.piperbox.dev` install host (a live DNS name — renaming the string before
the host exists would ship a copy-button that hands people a dead URL);
`import-wizard.tsx:698`'s `placeholder="getpiper/example"` (an example repo
name, not a link — flagged, not changed); automated sync via scheduled
workflow; linking `/docs` from anywhere in the UI.

The last two deserve a note. `/docs` ships **unlinked**: the landing page's
docs links keep pointing at GitHub until real content lands, so no user
reaches an empty page. And sync stays a manual command — the scheduled-PR
automation is a later, additive step that needs no design change.

## Architecture

### Content pipeline

`scripts/sync-docs.ts`, run as `bun run sync:docs`, fetches a fixed list of
paths from `raw.githubusercontent.com/piperbox/piper/main/docs/` and writes
them to `src/content/docs/*.md`, which are **committed**.

No pinned ref is needed: because the snapshot is committed, the git commit
*is* the pin. Reproducibility is already guaranteed by this repo's history, so
fetching `main` is both the simplest and the correct choice. The script also
writes `src/content/docs/source.json` (`{ sha, syncedAt }`) recording which
piper commit the snapshot came from — one extra call to the commits API, and
it makes every sync diff self-describing.

The script fails loudly on any 404 or empty body rather than silently
committing a truncated docs site.

Consequence of the build staying hermetic: CI, `bun run verify`, and the
`Dockerfile`'s `COPY . . && bun run build` are unaffected by this feature.
They remain a pure function of this repo's git tree, with no network
dependency and no runtime dependency on GitHub availability.

### Nav manifest

`src/content/docs/manifest.ts`, hand-authored **in this repo**:

```ts
export type DocEntry = { slug: string; title: string };
export const DOCS: DocEntry[] = [];
```

Ships empty. Order and nav labels live here rather than as frontmatter in
piper's markdown because **GitHub renders YAML frontmatter as a table at the
top of the file**, degrading exactly the GitHub-reading experience that
motivated keeping the source upstream. The manifest is the one thing the
dashboard owns; upstream prose stays untouched.

### Content loading

`src/lib/docs-content.ts` loads markdown with

```ts
import.meta.glob("../content/docs/*.md", {
  query: "?raw", eager: true, import: "default",
})
```

A glob, not static `?raw` imports: with no `.md` files committed yet, static
imports would fail `tsc --noEmit` and the build. The glob resolves to `{}`
when the directory is empty, so the build stays green at zero docs — and it is
the right shape regardless, since slugs are data.

### Pure helpers — `src/lib/docs.ts`

- **`docHref(href)`** — rewrites markdown links.
  `custom-domains.md#per-app-domains` → `/docs/custom-domains#per-app-domains`;
  other relative paths (e.g. `packaging/systemd/piperd.service`) →
  `<REPO_URL>/blob/main/<path>`, since those are repo files with no site
  equivalent; bare `#anchor` and absolute `http(s)` URLs pass through
  unchanged.
- **`extractHeadings(md)`** — h2/h3 for the on-page TOC, ids from
  `github-slugger` so they match GitHub's anchors exactly. It tracks fenced
  code state and requires a zero-indent `#`. This is load-bearing, not
  defensive: piper's docs are dense with shell, and a line like
  `# install the App on your repo` inside a bash fence would otherwise become
  a TOC entry. Requiring zero indent also excludes 4-space indented code
  blocks, which `custom-domains.md` uses.
- **`leadParagraph(md)`** — first paragraph after the H1, for the index page.

### Shared links — `src/lib/links.ts`

Exports the canonical repo URL (`https://github.com/piperbox/piper`) and the
install command. Three consumers justify the extraction: `landing-page.tsx`,
`DocsLayout`, and `docHref`'s blob fallback. Precedent: #50 consolidated
per-file constants into the `Button` primitive.

`landing-page.tsx` drops its local `GITHUB_URL` and imports from here; its
`INSTALL_CMD` moves too but keeps the `get.openpiper.dev` host until that DNS
name is repointed.

### Components and routes

- `src/components/docs-page.tsx` — `react-markdown` + `remark-gfm` +
  `rehype-slug`, with an explicit component map onto the terminal system:
  `a` → `docHref`, then TanStack `Link` for internal or
  `target="_blank" rel="noreferrer"` for external; `h2`/`h3` → anchored
  headings following `PageHeader`'s idiom; `pre` → a `Panel`-bordered mono
  block; `table` → the existing `Row` treatment.
- `src/components/docs-layout.tsx` — top bar (wordmark → `/`, GitHub,
  "dashboard" → `/apps`), manifest-driven sidebar, TOC rail on wide screens.
- `src/components/docs-index.tsx` — title + lead paragraph per manifest entry;
  an honest empty panel when the manifest is empty.
- `src/routes/docs/index.tsx` and `src/routes/docs/$slug.tsx`, mirroring the
  existing `boxes/index.tsx` + `boxes/$base.tsx` pair. Each composes
  `DocsLayout` directly rather than introducing a `docs/route.tsx` layout
  route — two call sites do not justify the extra routing indirection. Both public,
  both `staticData: { chrome: false }`, following the pattern
  `src/routes/index.tsx` established for the landing page — the authed
  `AppFrame` (org switcher, invites) is the wrong furniture for a docs site,
  and `/docs` must work logged out. Unknown slug → `notFound()`.

Routes stay thin; all logic lives in components and `lib`, because tests
cannot live in `src/routes/`.

`@tailwindcss/typography` is installed but unused, and stays unused: explicit
component mapping gives better control over the terminal look than `prose`
plus overrides. Flagged as pre-existing, not removed.

### Rejected alternatives

- **Docs framework as a separate site** (Astro Starlight, VitePress). Free
  sidebar/TOC/search, but a second stack, a second deploy target, and — the
  deciding problem — a second design system. The terminal aesthetic would have
  to be re-implemented as a theme and re-themed on every upstream major.
- **Fumadocs / Nextra.** Next.js-first; running Next alongside TanStack Start
  fights the "production serves on 8080 from one Dockerfile" constraint.
- **Build-time fetch with nothing committed.** Makes CI and every fresh clone
  require network to build; breaks offline development.
- **Runtime fetch from the GitHub API.** Freshest, and no deploy needed to
  publish — but it gives the docs page a live external dependency, so a
  GitHub outage or rate limit breaks the page that teaches people the product.
- **Git submodule.** `COPY . .` would silently ship empty docs when the
  submodule is not checked out.
- **404 while the manifest is empty.** A conditional-behavior branch for a
  transient state; the empty state is a real, tested behavior instead.

## Testing

Test-first, per the repo's discipline. Fixtures live in the test files, so no
test depends on a sync having run.

- `src/lib/docs.test.ts` — `docHref` across all five cases; `extractHeadings`
  including the fenced-code and indented-code guards; `leadParagraph`.
- `src/components/docs-page.test.tsx` — renders fixture markdown; asserts
  heading ids match GitHub slugs, `.md` links rewrite to `/docs/…`, external
  links carry `target`/`rel`, code blocks render.
- `src/components/docs-index.test.tsx` — empty state at zero entries; titles
  and leads at N entries.
- `src/components/docs-layout.test.tsx` — sidebar reflects the manifest; the
  GitHub link uses the shared constant.
- `src/components/landing-page.test.tsx` — existing assertions updated from
  `openpiper` to `piperbox` (`landing-page.test.tsx:26,29,65,71`).
- `scripts/sync-docs.test.ts` — URL construction and response validation via
  an injected `fetch`, including the fail-loud path on 404/empty. The IO
  wrapper stays thin.

Gate: `bun run verify` (Biome → `tsc --noEmit` → `bun test` → build).

## Success criteria

1. `bun run verify` passes with an empty manifest and zero committed docs.
2. `/docs` renders its empty state; `/docs/unknown` 404s.
3. Every `openpiper` reference in `src/` is gone except the deliberate
   `get.openpiper.dev` install host.
4. Running `bun run sync:docs`, then adding manifest entries, produces a
   working docs site **with no code changes**.

## New dependencies

`react-markdown`, `remark-gfm`, `rehype-slug`, `github-slugger`.
