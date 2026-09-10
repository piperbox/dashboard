import { createFileRoute } from "@tanstack/react-router";
import { BlogIndex } from "@/components/blog-index";
import { BlogLayout } from "@/components/blog-layout";
import { blogIndexHead } from "@/lib/blog";
import { loadArticles } from "@/lib/blog-content";

// Public, unauthenticated. Same page logged in or out.
export const Route = createFileRoute("/blog/")({
	staticData: { chrome: false },
	head: () => blogIndexHead(),
	loader: () => ({ articles: loadArticles() }),
	component: BlogIndexPage,
});

function BlogIndexPage() {
	const { articles } = Route.useLoaderData();
	return (
		<BlogLayout>
			<BlogIndex articles={articles} />
		</BlogLayout>
	);
}
