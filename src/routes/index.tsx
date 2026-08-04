import { createFileRoute, redirect } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing-page";
import { getSession } from "../server/fns";

// Public marketing landing at /. Authenticated visitors go straight to /apps.
export const Route = createFileRoute("/")({
	staticData: { chrome: false },
	head: () => ({
		meta: [
			{
				title: "Piper — deploy to your own box with one git push",
			},
			{
				name: "description",
				content:
					"Piper is an open-source, zero-trust PaaS: turn a cloud VM, an old laptop or a Pi behind CGNAT into a deploy target with a public HTTPS URL.",
			},
		],
	}),
	beforeLoad: async () => {
		const session = await getSession();
		if (session) throw redirect({ to: "/apps" });
	},
	component: LandingPage,
});
