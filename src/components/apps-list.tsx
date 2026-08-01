import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { inputClass } from "@/components/ui/field";
import { HintBar } from "@/components/ui/hint-bar";
import { PageHeader } from "@/components/ui/page-header";
import { relativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import type { App, AppDomainStatus, BoxAppDomains } from "@/server/relay";
import { StatusBadge } from "./status-badge";

export type FlatApp = {
	base: string;
	boxConnected: boolean;
	app: App;
	domain: AppDomainStatus | null;
};

function inScope(
	box: BoxAppDomains["box"],
	scope: string,
	username: string | null,
) {
	return scope === "personal" ? box.owner === username : box.owner === scope;
}

export function flattenApps(
	items: BoxAppDomains[],
	scope: string,
	username: string | null,
): FlatApp[] {
	return items
		.filter(({ box }) => inScope(box, scope, username))
		.flatMap(({ box, domains }) =>
			box.apps.map((app) => ({
				base: box.base,
				boxConnected: box.connected,
				app,
				domain: domains[app.name]?.[0] ?? null,
			})),
		);
}

function MetaRow({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex items-center gap-2">
			<span className="w-16 flex-shrink-0 text-muted-foreground">{label}</span>
			{children}
		</div>
	);
}

function AppCard({ base, boxConnected, app, domain }: FlatApp) {
	return (
		<div className="relative flex flex-col gap-3 rounded-[2px] border border-border bg-card p-4 hover:bg-secondary/40">
			<div className="flex items-start justify-between gap-2.5">
				<Link
					to="/boxes/$base/apps/$app"
					params={{ base, app: app.name }}
					className="truncate font-semibold text-[15px] text-foreground no-underline after:absolute after:inset-0"
				>
					{app.name}
				</Link>
				<StatusBadge status={app.status} />
			</div>
			{app.hostname ? (
				<a
					href={`https://${app.hostname}`}
					className="relative truncate text-primary text-xs no-underline hover:underline"
				>
					{app.hostname}
				</a>
			) : (
				<span className="truncate text-muted-foreground text-xs">
					not deployed
				</span>
			)}
			<div className="flex flex-col gap-1.5 border-border border-t pt-3 text-xs">
				<MetaRow label="box">
					<span
						className={`h-1.5 w-1.5 flex-shrink-0 rounded-[2px] ${
							boxConnected ? "bg-status-ok" : "bg-status-idle"
						}`}
					/>
					<span className="truncate text-foreground">{base}</span>
				</MetaRow>
				<MetaRow label="repo">
					<span className="truncate text-foreground">
						{app.repo}@{app.branch}
					</span>
				</MetaRow>
				{domain != null && (
					<MetaRow label="domain">
						<span className="truncate text-primary">{domain.domain}</span>
					</MetaRow>
				)}
				<MetaRow label="deployed">
					<span className="text-foreground">{relativeTime(app.createdAt)}</span>
				</MetaRow>
			</div>
		</div>
	);
}

export function AppsList({
	items,
	scope,
	username,
}: {
	items: BoxAppDomains[];
	scope: string;
	username: string | null;
}) {
	const [filter, setFilter] = useState("");
	const apps = flattenApps(items, scope, username);
	const boxes = items.filter(({ box }) => inScope(box, scope, username)).length;
	const q = filter.trim().toLowerCase();
	const shown =
		q === ""
			? apps
			: apps.filter((f) =>
					`${f.app.name} ${f.base} ${f.app.repo}`.toLowerCase().includes(q),
				);
	return (
		<main className="flex flex-col gap-5 py-8">
			<PageHeader kicker="your software" title="apps" />
			<div className="flex items-center gap-3 rounded-[2px] border border-border bg-card px-3 py-2">
				<span className="text-muted-foreground text-xs">
					{scope} · {apps.length} apps · {boxes} boxes
				</span>
				<span className="ml-auto flex items-center gap-2.5">
					<input
						aria-label="filter apps"
						value={filter}
						onChange={(e) => setFilter(e.target.value)}
						placeholder="filter"
						className={cn(inputClass, "w-[150px] px-2 py-1 text-xs")}
					/>
					<Link
						to="/apps/new"
						className="rounded-[2px] bg-primary px-3 py-1.5 font-medium text-primary-foreground text-[13px] no-underline hover:bg-primary/90"
					>
						+ new app
					</Link>
				</span>
			</div>
			{shown.length === 0 ? (
				<div className="flex flex-col gap-2 rounded-[2px] border border-border bg-card px-4 py-5">
					{apps.length === 0 ? (
						<>
							<p className="text-[13px]">No apps in this scope.</p>
							<HintBar>
								link a repo above, or run <code>piper deploy</code> from a box.
							</HintBar>
						</>
					) : (
						<p className="text-[13px]">
							No apps match <code>{filter.trim()}</code>.
						</p>
					)}
				</div>
			) : (
				<div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3.5">
					{shown.map((f) => (
						<AppCard key={`${f.base}/${f.app.name}`} {...f} />
					))}
				</div>
			)}
		</main>
	);
}
