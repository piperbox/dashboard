import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { type Article, formatDate } from "@/lib/blog";

// Articles arrive newest-first from the manifest; render in the order given.
export function BlogIndex({ articles }: { articles: Article[] }) {
	return (
		<div className="flex flex-col gap-6">
			<PageHeader title="blog" subtitle="Notes on running your own box." />
			{articles.length === 0 ? (
				<Panel className="px-3 py-6 text-muted-foreground text-sm">
					Nothing published yet.
				</Panel>
			) : (
				<ul className="flex flex-col gap-5">
					{articles.map((article) => (
						<li key={article.slug}>
							<Link to="/blog/$slug/" params={{ slug: article.slug }}>
								{article.title}
							</Link>
							<p className="mt-1 text-muted-foreground text-sm">
								{article.meta_description}
							</p>
							<time
								dateTime={article.published_at}
								className="text-muted-foreground text-xs"
							>
								{formatDate(article.published_at)}
							</time>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
