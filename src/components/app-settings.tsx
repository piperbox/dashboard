import { isRedirect, Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { HintBar } from "@/components/ui/hint-bar";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Row } from "@/components/ui/row";
import { type DeviceStatus, StatusDot } from "@/components/ui/status-dot";
import { cn } from "@/lib/utils";
import type { App, AppDomainStatus } from "@/server/relay";

export type AppSettingsProps = {
	app: App;
	base: string;
	boxConnected: boolean;
	domains: AppDomainStatus[];
	onAddDomain: (domain: string) => Promise<void>;
	onRemoveDomain: (domain: string) => Promise<void>;
	onStop: () => Promise<void>;
	onStart: () => Promise<void>;
	onDelete: () => Promise<void>;
};

function domainDeviceStatus(status: string): DeviceStatus {
	switch (status) {
		case "active":
			return "ok";
		case "pending":
		case "issuing":
			return "warn";
		case "failed":
			return "danger";
		default:
			return "idle";
	}
}

function SettingRow({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<Row className="text-[13px]">
			<span className="w-[170px] flex-shrink-0">{label}</span>
			{children}
		</Row>
	);
}

function Section({
	title,
	danger = false,
	children,
}: {
	title: string;
	danger?: boolean;
	children: ReactNode;
}) {
	return (
		<section className="flex flex-col gap-2">
			<h3
				className={cn(
					"font-semibold text-sm",
					danger ? "text-destructive" : "",
				)}
			>
				{title}
			</h3>
			{children}
		</section>
	);
}

export function AppSettings({
	app,
	base,
	boxConnected,
	domains,
	onAddDomain,
	onRemoveDomain,
	onStop,
	onStart,
	onDelete,
}: AppSettingsProps) {
	return (
		<div className="flex flex-col gap-7">
			<PageHeader
				as="h2"
				kicker="app configuration"
				title="settings"
				subtitle={`Everything about how ${app.name} is built, routed and served.`}
			/>

			<Section title="Runtime">
				<Panel>
					<SettingRow label="container port">
						<span className="flex-1 text-foreground">{app.port}</span>
						<span className="text-fg-subtle text-xs">
							health-checked on deploy
						</span>
					</SettingRow>
					<SettingRow label="box">
						<Link
							to="/boxes/$base"
							params={{ base }}
							className="flex-1 text-primary no-underline hover:underline"
						>
							{base}
						</Link>
						<StatusDot status={boxConnected ? "ok" : "idle"}>
							{boxConnected ? "connected" : "offline"}
						</StatusDot>
					</SettingRow>
				</Panel>
			</Section>

			<Section title="Git">
				<Panel>
					<SettingRow label="repository">
						<span className="flex-1 text-primary">{app.repo}</span>
					</SettingRow>
					<SettingRow label="tracked branch">
						<span className="flex-1 text-foreground">{app.branch}</span>
					</SettingRow>
					<SettingRow label="preview deploys">
						<span className="flex-1 text-foreground">pull requests</span>
						<span className="text-fg-subtle text-xs">one URL per open PR</span>
					</SettingRow>
				</Panel>
				<HintBar>
					the GitHub App private key and webhook secret stay on your box.
				</HintBar>
			</Section>

			<Section title="Domains">
				<DomainsPanel
					app={app}
					domains={domains}
					onAddDomain={onAddDomain}
					onRemoveDomain={onRemoveDomain}
				/>
				<HintBar>
					point a CNAME at your box, then piper issues the cert — TLS terminates
					on the box, the relay only splices bytes.
				</HintBar>
			</Section>

			<Section title="Danger zone" danger>
				<Panel className="p-3">
					<AppActions
						name={app.name}
						status={app.status}
						onStop={onStop}
						onStart={onStart}
						onDelete={onDelete}
					/>
				</Panel>
			</Section>
		</div>
	);
}

function DomainsPanel({
	app,
	domains,
	onAddDomain,
	onRemoveDomain,
}: {
	app: App;
	domains: AppDomainStatus[];
	onAddDomain: (domain: string) => Promise<void>;
	onRemoveDomain: (domain: string) => Promise<void>;
}) {
	const [draft, setDraft] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function run(fn: () => Promise<void>, fallback: string) {
		setError(null);
		setBusy(true);
		try {
			await fn();
			return true;
		} catch (err) {
			if (isRedirect(err)) throw err;
			setError((err as Error).message || fallback);
			return false;
		} finally {
			setBusy(false);
		}
	}

	return (
		<>
			<Panel>
				<PanelHeader className="flex items-center gap-3">
					<span>domain</span>
					<span className="ml-auto">dns · certificate</span>
				</PanelHeader>
				<Row>
					<span
						className={app.hostname ? "text-primary" : "text-muted-foreground"}
					>
						{app.hostname || "not deployed"}
					</span>
					<span className="ml-auto inline-flex items-center gap-3">
						<span>relay wildcard</span>
						<StatusDot status="idle">managed</StatusDot>
					</span>
				</Row>
				{domains.map((d) => (
					<Row key={d.domain}>
						<span className="text-primary">{d.domain}</span>
						<span className="ml-auto inline-flex items-center gap-3">
							<span>{d.dnsOk ? "dns ok" : "dns pending"}</span>
							<StatusDot status={domainDeviceStatus(d.status)}>
								{d.status || "pending"}
							</StatusDot>
							<button
								type="button"
								disabled={busy}
								onClick={() =>
									run(() => onRemoveDomain(d.domain), "couldn't remove domain")
								}
								className="text-fg-subtle hover:text-status-danger disabled:opacity-50"
							>
								remove
							</button>
						</span>
					</Row>
				))}
				<Row>
					<input
						aria-label={`domain for ${app.name}`}
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						placeholder="shop.example.com"
						className={cn(inputClass, "w-[280px] px-2 py-1 text-xs")}
					/>
					<button
						type="button"
						disabled={busy || draft.trim() === ""}
						onClick={async () => {
							const domain = draft.trim();
							if (await run(() => onAddDomain(domain), "couldn't add domain")) {
								setDraft("");
							}
						}}
						className="text-primary hover:underline disabled:opacity-40"
					>
						add domain
					</button>
				</Row>
			</Panel>
			{error != null && <p className="text-destructive text-sm">{error}</p>}
		</>
	);
}

function AppActions({
	name,
	status,
	onStop,
	onStart,
	onDelete,
}: {
	name: string;
	status: string;
	onStop: () => Promise<void>;
	onStart: () => Promise<void>;
	onDelete: () => Promise<void>;
}) {
	const [stopping, setStopping] = useState(false);
	const [starting, setStarting] = useState(false);
	const [confirming, setConfirming] = useState(false);
	const [typed, setTyped] = useState("");
	const [deleting, setDeleting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleStop() {
		setError(null);
		setStopping(true);
		try {
			await onStop();
		} catch (err) {
			if (isRedirect(err)) throw err;
			setError((err as Error).message || "Couldn't stop the app.");
		} finally {
			setStopping(false);
		}
	}

	async function handleStart() {
		setError(null);
		setStarting(true);
		try {
			await onStart();
		} catch (err) {
			if (isRedirect(err)) throw err;
			setError((err as Error).message || "Couldn't start the app.");
		} finally {
			setStarting(false);
		}
	}

	async function handleDelete() {
		setError(null);
		setDeleting(true);
		try {
			await onDelete();
			// On success the parent navigates away and unmounts this component,
			// so no state reset here.
		} catch (err) {
			if (isRedirect(err)) throw err;
			setError((err as Error).message || "Couldn't delete the app.");
			setDeleting(false);
		}
	}

	return (
		<div className="mt-1 flex flex-col gap-2">
			<div className="flex flex-wrap items-center gap-2">
				{status === "stopped" ? (
					<Button
						type="button"
						onClick={handleStart}
						disabled={starting}
						bracketed={false}
					>
						{starting ? "Starting…" : "Start"}
					</Button>
				) : (
					<Button
						type="button"
						variant="neutral"
						onClick={handleStop}
						disabled={stopping}
						bracketed={false}
					>
						{stopping ? "Stopping…" : "Stop"}
					</Button>
				)}
				<Button
					type="button"
					variant="neutral"
					onClick={() => setConfirming(true)}
					bracketed={false}
				>
					Delete app
				</Button>
			</div>

			{confirming && (
				<div className="flex flex-col gap-2 rounded-[2px] border border-destructive/40 p-3">
					<p className="text-destructive text-sm">
						This permanently deletes <span className="font-mono">{name}</span>{" "}
						and its deployments. This can't be undone — type the app name to
						confirm.
					</p>
					<input
						aria-label="Confirm app name"
						value={typed}
						onChange={(e) => setTyped(e.target.value)}
						className={inputClass}
					/>
					<div className="flex gap-2">
						<Button
							type="button"
							variant="neutral"
							onClick={() => {
								setConfirming(false);
								setTyped("");
							}}
							bracketed={false}
						>
							Cancel
						</Button>
						<Button
							type="button"
							variant="destructive"
							onClick={handleDelete}
							disabled={typed !== name || deleting}
							bracketed={false}
						>
							{deleting ? "Deleting…" : "Delete"}
						</Button>
					</div>
				</div>
			)}

			{error && <p className="text-destructive text-sm">{error}</p>}
		</div>
	);
}
