import { type ReactNode, useEffect, useRef, useState } from "react";
import { HintBar } from "@/components/ui/hint-bar";
import { relativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import type { App, AppDomainStatus, Deployment } from "@/server/relay";
import { AppEnv } from "./app-env";
import { AppSettings } from "./app-settings";
import { StatusPill } from "./status-pill";

export type AppDetailProps = {
	appName: string;
	base: string;
	connected: boolean;
	app: App | null;
	deployments: Deployment[];
	domains?: AppDomainStatus[];
	// null means this box's piperd predates the env endpoint.
	env?: Record<string, string> | null;
	fetchLogs: (id: string) => Promise<string>;
	refresh: () => void;
	onStop: () => Promise<void>;
	onStart?: () => Promise<void>;
	onDelete: () => Promise<void>;
	onSetEnv?: (key: string, value: string) => Promise<void>;
	onRemoveEnv?: (key: string) => Promise<void>;
	onRestart?: () => Promise<void>;
	onAddDomain?: (domain: string) => Promise<void>;
	onRemoveDomain?: (domain: string) => Promise<void>;
};

type TabId = "overview" | "deployments" | "env" | "settings";

const TABS: TabId[] = ["overview", "deployments", "env", "settings"];

function TabNav({
	active,
	onSelect,
}: {
	active: TabId;
	onSelect: (tab: TabId) => void;
}) {
	return (
		<div role="tablist" className="flex border-border border-b">
			{TABS.map((tab) => {
				const selected = tab === active;
				return (
					<button
						key={tab}
						type="button"
						role="tab"
						aria-selected={selected}
						onClick={() => onSelect(tab)}
						className={cn(
							"-mb-px border border-border border-l-0 px-4 py-2 font-medium text-[13px] first:border-l",
							selected
								? "border-b-background bg-card text-primary"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						{tab}
					</button>
				);
			})}
		</div>
	);
}

function StatTile({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="min-w-[230px] flex-1 rounded-[2px] border border-border bg-card p-3.5">
			<div className="text-[11px] uppercase tracking-wider text-muted-foreground">
				{label}
			</div>
			<div className="mt-2 text-[15px]">{children}</div>
		</div>
	);
}

export function AppDetail({
	appName,
	base,
	connected,
	app,
	deployments,
	domains = [],
	env = {},
	fetchLogs,
	refresh,
	onStop,
	onStart = async () => {},
	onDelete,
	onSetEnv = async () => {},
	onRemoveEnv = async () => {},
	onRestart = async () => {},
	onAddDomain = async () => {},
	onRemoveDomain = async () => {},
}: AppDetailProps) {
	const [tab, setTab] = useState<TabId>("overview");
	// Lives here, not in AppEnv, so it survives the env tab unmounting when the
	// user switches tabs — env writes never touch the running container, so
	// this is the only signal that a restart is still owed.
	const [pendingEnv, setPendingEnv] = useState<string[]>([]);

	if (!connected) {
		return (
			<main className="flex flex-col gap-6 py-8">
				<p className="text-muted-foreground">
					This box is offline — its apps can't be reached.
				</p>
			</main>
		);
	}

	if (!app) {
		return (
			<main className="flex flex-col gap-6 py-8">
				<p className="text-muted-foreground">
					App "{appName}" not found on this box.
				</p>
			</main>
		);
	}

	const lastDeploy = deployments[0];

	return (
		<main className="flex flex-col gap-6 py-8">
			<div className="flex flex-col gap-1.5">
				<div className="flex items-center gap-3">
					<h1 className="font-mono font-semibold text-xl">{app.name}</h1>
					<StatusPill status={app.status} />
				</div>
				{app.hostname ? (
					<a href={`https://${app.hostname}`} className="text-primary text-sm">
						{app.hostname}
					</a>
				) : (
					<span className="text-muted-foreground text-sm">
						Not deployed yet
					</span>
				)}
				<p className="text-muted-foreground text-sm">
					{app.repo} · {app.branch}
				</p>
			</div>

			<TabNav active={tab} onSelect={setTab} />

			{tab === "overview" && (
				<div className="flex flex-col gap-4">
					<div className="flex flex-wrap gap-3">
						<StatTile label="status">
							<span className="flex items-center gap-2">
								<StatusPill status={app.status} />
								<span className="text-muted-foreground">· port {app.port}</span>
							</span>
						</StatTile>
						<StatTile label="last deploy">
							{lastDeploy
								? `${lastDeploy.id.slice(0, 8)} · ${relativeTime(lastDeploy.createdAt)}`
								: "never deployed"}
						</StatTile>
					</div>
					<HintBar>push to {app.branch} to build and publish.</HintBar>
				</div>
			)}

			{tab === "deployments" && (
				<section className="flex flex-col gap-2">
					{deployments.length === 0 ? (
						<p className="text-muted-foreground text-sm">No deployments yet.</p>
					) : (
						<ul className="flex flex-col gap-2">
							{deployments.map((d) => (
								<DeploymentRow
									key={d.id}
									deployment={d}
									repo={app.repo}
									fetchLogs={fetchLogs}
									refresh={refresh}
								/>
							))}
						</ul>
					)}
				</section>
			)}

			{tab === "env" && (
				<AppEnv
					appName={app.name}
					status={app.status}
					env={env}
					pending={pendingEnv}
					onPendingChange={setPendingEnv}
					onSet={onSetEnv}
					onRemove={onRemoveEnv}
					onRestart={onRestart}
				/>
			)}

			{tab === "settings" && (
				<AppSettings
					app={app}
					base={base}
					domains={domains}
					onAddDomain={onAddDomain}
					onRemoveDomain={onRemoveDomain}
					onStop={onStop}
					onStart={onStart}
					onDelete={onDelete}
				/>
			)}
		</main>
	);
}

function DeploymentRow({
	deployment,
	repo,
	fetchLogs,
	refresh,
}: {
	deployment: Deployment;
	repo: string;
	fetchLogs: (id: string) => Promise<string>;
	refresh: () => void;
}) {
	const [open, setOpen] = useState(false);
	return (
		<li className="rounded-[2px] border border-border">
			{/* biome-ignore lint/a11y/useSemanticElements: a <button> can't contain
			    the interactive PR-preview <a>, so this toggle row is a
			    div[role=button] with keyboard handling. */}
			<div
				role="button"
				tabIndex={0}
				onClick={() => setOpen((o) => !o)}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						setOpen((o) => !o);
					}
				}}
				className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
			>
				<span className="flex items-center gap-3">
					<span className="font-mono text-sm">{deployment.id.slice(0, 8)}</span>
					{deployment.pr > 0 ? (
						<a
							href={`https://github.com/${repo}/pull/${deployment.pr}`}
							onClick={(e) => e.stopPropagation()}
							className="text-sm underline"
						>
							PR #{deployment.pr}
						</a>
					) : (
						<span className="text-muted-foreground text-sm">Production</span>
					)}
				</span>
				<span className="flex items-center gap-3">
					<StatusPill status={deployment.status} />
					<span className="text-muted-foreground text-xs">
						{relativeTime(deployment.createdAt)}
					</span>
				</span>
			</div>
			{open && (
				<LogPanel
					status={deployment.status}
					fetchLogs={() => fetchLogs(deployment.id)}
					refresh={refresh}
				/>
			)}
		</li>
	);
}

function LogPanel({
	status,
	fetchLogs,
	refresh,
}: {
	status: string;
	fetchLogs: () => Promise<string>;
	refresh: () => void;
}) {
	const logs = useLiveTail(status, fetchLogs, refresh);
	return (
		<pre className="max-h-96 overflow-auto border-border border-t bg-secondary px-4 py-3 font-mono text-xs">
			{logs || "No logs."}
		</pre>
	);
}

function useLiveTail(
	status: string,
	fetchLogs: () => Promise<string>,
	refresh: () => void,
	intervalMs = 2000,
): string {
	const [logs, setLogs] = useState("");
	const fetchRef = useRef(fetchLogs);
	fetchRef.current = fetchLogs;
	const refreshRef = useRef(refresh);
	refreshRef.current = refresh;
	useEffect(() => {
		let live = true;
		const load = () =>
			fetchRef.current().then((t) => {
				if (live) setLogs(t);
			});
		load();
		if (status !== "building") {
			return () => {
				live = false;
			};
		}
		const id = setInterval(() => {
			load();
			refreshRef.current();
		}, intervalMs);
		return () => {
			live = false;
			clearInterval(id);
		};
	}, [status, intervalMs]);
	return logs;
}
