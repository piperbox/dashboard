import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	const router = createTanStackRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		// SEO Potion's URL contract is /blog/<slug>/ with the slash. The
		// default ("never") strips it from every generated href; "preserve"
		// keeps each link as written. Every other link in the app is written
		// without a slash and is unaffected.
		trailingSlash: "preserve",
	});

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
