// Canonical external URLs. Shared by the landing page, the docs chrome, and
// docs.ts's GitHub-blob fallback for links with no site equivalent.
export const REPO_URL = "https://github.com/piperbox/piper";

// NB: get.piperbox.dev must be repointed before this ships — the landing hero
// is the only consumer. See docs/superpowers/specs/2026-08-02-landing-animation-polish-design.md.
export const INSTALL_CMD =
	"curl -fsSL https://get.piperbox.dev/install.sh | sh";

// The dashboard's production origin. Fixed rather than derived from the
// request so PR previews and staging hosts canonicalize to production
// instead of being indexed as duplicates. No trailing slash.
export const SITE_ORIGIN = "https://piperbox.dev";
