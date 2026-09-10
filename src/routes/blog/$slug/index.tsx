import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { BlogArticle } from "@/components/blog-article";
import { BlogLayout } from "@/components/blog-layout";
import { articleHead } from "@/lib/blog";
import { loadArticles, loadBody } from "@/lib/blog-content";

export const Route = createFileRoute("/blog/$slug/")({
	staticData: { chrome: false },
	// Only the trailing-slash form is canonical; send the other one there.
	beforeLoad: ({ location }) => {
		if (!location.pathname.endsWith("/")) {
			throw redirect({ href: `${location.pathname}/`, statusCode: 301 });
		}
	},
	loader: async ({ params }) => {
		const article = loadArticles().find((a) => a.slug === params.slug);
		if (!article) throw notFound();
		const body = await loadBody(params.slug);
		if (body === null) throw notFound();
		return { article, body };
	},
	head: ({ loaderData }) => (loaderData ? articleHead(loaderData.article) : {}),
	component: ArticlePage,
});

function ArticlePage() {
	const { article, body } = Route.useLoaderData();
	return (
		<BlogLayout>
			<BlogArticle article={article} body={body} />
		</BlogLayout>
	);
}
