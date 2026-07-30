import { createFileRoute, isRedirect, useRouter } from "@tanstack/react-router";
import { AppDetail } from "@/components/app-detail";
import { RelayError } from "@/components/relay-error";
import {
	addAppDomainFn,
	deleteAppFn,
	getAppDomains,
	getAppEnv,
	getBox,
	getDeploymentLogs,
	getDeployments,
	removeAppDomainFn,
	removeAppEnvFn,
	setAppEnvFn,
	startAppFn,
	stopAppFn,
} from "@/server/fns";
import type { AppDomainStatus, Deployment } from "@/server/relay";

export const Route = createFileRoute("/boxes/$base_/apps/$app")({
	loader: async ({ params }) => {
		const box = await getBox({ data: params.base });
		const app = box.connected
			? (box.apps.find((a) => a.name === params.app) ?? null)
			: null;
		// The empty branch is annotated because TS otherwise widens the tuple
		// into a union array.
		const [deployments, domains, env] = app
			? await Promise.all([
					getDeployments({ data: { base: params.base, app: params.app } }),
					getAppDomains({ data: { base: params.base, app: params.app } }),
					getAppEnv({ data: { base: params.base, app: params.app } }).catch(
						(err) => {
							if (isRedirect(err)) throw err;
							// A box on a piperd without the env endpoint 404s here; the
							// rest of the page must still render.
							return null;
						},
					),
				])
			: ([[], [], null] as [
					Deployment[],
					AppDomainStatus[],
					Record<string, string> | null,
				]);
		return { box, app, deployments, domains, env };
	},
	component: AppDetailPage,
	errorComponent: RelayError,
});

function AppDetailPage() {
	const { base, app: appName } = Route.useParams();
	const { box, app, deployments, domains, env } = Route.useLoaderData();
	const router = useRouter();
	return (
		<AppDetail
			appName={appName}
			base={base}
			connected={box.connected}
			app={app}
			deployments={deployments}
			domains={domains}
			env={env}
			fetchLogs={async (id) => {
				try {
					return await getDeploymentLogs({
						data: { base, app: appName, id },
					});
				} catch (err) {
					if (isRedirect(err)) throw err;
					return "Couldn't load logs.";
				}
			}}
			refresh={() => {
				router.invalidate();
			}}
			onStop={async () => {
				await stopAppFn({ data: { base, name: appName } });
				router.invalidate();
			}}
			onStart={async () => {
				await startAppFn({ data: { base, name: appName } });
				router.invalidate();
			}}
			onDelete={async () => {
				await deleteAppFn({ data: { base, name: appName } });
				await router.navigate({ to: "/boxes/$base", params: { base } });
			}}
			onSetEnv={async (key, value) => {
				await setAppEnvFn({ data: { base, app: appName, key, value } });
				router.invalidate();
			}}
			onRemoveEnv={async (key) => {
				await removeAppEnvFn({ data: { base, app: appName, key } });
				router.invalidate();
			}}
			onRestart={async () => {
				// Env applies on the next start; a running container has to come
				// down first. Invalidate in `finally` so a partial restart (stop
				// succeeds, start fails) still refreshes the status pill instead of
				// leaving it showing "running" for a stopped container.
				try {
					if (app?.status !== "stopped") {
						await stopAppFn({ data: { base, name: appName } });
					}
					await startAppFn({ data: { base, name: appName } });
				} finally {
					router.invalidate();
				}
			}}
			onAddDomain={async (domain) => {
				await addAppDomainFn({ data: { base, app: appName, domain } });
				router.invalidate();
			}}
			onRemoveDomain={async (domain) => {
				await removeAppDomainFn({ data: { base, app: appName, domain } });
				router.invalidate();
			}}
		/>
	);
}
