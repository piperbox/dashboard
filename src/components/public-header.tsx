import { Link } from "@tanstack/react-router";
import { REPO_URL } from "@/lib/links";

// Top bar shared by the public, chromeless surfaces (/docs, /blog).
export function PublicHeader({ section }: { section: string }) {
	return (
		<header className="flex items-center gap-4 border-border border-b px-4 py-3 text-xs">
			<Link to="/" className="font-semibold">
				piper
			</Link>
			<span className="text-muted-foreground">{section}</span>
			<div className="ml-auto flex items-center gap-4">
				<a href={REPO_URL} target="_blank" rel="noreferrer">
					github
				</a>
				<Link to="/apps">dashboard</Link>
			</div>
		</header>
	);
}
