import { isRedirect } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { HintBar } from "@/components/ui/hint-bar";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Row } from "@/components/ui/row";
import { StatusDot } from "@/components/ui/status-dot";
import { cn } from "@/lib/utils";

// Keys whose values are masked until the user asks to see them. A display
// default only — the API hands back every value in plaintext.
const SECRET_RE =
	/(SECRET|TOKEN|_KEY|KEY_|PASSWORD|CREDENTIAL|PRIVATE|DSN|DATABASE_URL)/i;
// Mirrors piper's envKeyRE so the UI refuses exactly what the API would 400 on.
const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export type AppEnvProps = {
	appName: string;
	status: string;
	env: Record<string, string>;
	onSet: (key: string, value: string) => Promise<void>;
	onRemove: (key: string) => Promise<void>;
	onRestart: () => Promise<void>;
};

export function keyError(key: string, existing: string[]): string | null {
	if (!KEY_RE.test(key)) {
		return `"${key}" must start with a letter or _ and contain only letters, digits and _.`;
	}
	if (key.toUpperCase() === "PORT") {
		return "PORT is reserved — piper sets it from the app's configured port.";
	}
	if (existing.includes(key)) {
		return `${key} already exists — edit the existing row instead.`;
	}
	return null;
}

export function AppEnv({
	appName,
	status,
	env,
	onSet,
	onRemove,
	onRestart,
}: AppEnvProps) {
	const [reveal, setReveal] = useState(false);
	// Writes persist on the box but never touch the running container, so track
	// what changed this session to drive the restart prompt.
	const [pending, setPending] = useState<string[]>([]);
	const [adding, setAdding] = useState(false);
	const [newKey, setNewKey] = useState("");
	const [newValue, setNewValue] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const keys = Object.keys(env).sort();
	const trimmedKey = newKey.trim();
	const addError = trimmedKey === "" ? null : keyError(trimmedKey, keys);
	const stopped = status === "stopped";

	async function write(key: string, fn: () => Promise<void>): Promise<boolean> {
		setError(null);
		setBusy(true);
		try {
			await fn();
			setPending((p) => (p.includes(key) ? p : [...p, key]));
			return true;
		} catch (err) {
			if (isRedirect(err)) throw err;
			setError((err as Error).message || `Couldn't save ${key}.`);
			return false;
		} finally {
			setBusy(false);
		}
	}

	async function apply() {
		setError(null);
		setBusy(true);
		try {
			await onRestart();
			setPending([]);
		} catch (err) {
			if (isRedirect(err)) throw err;
			setError((err as Error).message || `Couldn't restart ${appName}.`);
		} finally {
			setBusy(false);
		}
	}

	async function commitAdd() {
		if (trimmedKey === "" || addError != null) return;
		const ok = await write(trimmedKey, () => onSet(trimmedKey, newValue));
		if (!ok) return;
		setAdding(false);
		setNewKey("");
		setNewValue("");
	}

	return (
		<div className="flex flex-col gap-6">
			{pending.length > 0 && (
				<div className="flex flex-wrap items-center gap-3 rounded-[2px] border border-status-warn/40 bg-status-warn/10 p-3">
					<StatusDot status="warn" />
					<span className="text-[13px]">
						{pending.length === 1 ? "1 change" : `${pending.length} changes`}{" "}
						pending — {stopped ? "start" : "restart"} {appName} to apply{" "}
						{pending.length === 1 ? "it" : "them"}.
					</span>
					<Button
						type="button"
						size="sm"
						bracketed={false}
						className="ml-auto"
						disabled={busy}
						onClick={apply}
					>
						{stopped ? "Start app" : "Restart app"}
					</Button>
				</div>
			)}

			<div className="flex flex-wrap items-end justify-between gap-4">
				<PageHeader
					as="h2"
					kicker="app configuration"
					title="env"
					subtitle="variables injected into the container at start."
				/>
				<div className="flex gap-2">
					<Button
						type="button"
						variant="neutral"
						bracketed={false}
						onClick={() => setReveal((r) => !r)}
					>
						{reveal ? "Hide values" : "Reveal all"}
					</Button>
					<Button type="button" bracketed={false} onClick={() => setAdding(true)}>
						+ New variable
					</Button>
				</div>
			</div>

			<Panel>
				<PanelHeader className="flex items-center gap-3">
					<span className="w-[250px] flex-shrink-0">key</span>
					<span className="flex-1">value</span>
					<span className="w-[110px] flex-shrink-0" />
				</PanelHeader>

				{adding && (
					<div className="flex flex-col gap-2 border-border border-b bg-background p-3">
						<div className="flex items-center gap-3">
							<input
								aria-label="new variable key"
								value={newKey}
								onChange={(e) => setNewKey(e.target.value)}
								placeholder="DATABASE_URL"
								className={cn(
									inputClass,
									"w-[250px] flex-shrink-0 px-2 py-1.5 text-[13px]",
								)}
							/>
							<input
								aria-label="new variable value"
								value={newValue}
								onChange={(e) => setNewValue(e.target.value)}
								placeholder="value"
								className={cn(inputClass, "flex-1 px-2 py-1.5 text-[13px]")}
							/>
							<Button
								type="button"
								bracketed={false}
								disabled={busy || trimmedKey === "" || addError != null}
								onClick={commitAdd}
							>
								Save
							</Button>
							<Button
								type="button"
								variant="neutral"
								bracketed={false}
								onClick={() => {
									setAdding(false);
									setNewKey("");
									setNewValue("");
									setError(null);
								}}
							>
								Cancel
							</Button>
						</div>
						{addError != null && (
							<p className="text-destructive text-xs">{addError}</p>
						)}
					</div>
				)}

				{keys.map((key) => (
					<EnvRow key={key} name={key} value={env[key] ?? ""} reveal={reveal} />
				))}
				{keys.length === 0 && !adding && (
					<div className="px-3 py-4">
						<HintBar>
							no variables yet — add one, or run <code>piper env set</code> on
							the box.
						</HintBar>
					</div>
				)}
			</Panel>

			{error != null && <p className="text-destructive text-sm">{error}</p>}

			<HintBar>
				keys must match <code>[A-Za-z_][A-Za-z0-9_]*</code>. <code>PORT</code>{" "}
				is set by piper and can't be overridden.
			</HintBar>
		</div>
	);
}

function EnvRow({
	name,
	value,
	reveal,
}: {
	name: string;
	value: string;
	reveal: boolean;
}) {
	const secret = SECRET_RE.test(name);
	const masked = secret && !reveal;
	return (
		<Row className="text-[13px]">
			<span className="flex w-[250px] flex-shrink-0 items-center gap-2">
				<span
					data-testid="env-key"
					className="truncate font-medium text-foreground"
				>
					{name}
				</span>
				{secret && (
					<span className="flex-shrink-0 rounded-[2px] border border-border bg-secondary px-1.5 py-px text-[10px] uppercase tracking-wide text-status-idle">
						secret
					</span>
				)}
			</span>
			<span className="flex min-w-0 flex-1 items-center gap-2">
				<span
					className={cn(
						"truncate",
						masked ? "tracking-widest text-status-idle" : "",
					)}
				>
					{masked ? "•".repeat(Math.min(value.length, 26)) : value}
				</span>
			</span>
			<span className="w-[110px] flex-shrink-0" />
		</Row>
	);
}
