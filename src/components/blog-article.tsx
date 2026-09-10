import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { markdownComponents } from "@/components/markdown-components";
import { type Article, formatDate } from "@/lib/blog";

// Renders one SEO Potion article. The body has no H1 (the title is ours),
// no cover (also ours), and embeds YouTube as a raw <iframe>, so raw HTML
// must be allowed. That HTML is trusted: it is committed into this repo by
// our own SEO Potion account.
export function BlogArticle({
	article,
	body,
}: {
	article: Article;
	body: string;
}) {
	const sizes = new Map(article.images.map((image) => [image.src, image]));

	return (
		<article className="text-sm leading-6">
			<h1 className="mb-2 font-semibold text-xl">
				<span className="text-muted-foreground">{"# "}</span>
				{article.title}
			</h1>
			<p className="mb-6 text-muted-foreground text-xs">
				<time dateTime={article.published_at}>
					{formatDate(article.published_at)}
				</time>
				{article.updated_at && (
					<>
						{" · "}
						<time dateTime={article.updated_at}>
							updated {formatDate(article.updated_at)}
						</time>
					</>
				)}
			</p>
			<img
				src={article.cover}
				alt={article.cover_alt}
				width={article.cover_width ?? undefined}
				height={article.cover_height ?? undefined}
				className="mb-6 h-auto w-full"
			/>
			<Markdown
				remarkPlugins={[remarkGfm]}
				rehypePlugins={[rehypeRaw]}
				components={{
					...markdownComponents,
					// Markdown can't carry dimensions; the manifest can. Skip any
					// whose size is null rather than guessing.
					img: ({ src, alt }) => {
						const size = typeof src === "string" ? sizes.get(src) : undefined;
						return (
							<img
								src={typeof src === "string" ? src : undefined}
								alt={alt ?? ""}
								width={size?.width ?? undefined}
								height={size?.height ?? undefined}
								loading="lazy"
								className="my-4 h-auto max-w-full"
							/>
						);
					},
					iframe: ({ node, ...rest }) => (
						<div className="my-4 aspect-video w-full">
							<iframe {...rest} className="h-full w-full" />
						</div>
					),
				}}
			>
				{body}
			</Markdown>
		</article>
	);
}
