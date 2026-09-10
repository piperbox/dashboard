# Blog section, published by SEO Potion

A public, unauthenticated blog at `/blog/` whose content is written by
**SEO Potion** and committed into this repo through its GitHub "custom site"
integration. The dashboard renders what lands in the repo and owns every
SEO output the integration's contract leaves to the site: canonical URLs,
Open Graph and Twitter tags, `BlogPosting` and `BreadcrumbList` JSON-LD, and
`sitemap.xml`.

## Background

SEO Potion (`seopotion/seo`, docs at `/docs/custom-site`) publishes to
JavaScript-framework sites by committing files into a connected GitHub
repository. There is no API, webhook, or runtime fetch: a publish is one
commit, and the site's existing push-triggered deploy rebuilds it.

The contract, as documented there:

- The GitHub App gets **Contents: read and write** on the one repository. On
  connect, the user picks a branch, a **content folder**, and a **post URL
  base**.
- Each publish commits `<folder>/manifest.json` and
  `<folder>/articles/<slug>.md` together. Nothing else is written.
- `manifest.json` is `{ version: 1, generated_at, articles: [...] }`, with
  `articles` **already sorted newest first** and carrying every field the
  article frontmatter carries: `slug`, `title`, `meta_title`,
  `meta_description`, `keyword`, `cover`, `cover_alt`, `cover_width`,
  `cover_height`, `images[] { src, alt, width, height }`, `published_at`,
  `updated_at` (`null` until republished), `path` (repo-root-relative).
  Dimensions **may be `null`** on older articles. Renderers must **fail on
  any `version` other than 1**.
- The article file is YAML frontmatter then the body. The body **starts at
  `##`** — the H1 is the manifest `title` and belongs to the page template.
  YouTube embeds are raw `<iframe>` HTML, so the Markdown renderer must
  allow raw HTML. Images are absolute CDN URLs, already sized; Markdown
  cannot carry dimensions, so the renderer adds `width`/`height` from the
  manifest's `images` list.
- Public article URLs are **`<base>/<slug>/` with a trailing slash**, and
  that exact form must be used everywhere: links, canonical, `og:url`,
  JSON-LD, sitemap. The slash-less form may redirect; it must never fall
  through to the homepage. Unknown slugs must return a genuine 404.

The dashboard is a TanStack Start app server-rendered by Nitro, so crawlers
get complete HTML and the server can return real status codes. The existing
`/docs` site (`docs/superpowers/specs/2026-07-25-docs-site-design.md`) is the
template for the machinery: committed markdown, a quarantined
`import.meta.glob` loader, chromeless public routes, `react-markdown` mapped
onto the terminal design system.

## Decisions

- **Content source:** SEO Potion, via its GitHub integration. Not hand-written
  markdown, not a CMS.
- **Connection settings:** branch `main`, content folder `src/content/blog`,
  post URL base `https://piperbox.dev/blog`. The folder follows the
  `src/content/docs` convention rather than SEO Potion's `seopotion/` default.
- **Scope:** pages, per-article head tags, `BlogPosting` and `BreadcrumbList`
  JSON-LD, `sitemap.xml`. **No RSS feed.**
- **Absolute origin:** a constant `SITE_ORIGIN = "https://piperbox.dev"` in
  `src/lib/links.ts`. Fixed rather than derived from the request so PR
  previews and any staging host canonicalize to production instead of being
  indexed as duplicates.
- **Discovery:** `/blog` is linked from the landing page's nav and footer,
  next to "docs", from day one. Unlike docs, an empty blog is a transient
  state that ends at the first publish, and the empty state is honest.

## Scope

**In:** `/blog/` index and `/blog/$slug/` article routes; a quarantined
content loader; `PublicHeader` and a shared Markdown element map extracted
from the docs components; `BlogLayout`, `BlogIndex`, `BlogArticle`; pure SEO
helpers in `src/lib/blog.ts`; `sitemap.xml` server route and pure builder;
`Sitemap:` line in `robots.txt`; `SITE_ORIGIN`; landing nav/footer links;
router `trailingSlash: "preserve"`; `rehype-raw` dependency.

**Out:** RSS; any blog content (SEO Potion writes it); tags, categories,
pagination, search, author pages; syntax highlighting; cover thumbnails on
the index; an Open Graph image for the index page; `robots.txt` disallow
rules for authenticated routes; any change to `/docs` behaviour.

## Architecture

### Content and loading

`src/lib/blog-content.ts` is **quarantined** exactly like `docs-content.ts`:
`import.meta.glob` is a Vite-only transform and throws under `bun test`, so
this module is imported only from `src/routes/`. Everything else takes
manifest data and bodies as props or arguments.

```ts
// eager: the manifest is one small JSON file every blog route needs.
// A glob rather than a static import so the build is green before the
// first publish, when the file does not exist: the glob resolves to {}.
const manifests = import.meta.glob("../content/blog/manifest.json", {
	eager: true,
	import: "default",
});

// lazy: one chunk per article, fetched only by the route that renders it.
const bodies = import.meta.glob("../content/blog/articles/*.md", {
	query: "?raw",
	import: "default",
}) as Record<string, () => Promise<string>>;

export function loadArticles(): Article[]; // parseManifest(first value) or []
export async function loadBody(slug: string): Promise<string | null>;
```

`src/lib/blog.ts` owns the `Article` and `ArticleImage` types (mirroring the
manifest) and the pure helpers:

- `parseManifest(raw: unknown): Article[]` — returns `articles`; throws on
  `version !== 1`. Order is preserved as given (newest first).
- `stripFrontmatter(md: string): string` — the contract's regex,
  `^---\r?\n[\s\S]*?\r?\n---\r?\n`. No YAML parsing anywhere; the manifest
  carries every field.
- `formatDate(iso: string): string` — `Intl.DateTimeFormat("en-GB",
  { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })`,
  so SSR and client output are byte-identical and never mismatch on
  hydration.
- `articleUrl(slug: string): string` — `${SITE_ORIGIN}/blog/${slug}/`.
- `articleHead(article: Article)` and `blogIndexHead()` — see SEO output.

### Routes and URLs

- `src/routes/blog/index.tsx` → `/blog/`. Loader: `{ articles:
  loadArticles() }`. No bodies are loaded for the index.
- `src/routes/blog/$slug/index.tsx` → `/blog/$slug/`. Placing the article
  route as an index route under `$slug/` makes the generated path itself
  carry the trailing slash. Loader: find the article in the manifest, load
  its body; either missing → `throw notFound()`, which sets the router
  status to 404 and so the HTTP status of the server-rendered response.
- `beforeLoad` on the article route: if `location.pathname` does not end in
  `/`, `throw redirect({ href: <pathname + "/">, statusCode: 301 })`. Only
  the canonical form is ever indexed.
- `src/router.tsx` sets `trailingSlash: "preserve"`. The default `"never"`
  strips the slash from every generated href, which would make `Link
  to="/blog/$slug/"` emit `/blog/x`. `"preserve"` keeps each link as
  written; every existing link in the app is written without a slash, so
  none change. (`"always"` would append a slash to every dashboard URL and
  is rejected.)
- Both routes are `staticData: { chrome: false }` and public, following
  `/docs`. No auth redirect: a logged-in visitor sees the same page.
- Routes stay thin. `head` is `({ loaderData }) =>
  articleHead(loaderData.article)` and `blogIndexHead()`; all logic lives in
  `lib` and components because tests cannot live in `src/routes/`.

### Rendering

Two extractions from the docs code, each a targeted improvement that the
blog needs and that leaves `/docs` behaviour unchanged:

- `src/components/public-header.tsx` — `PublicHeader({ section })`: wordmark
  → `/`, a muted section label ("docs" / "blog"), and GitHub + "dashboard"
  links on the right. Lifted verbatim out of `DocsLayout`, which now renders
  `<PublicHeader section="docs" />` above its sidebar layout.
- `src/components/markdown-components.tsx` — the styled element map for
  `h2`, `h3`, `p`, `ul`, `ol`, `pre`, `code`, `table`, `th`, `td`, lifted
  verbatim out of `DocsPage`. `DocsPage` spreads it and keeps its own `h1`
  and `a` (the `docHref` rewriting). Without this the blog would carry a
  second copy of the terminal-styled map that drifts the first time either
  is touched.

New components:

- `src/components/blog-layout.tsx` — `PublicHeader section="blog"` plus a
  single centered column (`mx-auto max-w-3xl px-4 py-8`). No sidebar, no TOC
  rail.
- `src/components/blog-index.tsx` — `PageHeader title="blog"`, then the
  manifest order as given: title as a `Link to="/blog/$slug/"`, the
  `meta_description`, and `formatDate(published_at)`. Text-first, like the
  docs index; no cover thumbnails. Empty manifest → a `Panel` reading
  "Nothing published yet." in the docs-index idiom.
- `src/components/blog-article.tsx` — `BlogArticle({ article, body })`:
  1. `h1` from `article.title`, in the `DocsPage` h1 style.
  2. A date line: `formatDate(published_at)`, and `· updated
     formatDate(updated_at)` when `updated_at` is set. Both in `<time
     dateTime>`.
  3. The cover: plain `<img src={cover} alt={cover_alt}>` with
     `width`/`height` when not `null`, omitted otherwise. It is not in the
     body; rendering it is the template's job.
  4. The body through `react-markdown` with `remarkGfm` and `rehypeRaw`,
     spreading the shared map and overriding only:
     - `img` — look the `src` up in `article.images`; set `width`/`height`
       when present, omit when `null`; `loading="lazy"`.
     - `iframe` — wrap in an `aspect-video w-full` box so YouTube embeds
       are responsive instead of a fixed small frame.
     Links are plain anchors; SEO Potion's internal links are absolute URLs
     to this origin and work as ordinary navigations.

**Raw HTML is trusted** here by design: the body is committed into this repo
by our own SEO Potion account, and the contract requires raw HTML for video
embeds. No sanitizer is added. Anyone with write access to `main` can already
ship arbitrary markup; this does not widen that.

### SEO output

`src/lib/links.ts` gains `SITE_ORIGIN`.

`articleHead(article)` returns the object a route `head()` returns:

- `meta`: `title` = `meta_title`; `description` = `meta_description`;
  `og:type` = `article`, `og:title`, `og:description`, `og:url` =
  `articleUrl`, `og:image` = `cover`, `og:image:alt`, and
  `og:image:width`/`height` only when not `null`;
  `article:published_time`, `article:modified_time` when `updated_at` is
  set; `twitter:card` = `summary_large_image`, `twitter:title`,
  `twitter:description`, `twitter:image`.
- `links`: `rel="canonical" href={articleUrl}`.
- `scripts`: two `type="application/ld+json"` inline scripts.
  - `BlogPosting`: `headline` = `title`, `description`, `image` = `cover`,
    `datePublished`, `dateModified` = `updated_at ?? published_at`,
    `keywords` = `keyword`, `url` and `mainEntityOfPage` = `articleUrl`,
    `author` and `publisher` both `{ "@type": "Organization", "name":
    "Piper", "url": SITE_ORIGIN }`.
  - `BreadcrumbList`: Home (`SITE_ORIGIN/`), Blog (`SITE_ORIGIN/blog/`),
    the article (`articleUrl`).
  - The JSON is serialized with `<` escaped as `\u003c`, so a `</script>`
    inside a title cannot terminate the tag.

`blogIndexHead()`: title "Piper blog", a fixed description, canonical
`${SITE_ORIGIN}/blog/`, `og:type` = `website`, `og:title`,
`og:description`, `og:url`. No image.

`src/lib/sitemap.ts` — `buildSitemap({ articles, docs }): string`, pure:

- `${SITE_ORIGIN}/` always.
- `${SITE_ORIGIN}/docs` and `${SITE_ORIGIN}/docs/<slug>` for each docs
  manifest entry, only when the docs manifest is non-empty (an empty-state
  page is not worth listing).
- `${SITE_ORIGIN}/blog/` and each `articleUrl`, only when there is at least
  one article. Articles carry `<lastmod>` = `updated_at ?? published_at`.
- Values are XML-escaped.

`src/routes/sitemap[.]xml.ts` — a `server.handlers.GET` route in the same
shape as `src/routes/api/auth/session.ts`, returning
`buildSitemap({ articles: loadArticles(), docs: DOCS })` with
`Content-Type: application/xml; charset=utf-8`.

`public/robots.txt` gains `Sitemap: https://piperbox.dev/sitemap.xml`.

### Landing page

`landing-page.tsx`'s nav and footer each gain a `Link to="/blog/"` labelled
"blog" beside the existing "docs" link, in the same classes.

### New dependency

`rehype-raw`.

### Rejected alternatives

- **Deriving the origin from the request.** Zero config, but previews and
  staging become self-canonical duplicates — the exact thing canonical tags
  exist to prevent.
- **`trailingSlash: "always"`.** Satisfies the contract but rewrites every
  dashboard URL.
- **Separate blog components with no extraction.** Freezes the docs code at
  the cost of a duplicated Markdown map that drifts.
- **Prerendering the blog to static files.** The app is already
  server-rendered; the contract only needs complete HTML at request time.
  Prerender adds a second rendering path with nothing to show for it.
- **A static `manifest.json` import.** Fails `tsc` and the build before the
  first publish. The glob resolves to `{}` instead.
- **RSS.** Not asked for; no syndication plan.

## Testing

Test-first, per the repo's discipline. Fixtures (a two-article manifest and
a body with an inline image, a `null`-sized image, and an `<iframe>`) live
in the test files; no test depends on a publish having happened.

- `src/lib/blog.test.ts` — `parseManifest`: returns articles in the given
  order, empty on no manifest, throws on `version: 2`; `stripFrontmatter`
  with `\n` and `\r\n`; `formatDate` fixed output; `articleUrl` trailing
  slash; `articleHead`: canonical, `og:url`, image dimensions present and
  omitted when `null`, `article:modified_time` only when updated, both
  JSON-LD scripts parse back to `BlogPosting` / `BreadcrumbList` with the
  right URLs and dates, and `</script>` in a title is escaped;
  `blogIndexHead` canonical.
- `src/lib/sitemap.test.ts` — landing only at zero docs and zero articles;
  blog URLs and `lastmod` at N articles; docs URLs at N docs; XML escaping.
- `src/components/blog-index.test.tsx` — empty state; N entries in manifest
  order; hrefs end in `/`.
- `src/components/blog-article.test.tsx` — H1 from manifest title; cover
  with dimensions; inline `img` gets `width`/`height` from the manifest and
  omits them for a `null` size; `iframe` survives rendering; updated line
  shown only when `updated_at` is set.
- `src/components/public-header.test.tsx` — section label; GitHub link uses
  `REPO_URL`. Existing `docs-layout.test.tsx` and `docs-page.test.tsx` are
  the regression gate for the two extractions and are not modified.
- `src/components/landing-page.test.tsx` — gains an assertion that a link to
  `/blog/` is present.
- `src/head.test.ts` — unchanged.

Gate: `bun run verify` (Biome → `tsc --noEmit` → `bun test` → build).

**Manual end-to-end** (in the implementation plan as explicit steps): with an
uncommitted fixture manifest and article placed under `src/content/blog/`,
`bun run build` and run `.output/server/index.mjs`; confirm with real
requests that `/blog/` is 200 and lists the article, `/blog/<slug>/` is 200
and contains both JSON-LD scripts and the canonical link, `/blog/<slug>` is a
301 to the slash form, `/blog/nope/` is 404, and `/sitemap.xml` is
`application/xml` listing the article. Remove the fixture and confirm
`bun run verify` still passes at zero articles. Fixtures are never
committed under `src/content/blog/` — SEO Potion owns that folder.

## Success criteria

1. `bun run verify` passes with no `src/content/blog/` directory at all.
2. `/blog/` renders the empty state; `/blog/anything/` is a real 404.
3. After SEO Potion's first publish commit lands on `main`, the article
   renders at `/blog/<slug>/` with canonical, Open Graph, both JSON-LD
   blocks, and appears in `/sitemap.xml` — **with no code changes**.
4. `/docs` renders exactly as before the extractions.
