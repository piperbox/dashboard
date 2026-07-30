import { createFileRoute, isRedirect, useRouter } from "@tanstack/react-router";
import { AppDetail } from "@/components/app-detail";
import { RelayError } from "@/components/relay-error";
import {
	deleteAppFn,
	getAppDomains,
	getAppEnv,
	getBox,
	getDeploymentLogs,
	getDeployments,
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
					getAppEnv({ data: { base: params.base, app: params.app } }),
				])
			: ([[], [], {}] as [
					Deployment[],
					AppDomainStatus[],
					Record<string, string>,
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
				// down first.
				if (app?.status !== "stopped") {
					await stopAppFn({ data: { base, name: appName } });
				}
				await startAppFn({ data: { base, name: appName } });
				router.invalidate();
			}}
		/>
	);
}
