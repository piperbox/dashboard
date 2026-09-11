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
