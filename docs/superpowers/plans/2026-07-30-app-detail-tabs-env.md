# App detail tabs + env vars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Manage an app's environment variables from the dashboard — read, add, edit, remove, reveal, and apply by restarting — with the app-detail page restructured into `overview | deployments | env | settings` tabs.

**Architecture:** Three new transport functions in `src/server/relay.ts` over piper's `/v1/apps/{name}/env` endpoints, three TanStack server functions in `src/server/fns.ts` that attach the session cookie, and two new presentational components (`app-env.tsx`, `app-settings.tsx`) that take data plus async callbacks and import no server code. `app-detail.tsx` becomes a tab shell around them.

**Tech Stack:** Bun, TanStack Start (file router + server functions), React, Tailwind v4 with the terminal token set, Biome, `bun test` + Testing Library (happy-dom preloaded via `bunfig.toml`).

**Spec:** [`docs/superpowers/specs/2026-07-30-app-detail-tabs-env-design.md`](../specs/2026-07-30-app-detail-tabs-env-design.md)

## Global Constraints

- **Bun only** — never `npm`/`yarn`/`node`. Tests: `bun test`. Full gate: `bun run verify` (Biome → `tsc --noEmit` → tests → build). Auto-fix formatting with `bun run format`.
- **Test-first.** Every task writes a failing test, watches it fail, then implements. Do not write implementation before a red test.
- **Tests never live in `src/routes/`** — the file router scans that directory. Component tests sit next to the component in `src/components/`.
- **No raw hex colors.** Use the token classes (`text-primary`, `bg-card`, `border-border`, `text-muted-foreground`, `text-status-idle`, `bg-status-warn/10`, …). The design file's inline hex values map 1:1 onto these tokens.
- **Amber (`primary`) is interactive only** — never used to denote device/app status. Status uses `status-ok`/`status-warn`/`status-danger`/`status-idle`.
- **Radius is `rounded-[2px]`** everywhere, matching the existing components.
- Commit messages are conventional and end with:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- Work happens on branch `ozykhan/app-detail-tabs-env` (already created; the spec commit is its first commit).
- Tasks 1–4 are **PR 1**. Tasks 5–6 are **PR 2**. Run `bun run verify` before opening each PR.

## File Structure

| File | Responsibility |
| --- | --- |
| `src/server/relay.ts` (modify) | Add `fetchAppEnv` / `setAppEnv` / `removeAppEnv` beside the existing app-domains trio |
| `src/server/relay-app-env.test.ts` (create) | Wire-shape and error-mapping tests for the three transport functions |
| `src/server/fns.ts` (modify) | Add `getAppEnv` / `setAppEnvFn` / `removeAppEnvFn` server functions |
| `src/components/ui/page-header.tsx` (modify) | Optional `as` prop so in-page sections can render an `h2` instead of a second `h1` |
| `src/components/app-env.tsx` (create) | The env tab: table, masking, add/edit/remove, pending-restart banner |
| `src/components/app-env.test.tsx` (create) | Tests for all of the above |
| `src/components/app-settings.tsx` (create) | The settings tab: runtime + git (read-only), domains, danger zone |
| `src/components/app-settings.test.tsx` (create) | Tests for the above |
| `src/components/app-detail.tsx` (modify) | Tab shell + overview tab; sheds the header action row, the domain lines, and `AppActions` (which moves to `app-settings.tsx`) |
| `src/components/app-detail.test.tsx` (modify) | Existing assertions migrate behind their tabs |
| `src/routes/boxes/$base_.apps.$app.tsx` (modify) | Loads `env`, wires the env/domain/restart callbacks |

---

### Task 1: Env transport in `relay.ts`

**Files:**
- Modify: `src/server/relay.ts` (append after `removeAppDomain`, which ends at line 604)
- Test: `src/server/relay-app-env.test.ts` (create)

**Interfaces:**
- Consumes: `relayUrl()`, `RelayAuthError`, `BoxOfflineError` — all already exported from `src/server/relay.ts`.
- Produces:
  - `fetchAppEnv(credential: string, base: string, app: string): Promise<Record<string, string>>`
  - `setAppEnv(credential: string, base: string, app: string, key: string, value: string): Promise<void>`
  - `removeAppEnv(credential: string, base: string, app: string, key: string): Promise<void>`

- [ ] **Step 1: Write the failing test**

Create `src/server/relay-app-env.test.ts`:

```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import {
	BoxOfflineError,
	fetchAppEnv,
	RelayAuthError,
	removeAppEnv,
	setAppEnv,
} from "./relay";

const originalFetch = globalThis.fetch;
const originalEnv = process.env.PIPER_RELAY_URL;

beforeEach(() => {
	process.env.PIPER_RELAY_URL = "https://relay.test";
});

afterEach(() => {
	globalThis.fetch = originalFetch;
	if (originalEnv === undefined) {
		delete process.env.PIPER_RELAY_URL;
	} else {
		process.env.PIPER_RELAY_URL = originalEnv;
	}
});

test("fetchAppEnv unwraps the {env} envelope", async () => {
	let seenUrl = "";
	let seenAuth: string | null = null;
	globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
		seenUrl = String(url);
		seenAuth = new Headers(init?.headers).get("Authorization");
		return Response.json({ env: { NODE_ENV: "production", PORT_HINT: "8080" } });
	}) as typeof fetch;

	const env = await fetchAppEnv("cred-1", "abc-zoe", "api");
	expect(seenUrl).toBe("https://relay.test/agents/abc-zoe/v1/apps/api/env");
	expect<string | null>(seenAuth).toBe("Bearer cred-1");
	expect(env).toEqual({ NODE_ENV: "production", PORT_HINT: "8080" });
});

test("fetchAppEnv returns an empty record when the box omits env", async () => {
	globalThis.fetch = (async () => Response.json({})) as typeof fetch;
	expect(await fetchAppEnv("cred", "b", "a")).toEqual({});
});

test("fetchAppEnv maps 401 to RelayAuthError and 502 to BoxOfflineError", async () => {
	globalThis.fetch = (async () =>
		new Response("", { status: 401 })) as unknown as typeof fetch;
	expect(fetchAppEnv("cred", "b", "a")).rejects.toBeInstanceOf(RelayAuthError);

	globalThis.fetch = (async () =>
		new Response("", { status: 502 })) as unknown as typeof fetch;
	expect(fetchAppEnv("cred", "b", "a")).rejects.toBeInstanceOf(BoxOfflineError);
});

test("setAppEnv POSTs {key, value} and accepts 204", async () => {
	let seenUrl = "";
	let seenMethod = "";
	let seenBody = "";
	globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
		seenUrl = String(url);
		seenMethod = init?.method ?? "";
		seenBody = String(init?.body);
		return new Response(null, { status: 204 });
	}) as typeof fetch;

	await setAppEnv("cred-1", "abc-zoe", "api", "DATABASE_URL", "postgres://x");
	expect(seenUrl).toBe("https://relay.test/agents/abc-zoe/v1/apps/api/env");
	expect(seenMethod).toBe("POST");
	expect(JSON.parse(seenBody)).toEqual({
		key: "DATABASE_URL",
		value: "postgres://x",
	});
});

test("setAppEnv surfaces the box's 400 message", async () => {
	globalThis.fetch = (async () =>
		new Response("PORT is reserved", {
			status: 400,
		})) as unknown as typeof fetch;
	expect(setAppEnv("cred", "b", "a", "PORT", "9")).rejects.toThrow(
		"PORT is reserved",
	);
});

test("removeAppEnv DELETEs the encoded key and accepts 204", async () => {
	let seenUrl = "";
	let seenMethod = "";
	globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
		seenUrl = String(url);
		seenMethod = init?.method ?? "";
		return new Response(null, { status: 204 });
	}) as typeof fetch;

	await removeAppEnv("cred-1", "abc-zoe", "api", "DATABASE_URL");
	expect(seenUrl).toBe(
		"https://relay.test/agents/abc-zoe/v1/apps/api/env/DATABASE_URL",
	);
	expect(seenMethod).toBe("DELETE");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/server/relay-app-env.test.ts`
Expected: FAIL — `fetchAppEnv`, `setAppEnv`, `removeAppEnv` are not exported from `./relay`.

- [ ] **Step 3: Write the implementation**

Append to `src/server/relay.ts`, immediately after `removeAppDomain` and before `export type BoxAppDomains`:

```ts
// Per-app environment variables (piper #441). Values come back in full
// plaintext — the endpoint is admin-bearer-authed and single-tenant, so any
// masking is a display choice, not a boundary. Writes never touch the running
// container: they apply on the app's next deploy or restart.
export async function fetchAppEnv(
	credential: string,
	base: string,
	app: string,
): Promise<Record<string, string>> {
	const res = await fetch(
		`${relayUrl()}/agents/${encodeURIComponent(base)}/v1/apps/${encodeURIComponent(
			app,
		)}/env`,
		{ headers: { Authorization: `Bearer ${credential}` } },
	);
	if (res.status === 401) {
		throw new RelayAuthError("relay rejected the session credential");
	}
	if (res.status === 502 || res.status === 503) {
		throw new BoxOfflineError(`box ${base} is offline`);
	}
	if (!res.ok) {
		const msg = (await res.text()).trim();
		throw new Error(msg || `relay list app env returned ${res.status}`);
	}
	const body = (await res.json()) as { env?: Record<string, string> };
	return body.env ?? {};
}

export async function setAppEnv(
	credential: string,
	base: string,
	app: string,
	key: string,
	value: string,
): Promise<void> {
	const res = await fetch(
		`${relayUrl()}/agents/${encodeURIComponent(base)}/v1/apps/${encodeURIComponent(
			app,
		)}/env`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${credential}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ key, value }),
		},
	);
	if (res.status === 401) {
		throw new RelayAuthError("relay rejected the session credential");
	}
	if (res.status === 502 || res.status === 503) {
		throw new BoxOfflineError(`box ${base} is offline`);
	}
	if (res.status !== 204) {
		const msg = (await res.text()).trim();
		throw new Error(msg || `relay set app env returned ${res.status}`);
	}
}

export async function removeAppEnv(
	credential: string,
	base: string,
	app: string,
	key: string,
): Promise<void> {
	const res = await fetch(
		`${relayUrl()}/agents/${encodeURIComponent(base)}/v1/apps/${encodeURIComponent(
			app,
		)}/env/${encodeURIComponent(key)}`,
		{ method: "DELETE", headers: { Authorization: `Bearer ${credential}` } },
	);
	if (res.status === 401) {
		throw new RelayAuthError("relay rejected the session credential");
	}
	if (res.status === 502 || res.status === 503) {
		throw new BoxOfflineError(`box ${base} is offline`);
	}
	if (res.status !== 204) {
		const msg = (await res.text()).trim();
		throw new Error(msg || `relay remove app env returned ${res.status}`);
	}
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test src/server/relay-app-env.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/server/relay.ts src/server/relay-app-env.test.ts
git commit -m "feat: app env transport over the relay control proxy

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: The env tab component

**Files:**
- Modify: `src/components/ui/page-header.tsx`
- Test: `src/components/ui/page-header.test.tsx`
- Create: `src/components/app-env.tsx`
- Test: `src/components/app-env.test.tsx`

**Interfaces:**
- Consumes: `Button` (`@/components/ui/button`), `inputClass` (`@/components/ui/field`), `HintBar`, `Panel`/`PanelHeader`, `Row`, `StatusDot`, `PageHeader`, `cn` (`@/lib/utils`).
- Produces:
  - `PageHeader` gains `as?: "h1" | "h2"` (default `"h1"`).
  - `AppEnv(props: AppEnvProps)` where
    ```ts
    export type AppEnvProps = {
      appName: string;
      status: string;
      env: Record<string, string>;
      onSet: (key: string, value: string) => Promise<void>;
      onRemove: (key: string) => Promise<void>;
      onRestart: () => Promise<void>;
    };
    ```
  - `keyError(key: string, existing: string[]): string | null`

- [ ] **Step 1: Write the failing `PageHeader` test**

Append to `src/components/ui/page-header.test.tsx`:

```tsx
test("renders an h2 when as='h2' so in-page sections don't add a second h1", () => {
	render(<PageHeader title="env" as="h2" />);
	expect(screen.getByRole("heading", { level: 2 }).textContent).toContain("env");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun test src/components/ui/page-header.test.tsx`
Expected: FAIL — TS rejects the unknown `as` prop / no level-2 heading found.

- [ ] **Step 3: Implement the `as` prop**

In `src/components/ui/page-header.tsx`, add `as` to the props and use it for the heading element:

```tsx
export function PageHeader({
	kicker,
	title,
	subtitle,
	className,
	as: Heading = "h1",
}: {
	kicker?: ReactNode;
	title: string;
	subtitle?: ReactNode;
	className?: string;
	as?: "h1" | "h2";
}) {
	return (
		<div className={cn("flex flex-col gap-1", className)}>
			{kicker != null && (
				<div className="text-[11px] uppercase tracking-widest text-primary">
					{kicker}
				</div>
			)}
			<Heading className="font-semibold text-xl">
				<span className="text-muted-foreground">{"# "}</span>
				{title}
			</Heading>
			{subtitle != null && (
				<p className="text-muted-foreground text-sm">{subtitle}</p>
			)}
		</div>
	);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `bun test src/components/ui/page-header.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/page-header.tsx src/components/ui/page-header.test.tsx
git commit -m "feat: PageHeader renders h2 on request

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Write the failing render/masking tests**

Create `src/components/app-env.test.tsx`:

```tsx
import { expect, mock, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { AppEnv } from "./app-env";

const env = {
	NODE_ENV: "production",
	DATABASE_URL: "postgres://piper:hunter2@127.0.0.1:5432/blog",
};

const noopSet = async (_k: string, _v: string) => {};
const noopRemove = async (_k: string) => {};
const noopRestart = async () => {};

function renderEnv(over: Partial<Parameters<typeof AppEnv>[0]> = {}) {
	return render(
		<AppEnv
			appName="web"
			status="running"
			env={env}
			onSet={noopSet}
			onRemove={noopRemove}
			onRestart={noopRestart}
			{...over}
		/>,
	);
}

test("lists keys alphabetically", () => {
	renderEnv();
	const keys = screen
		.getAllByTestId("env-key")
		.map((el) => el.textContent?.trim());
	expect(keys).toEqual(["DATABASE_URL", "NODE_ENV"]);
});

test("masks secret-looking values and reveals them on toggle", () => {
	renderEnv();
	// NODE_ENV is not secret-shaped, so its value is always legible.
	expect(screen.getByText("production")).toBeTruthy();
	expect(screen.queryByText(env.DATABASE_URL)).toBeNull();
	expect(screen.getByText(/secret/i)).toBeTruthy();

	fireEvent.click(screen.getByRole("button", { name: /reveal all/i }));
	expect(screen.getByText(env.DATABASE_URL)).toBeTruthy();

	fireEvent.click(screen.getByRole("button", { name: /hide values/i }));
	expect(screen.queryByText(env.DATABASE_URL)).toBeNull();
});

test("shows a hint instead of a table when the app has no variables", () => {
	renderEnv({ env: {} });
	expect(screen.getByText(/no variables yet/i)).toBeTruthy();
	expect(screen.getByText("piper env set")).toBeTruthy();
});
```

- [ ] **Step 7: Run them to verify they fail**

Run: `bun test src/components/app-env.test.tsx`
Expected: FAIL — cannot resolve `./app-env`.

- [ ] **Step 8: Implement the component skeleton (header + table + masking)**

Create `src/components/app-env.tsx`:

```tsx
import { isRedirect } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { HintBar } from "@/components/ui/hint-bar";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Row } from "@/components/ui/row";
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

// Only `env` is destructured in this cycle — `tsconfig.json` sets
// noUnusedLocals, so pulling out props this cycle doesn't use would fail tsc.
// Step 12 replaces this signature with the full one.
export function AppEnv({ env }: AppEnvProps) {
	const [reveal, setReveal] = useState(false);
	const keys = Object.keys(env).sort();

	return (
		<div className="flex flex-col gap-6">
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
				</div>
			</div>

			<Panel>
				<PanelHeader className="flex items-center gap-3">
					<span className="w-[250px] flex-shrink-0">key</span>
					<span className="flex-1">value</span>
					<span className="w-[110px] flex-shrink-0" />
				</PanelHeader>
				{keys.map((key) => (
					<EnvRow key={key} name={key} value={env[key] ?? ""} reveal={reveal} />
				))}
				{keys.length === 0 && (
					<div className="px-3 py-4">
						<HintBar>
							no variables yet — add one, or run <code>piper env set</code> on
							the box.
						</HintBar>
					</div>
				)}
			</Panel>

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
```

This cycle renders a read-only table. `appName`, `status`, `onSet`, `onRemove`, and `onRestart` stay in `AppEnvProps` (the tests already pass them) and get consumed in Steps 12 and 17.

- [ ] **Step 9: Run the tests to verify they pass**

Run: `bun test src/components/app-env.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 10: Write the failing add-variable tests**

Append to `src/components/app-env.test.tsx`:

```tsx
function startAdd() {
	fireEvent.click(screen.getByRole("button", { name: /new variable/i }));
}

test("rejects a malformed key, PORT, and a duplicate before any request", () => {
	const onSet = mock(async (_k: string, _v: string) => {});
	renderEnv({ onSet });
	startAdd();
	const keyInput = screen.getByLabelText(/new variable key/i);

	fireEvent.change(keyInput, { target: { value: "2FAST" } });
	expect(screen.getByText(/must start with a letter or _/i)).toBeTruthy();
	expect(
		(screen.getByRole("button", { name: /^save$/i }) as HTMLButtonElement)
			.disabled,
	).toBe(true);

	fireEvent.change(keyInput, { target: { value: "port" } });
	expect(screen.getByText(/PORT is reserved/i)).toBeTruthy();

	fireEvent.change(keyInput, { target: { value: "NODE_ENV" } });
	expect(screen.getByText(/already exists/i)).toBeTruthy();

	expect(onSet).not.toHaveBeenCalled();
});

test("a valid add calls onSet and prompts for a restart", async () => {
	const onSet = mock(async (_k: string, _v: string) => {});
	renderEnv({ onSet });
	startAdd();
	fireEvent.change(screen.getByLabelText(/new variable key/i), {
		target: { value: "SENTRY_DSN" },
	});
	fireEvent.change(screen.getByLabelText(/new variable value/i), {
		target: { value: "https://a91f@o4507.ingest.sentry.io/45" },
	});
	await act(async () => {
		fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
	});
	expect(onSet).toHaveBeenCalledWith(
		"SENTRY_DSN",
		"https://a91f@o4507.ingest.sentry.io/45",
	);
	expect(screen.getByText(/1 change pending/i)).toBeTruthy();
	expect(screen.getByText(/restart web to apply/i)).toBeTruthy();
});

test("a rejected add keeps the form open and shows the error", async () => {
	const onSet = async () => {
		throw new Error("box is offline");
	};
	renderEnv({ onSet });
	startAdd();
	fireEvent.change(screen.getByLabelText(/new variable key/i), {
		target: { value: "GREETING" },
	});
	await act(async () => {
		fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
	});
	expect(screen.getByText(/box is offline/i)).toBeTruthy();
	expect(screen.getByLabelText(/new variable key/i)).toBeTruthy();
	expect(screen.queryByText(/pending/i)).toBeNull();
});

test("Cancel closes the add form without calling onSet", () => {
	const onSet = mock(async (_k: string, _v: string) => {});
	renderEnv({ onSet });
	startAdd();
	fireEvent.change(screen.getByLabelText(/new variable key/i), {
		target: { value: "GREETING" },
	});
	fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
	expect(screen.queryByLabelText(/new variable key/i)).toBeNull();
	expect(onSet).not.toHaveBeenCalled();
});
```

- [ ] **Step 11: Run them to verify they fail**

Run: `bun test src/components/app-env.test.tsx`
Expected: FAIL — there is no "New variable" button yet.

- [ ] **Step 12: Implement the add form and the pending banner**

In `src/components/app-env.tsx`, add the state, the write helper, the banner, the `+ New variable` button, and the add row. Replace the `AppEnv` body with:

```tsx
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
```

Add `StatusDot` to the imports:

```tsx
import { StatusDot } from "@/components/ui/status-dot";
```

- [ ] **Step 13: Run the tests to verify they pass**

Run: `bun test src/components/app-env.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 14: Commit**

```bash
git add src/components/app-env.tsx src/components/app-env.test.tsx
git commit -m "feat: env tab table, masking and add form

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 15: Write the failing edit/remove/restart tests**

Append to `src/components/app-env.test.tsx`:

```tsx
test("edit saves the new value through onSet", async () => {
	const onSet = mock(async (_k: string, _v: string) => {});
	renderEnv({ onSet });
	fireEvent.click(screen.getAllByRole("button", { name: /^edit$/i })[1]);
	fireEvent.change(screen.getByLabelText(/value for NODE_ENV/i), {
		target: { value: "staging" },
	});
	await act(async () => {
		fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
	});
	expect(onSet).toHaveBeenCalledWith("NODE_ENV", "staging");
});

test("edit shows the real value even for a masked variable", () => {
	renderEnv();
	fireEvent.click(screen.getAllByRole("button", { name: /^edit$/i })[0]);
	const input = screen.getByLabelText(
		/value for DATABASE_URL/i,
	) as HTMLInputElement;
	expect(input.value).toBe(env.DATABASE_URL);
});

test("remove calls onRemove and prompts for a restart", async () => {
	const onRemove = mock(async (_k: string) => {});
	renderEnv({ onRemove });
	await act(async () => {
		fireEvent.click(screen.getAllByRole("button", { name: /^remove$/i })[1]);
	});
	expect(onRemove).toHaveBeenCalledWith("NODE_ENV");
	expect(screen.getByText(/1 change pending/i)).toBeTruthy();
});

test("a successful restart clears the pending banner", async () => {
	const onRestart = mock(async () => {});
	renderEnv({ onRestart });
	await act(async () => {
		fireEvent.click(screen.getAllByRole("button", { name: /^remove$/i })[1]);
	});
	await act(async () => {
		fireEvent.click(screen.getByRole("button", { name: /restart app/i }));
	});
	expect(onRestart).toHaveBeenCalledTimes(1);
	expect(screen.queryByText(/pending/i)).toBeNull();
});

test("a failed restart keeps the banner and shows the error", async () => {
	const onRestart = async () => {
		throw new Error("box is offline");
	};
	renderEnv({ onRestart });
	await act(async () => {
		fireEvent.click(screen.getAllByRole("button", { name: /^remove$/i })[1]);
	});
	await act(async () => {
		fireEvent.click(screen.getByRole("button", { name: /restart app/i }));
	});
	expect(screen.getByText(/box is offline/i)).toBeTruthy();
	expect(screen.getByText(/1 change pending/i)).toBeTruthy();
});

test("a stopped app is asked to start, not restart", async () => {
	renderEnv({ status: "stopped" });
	await act(async () => {
		fireEvent.click(screen.getAllByRole("button", { name: /^remove$/i })[1]);
	});
	expect(screen.getByText(/start web to apply/i)).toBeTruthy();
	expect(screen.getByRole("button", { name: /start app/i })).toBeTruthy();
	expect(screen.queryByRole("button", { name: /restart app/i })).toBeNull();
});
```

- [ ] **Step 16: Run them to verify they fail**

Run: `bun test src/components/app-env.test.tsx`
Expected: FAIL — rows have no `edit`/`remove` buttons.

- [ ] **Step 17: Implement per-row edit and remove**

Move the row into the parent so it can reach the write helper. Replace the standalone `EnvRow` function and its call site: pass the extra props from `AppEnv`:

```tsx
				{keys.map((key) => (
					<EnvRow
						key={key}
						name={key}
						value={env[key] ?? ""}
						reveal={reveal}
						pending={pending.includes(key)}
						busy={busy}
						onSave={(next) => write(key, () => onSet(key, next))}
						onRemove={() => write(key, () => onRemove(key))}
					/>
				))}
```

and rewrite `EnvRow`:

```tsx
function EnvRow({
	name,
	value,
	reveal,
	pending,
	busy,
	onSave,
	onRemove,
}: {
	name: string;
	value: string;
	reveal: boolean;
	pending: boolean;
	busy: boolean;
	onSave: (next: string) => Promise<boolean>;
	onRemove: () => Promise<boolean>;
}) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(value);
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
			{editing ? (
				<span className="flex flex-1 items-center gap-2">
					<input
						aria-label={`value for ${name}`}
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						className={cn(
							inputClass,
							"flex-1 border-primary px-2 py-1 text-[13px]",
						)}
					/>
					<Button
						type="button"
						size="sm"
						bracketed={false}
						disabled={busy}
						onClick={async () => {
							if (await onSave(draft)) setEditing(false);
						}}
					>
						save
					</Button>
					<Button
						type="button"
						size="sm"
						variant="neutral"
						bracketed={false}
						onClick={() => {
							setEditing(false);
							setDraft(value);
						}}
					>
						cancel
					</Button>
				</span>
			) : (
				<>
					<span className="flex min-w-0 flex-1 items-center gap-2">
						<span
							className={cn(
								"truncate",
								masked ? "tracking-widest text-status-idle" : "",
							)}
						>
							{masked ? "•".repeat(Math.min(value.length, 26)) : value}
						</span>
						{pending && (
							<span className="flex-shrink-0 rounded-[2px] border border-status-warn/30 bg-status-warn/10 px-1.5 py-px text-[10px] uppercase tracking-wide text-status-warn">
								pending
							</span>
						)}
					</span>
					<span className="flex w-[110px] flex-shrink-0 justify-end gap-2.5">
						<button
							type="button"
							onClick={() => {
								setDraft(value);
								setEditing(true);
							}}
							className="text-status-idle text-xs hover:text-primary"
						>
							edit
						</button>
						<button
							type="button"
							disabled={busy}
							onClick={onRemove}
							className="text-status-idle text-xs hover:text-status-danger disabled:opacity-50"
						>
							remove
						</button>
					</span>
				</>
			)}
		</Row>
	);
}
```

- [ ] **Step 18: Run the tests to verify they pass**

Run: `bun test src/components/app-env.test.tsx`
Expected: PASS, 13 tests.

- [ ] **Step 19: Commit**

```bash
git add src/components/app-env.tsx src/components/app-env.test.tsx
git commit -m "feat: inline edit, remove and restart-to-apply in the env tab

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Wire env end to end

**Files:**
- Modify: `src/server/fns.ts` (add after `removeAppDomainFn`, which ends at line 272)
- Modify: `src/components/app-detail.tsx`
- Modify: `src/components/app-detail.test.tsx`
- Modify: `src/routes/boxes/$base_.apps.$app.tsx`

**Interfaces:**
- Consumes: `fetchAppEnv` / `setAppEnv` / `removeAppEnv` (Task 1), `AppEnv` and `AppEnvProps` (Task 2), the existing `stopAppFn` / `startAppFn`.
- Produces:
  - `getAppEnv({ data: { base, app } })` → `Promise<Record<string, string>>`
  - `setAppEnvFn({ data: { base, app, key, value } })` → `Promise<void>`
  - `removeAppEnvFn({ data: { base, app, key } })` → `Promise<void>`
  - `AppDetailProps` gains four optional fields, all defaulted so existing call sites keep compiling:
    ```ts
    env?: Record<string, string>;          // default {}
    onSetEnv?: (key: string, value: string) => Promise<void>;
    onRemoveEnv?: (key: string) => Promise<void>;
    onRestart?: () => Promise<void>;
    ```

- [ ] **Step 1: Write the failing test**

Append to `src/components/app-detail.test.tsx`:

```tsx
test("renders the app's env variables", () => {
	render(
		<AppDetail
			appName="web"
			connected={true}
			app={app}
			deployments={[]}
			env={{ NODE_ENV: "production" }}
			fetchLogs={emptyLogs}
			refresh={noop}
			onStop={noopAsync}
			onDelete={noopAsync}
		/>,
	);
	expect(screen.getByText("NODE_ENV")).toBeTruthy();
	expect(screen.getByText("production")).toBeTruthy();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun test src/components/app-detail.test.tsx`
Expected: FAIL — `env` is not a prop of `AppDetail`; `NODE_ENV` is not rendered.

- [ ] **Step 3: Add the server functions**

Append to `src/server/fns.ts` after `removeAppDomainFn`:

```ts
export const getAppEnv = createServerFn()
	.validator((d: { base: string; app: string }) => d)
	.handler(async ({ data }) => {
		const credential = getCookie("piper_session");
		if (!credential) throw redirect({ to: "/login" });
		try {
			return await fetchAppEnv(credential, data.base, data.app);
		} catch (err) {
			if (err instanceof RelayAuthError) dropSessionAndRedirect();
			throw err;
		}
	});

export const setAppEnvFn = createServerFn({ method: "POST" })
	.validator((d: { base: string; app: string; key: string; value: string }) => d)
	.handler(async ({ data }) => {
		const credential = getCookie("piper_session");
		if (!credential) throw redirect({ to: "/login" });
		try {
			await setAppEnv(credential, data.base, data.app, data.key, data.value);
		} catch (err) {
			if (err instanceof RelayAuthError) dropSessionAndRedirect();
			throw err;
		}
	});

export const removeAppEnvFn = createServerFn({ method: "POST" })
	.validator((d: { base: string; app: string; key: string }) => d)
	.handler(async ({ data }) => {
		const credential = getCookie("piper_session");
		if (!credential) throw redirect({ to: "/login" });
		try {
			await removeAppEnv(credential, data.base, data.app, data.key);
		} catch (err) {
			if (err instanceof RelayAuthError) dropSessionAndRedirect();
			throw err;
		}
	});
```

Add `fetchAppEnv`, `setAppEnv`, and `removeAppEnv` to the existing `from "./relay"` import block at the top of the file, keeping it alphabetically sorted (Biome enforces the order).

- [ ] **Step 4: Render `AppEnv` from `AppDetail`**

In `src/components/app-detail.tsx`, extend the props type:

```tsx
export type AppDetailProps = {
	appName: string;
	connected: boolean;
	app: App | null;
	deployments: Deployment[];
	domains?: AppDomainStatus[];
	env?: Record<string, string>;
	fetchLogs: (id: string) => Promise<string>;
	refresh: () => void;
	onStop: () => Promise<void>;
	onStart?: () => Promise<void>;
	onDelete: () => Promise<void>;
	onSetEnv?: (key: string, value: string) => Promise<void>;
	onRemoveEnv?: (key: string) => Promise<void>;
	onRestart?: () => Promise<void>;
};
```

Destructure the new props with defaults alongside `onStart`:

```tsx
	env = {},
	onSetEnv = async () => {},
	onRemoveEnv = async () => {},
	onRestart = async () => {},
```

Import the component:

```tsx
import { AppEnv } from "./app-env";
```

and render it after the Deployments `<section>`, still inside the `<main>`:

```tsx
			<AppEnv
				appName={app.name}
				status={app.status}
				env={env}
				onSet={onSetEnv}
				onRemove={onRemoveEnv}
				onRestart={onRestart}
			/>
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun test src/components/app-detail.test.tsx`
Expected: PASS.

- [ ] **Step 6: Load env in the route and wire the callbacks**

Rewrite `src/routes/boxes/$base_.apps.$app.tsx`:

```tsx
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
```

- [ ] **Step 7: Run the full gate**

Run: `bun run verify`
Expected: Biome clean, `tsc --noEmit` clean, all tests pass, build succeeds. Run `bun run format` first if Biome reports formatting.

- [ ] **Step 8: Commit**

```bash
git add src/server/fns.ts src/components/app-detail.tsx src/components/app-detail.test.tsx "src/routes/boxes/\$base_.apps.\$app.tsx"
git commit -m "feat: manage app env vars from the dashboard

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Tab shell + overview tab

**Files:**
- Modify: `src/components/app-detail.tsx`
- Modify: `src/components/app-detail.test.tsx`

**Interfaces:**
- Consumes: everything from Task 3.
- Produces: `AppDetail` renders a `role="tablist"` with tabs `overview`, `deployments`, `env`; `overview` is the default. The settings tab arrives in Task 6.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/app-detail.test.tsx`:

```tsx
test("opens on the overview tab with the app's port and last deploy", () => {
	render(
		<AppDetail
			appName="web"
			connected={true}
			app={app}
			deployments={[dep({ id: "dep-prod0001" })]}
			fetchLogs={emptyLogs}
			refresh={noop}
			onStop={noopAsync}
			onDelete={noopAsync}
		/>,
	);
	expect(
		screen.getByRole("tab", { name: /overview/i }).getAttribute("aria-selected"),
	).toBe("true");
	expect(screen.getByText(/port 8081/i)).toBeTruthy();
	expect(screen.getByText(/dep-prod/)).toBeTruthy();
	expect(screen.getByText(/push to main/i)).toBeTruthy();
});

test("overview says so when the app has never deployed", () => {
	render(
		<AppDetail
			appName="web"
			connected={true}
			app={app}
			deployments={[]}
			fetchLogs={emptyLogs}
			refresh={noop}
			onStop={noopAsync}
			onDelete={noopAsync}
		/>,
	);
	expect(screen.getByText(/never deployed/i)).toBeTruthy();
});

test("the env tab is behind its tab, not on overview", () => {
	render(
		<AppDetail
			appName="web"
			connected={true}
			app={app}
			deployments={[]}
			env={{ NODE_ENV: "production" }}
			fetchLogs={emptyLogs}
			refresh={noop}
			onStop={noopAsync}
			onDelete={noopAsync}
		/>,
	);
	expect(screen.queryByText("NODE_ENV")).toBeNull();
	fireEvent.click(screen.getByRole("tab", { name: /env/i }));
	expect(screen.getByText("NODE_ENV")).toBeTruthy();
	expect(screen.queryByText(/push to main/i)).toBeNull();
});
```

Then migrate the three existing deployment tests — `"lists deployments and distinguishes production from PR previews"`, `"expanding a deployment fetches and shows its logs"`, and `"a building deployment live-tails logs and refreshes on interval"` — by clicking into the tab first. In each, immediately after `render(...)`, add:

```tsx
	fireEvent.click(screen.getByRole("tab", { name: /deployments/i }));
```

For the live-tail test, wrap that click in the existing `act` block that already wraps its first interaction.

Finally, delete the `"renders the app's env variables"` test added in Task 3 — the new `"the env tab is behind its tab, not on overview"` test supersedes it.

- [ ] **Step 2: Run them to verify they fail**

Run: `bun test src/components/app-detail.test.tsx`
Expected: FAIL — no element with `role="tab"`.

- [ ] **Step 3: Implement the tab shell**

In `src/components/app-detail.tsx`, add the tab list above the `AppDetail` function. `relativeTime` is already imported at line 6; add `cn`:

```tsx
import { cn } from "@/lib/utils";

type TabId = "overview" | "deployments" | "env";

const TABS: TabId[] = ["overview", "deployments", "env"];

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
```

Add `import type { ReactNode } from "react";` to the React import (`import { type ReactNode, useEffect, useRef, useState } from "react";`).

Inside `AppDetail`, after the early returns, add the tab state:

```tsx
	const [tab, setTab] = useState<TabId>("overview");
	const lastDeploy = deployments[0];
```

Then place `<TabNav active={tab} onSelect={setTab} />` directly after the header `<div>`, and wrap the three panels:

```tsx
			{tab === "overview" && (
				<div className="flex flex-col gap-4">
					<div className="flex flex-wrap gap-3">
						<StatTile label="status">
							<span className="flex items-center gap-2">
								<StatusPill status={app.status} />
								<span className="text-muted-foreground">
									· port {app.port}
								</span>
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
					{/* The existing block from app-detail.tsx:124-141, moved here
					    verbatim except for its <h2>Deployments</h2> heading, which the
					    tab label now supplies:
					    {deployments.length === 0 ? (
					      <p …>No deployments yet.</p>
					    ) : (
					      <ul …>{deployments.map((d) => <DeploymentRow … />)}</ul>
					    )} */}
				</section>
			)}

			{tab === "env" && (
				<AppEnv
					appName={app.name}
					status={app.status}
					env={env}
					onSet={onSetEnv}
					onRemove={onRemoveEnv}
					onRestart={onRestart}
				/>
			)}
```

Import `HintBar` from `@/components/ui/hint-bar`. Drop the `<h2>Deployments</h2>` heading — the tab now names the section.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test src/components/app-detail.test.tsx`
Expected: PASS. `port 8081` comes from the `app` fixture; `main` from its `branch`.

The overview hint introduces a second "main" on the page, so the existing `"renders the app header with repo and branch"` test's `screen.getByText(/main/)` now matches two nodes and throws. Tighten it to the header line:

```tsx
	expect(screen.getByText(/getpiper\/example · main/)).toBeTruthy();
```

and delete its now-redundant separate `getByText(/getpiper\/example/)` assertion.

- [ ] **Step 5: Run the full gate**

Run: `bun run verify`
Expected: all green.

- [ ] **Step 6: Commit and open PR 1**

```bash
git add src/components/app-detail.tsx src/components/app-detail.test.tsx
git commit -m "feat: tab the app detail page (overview/deployments/env)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -u origin ozykhan/app-detail-tabs-env
gh pr create --title "[app] app env vars + tabbed app detail" --body "$(cat <<'EOF'
## Summary
Per-app environment variables in the dashboard, over piper #441's
`/v1/apps/{name}/env` endpoints, and the app-detail page restructured into
`overview | deployments | env` tabs.

Design: `docs/superpowers/specs/2026-07-30-app-detail-tabs-env-design.md`.
The settings tab follows in a second PR.

## Test plan
- `bun run verify`
- Manually: open an app, add a variable, reveal it, edit it, remove it, and
  restart from the pending banner.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

### Task 5: The settings tab component

**Files:**
- Create: `src/components/app-settings.tsx`
- Test: `src/components/app-settings.test.tsx`

`app-detail.tsx` is **not** touched in this task: its header still renders `AppActions` and `DomainLine`, so those must keep working until Task 6 moves the mount point. This task copies the code it needs; Task 6 deletes the originals.

**Interfaces:**
- Consumes: `App` and `AppDomainStatus` types from `@/server/relay`; `Panel`/`PanelHeader`, `Row`, `Button`, `inputClass`, `StatusDot`, `HintBar`, `PageHeader` (with `as="h2"` from Task 2).
- Produces:
  ```ts
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
  ```

- [ ] **Step 1: Write the failing tests**

Create `src/components/app-settings.test.tsx`:

```tsx
import { expect, mock, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { App, AppDomainStatus } from "@/server/relay";
import { AppSettings } from "./app-settings";

const app: App = {
	name: "web",
	port: 8081,
	repo: "getpiper/example",
	branch: "main",
	hostname: "web-hash-zoe.public.example",
	createdAt: "2026-07-11T10:00:00Z",
	status: "running",
};

const domain = (over: Partial<AppDomainStatus> = {}): AppDomainStatus => ({
	domain: "shop.octo.dev",
	app: "web",
	status: "active",
	error: "",
	certNotAfter: null,
	dnsRecords: [],
	dnsOk: true,
	...over,
});

const noopAsync = async () => {};
const noopDomain = async (_d: string) => {};

function renderSettings(
	over: Partial<Parameters<typeof AppSettings>[0]> = {},
) {
	return render(
		<AppSettings
			app={app}
			base="abc-zoe"
			boxConnected={true}
			domains={[]}
			onAddDomain={noopDomain}
			onRemoveDomain={noopDomain}
			onStop={noopAsync}
			onStart={noopAsync}
			onDelete={noopAsync}
			{...over}
		/>,
	);
}

test("shows runtime and git facts read-only", () => {
	renderSettings();
	expect(screen.getByText("8081")).toBeTruthy();
	expect(screen.getByText("abc-zoe")).toBeTruthy();
	expect(screen.getByText("getpiper/example")).toBeTruthy();
	expect(screen.getByText("main")).toBeTruthy();
	// Piper has no update endpoint for these, so no edit affordances ship.
	expect(screen.queryByRole("button", { name: /^edit$/i })).toBeNull();
	expect(screen.queryByRole("button", { name: /unlink/i })).toBeNull();
});

test("lists a custom domain with its dns and cert status", () => {
	renderSettings({ domains: [domain({ status: "issuing", dnsOk: false })] });
	expect(screen.getByText("shop.octo.dev")).toBeTruthy();
	expect(screen.getByText(/dns pending/i)).toBeTruthy();
	expect(screen.getByText(/issuing/i)).toBeTruthy();
});

test("adding a domain calls onAddDomain and clears the input", async () => {
	const onAddDomain = mock(async (_d: string) => {});
	renderSettings({ onAddDomain });
	fireEvent.change(screen.getByLabelText(/domain for web/i), {
		target: { value: "shop.octo.dev" },
	});
	await act(async () => {
		fireEvent.click(screen.getByRole("button", { name: /add domain/i }));
	});
	expect(onAddDomain).toHaveBeenCalledWith("shop.octo.dev");
	expect(
		(screen.getByLabelText(/domain for web/i) as HTMLInputElement).value,
	).toBe("");
});

test("removing a domain calls onRemoveDomain", async () => {
	const onRemoveDomain = mock(async (_d: string) => {});
	renderSettings({ domains: [domain()], onRemoveDomain });
	await act(async () => {
		fireEvent.click(screen.getByRole("button", { name: /^remove$/i }));
	});
	expect(onRemoveDomain).toHaveBeenCalledWith("shop.octo.dev");
});

test("the danger zone still gates delete behind the typed app name", async () => {
	const onDelete = mock(async () => {});
	renderSettings({ onDelete });
	fireEvent.click(screen.getByRole("button", { name: /delete app/i }));
	const confirm = screen.getByRole("button", { name: /^delete$/i });
	expect((confirm as HTMLButtonElement).disabled).toBe(true);
	fireEvent.change(screen.getByLabelText(/confirm app name/i), {
		target: { value: "web" },
	});
	await act(async () => {
		fireEvent.click(confirm);
	});
	expect(onDelete).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `bun test src/components/app-settings.test.tsx`
Expected: FAIL — cannot resolve `./app-settings`.

- [ ] **Step 3: Create `app-settings.tsx`**

Copy `AppActions` (`app-detail.tsx:146-280`) and `domainDeviceStatus` (`app-detail.tsx:23-35`) into this new file unchanged — `AppActions` already implements stop/start and type-to-confirm delete. Leave the originals in place; Task 6 deletes them once the header stops rendering them. Then build the four sections around them:

```tsx
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
						<span className="text-status-idle text-xs">
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
						<span className="text-status-idle text-xs">
							one URL per open PR
						</span>
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
					point a CNAME at your box, then piper issues the cert — TLS
					terminates on the box, the relay only splices bytes.
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
									run(
										() => onRemoveDomain(d.domain),
										"couldn't remove domain",
									)
								}
								className="text-status-idle hover:text-status-danger disabled:opacity-50"
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
```

Then paste the `AppActions` function copied from `app-detail.tsx` at the bottom of this file, unchanged.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test src/components/app-settings.test.tsx`
Expected: PASS, 5 tests. `AppActions` uses `Button` with `bracketed={false}`, so `/^delete$/i` matches as before.

- [ ] **Step 5: Commit**

```bash
git add src/components/app-settings.tsx src/components/app-settings.test.tsx
git commit -m "feat: app settings tab component

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Mount the settings tab

**Files:**
- Modify: `src/components/app-detail.tsx`
- Modify: `src/components/app-detail.test.tsx`
- Modify: `src/routes/boxes/$base_.apps.$app.tsx`

**Interfaces:**
- Consumes: `AppSettings` / `AppSettingsProps` (Task 5), the existing `addAppDomainFn` and `removeAppDomainFn` server functions.
- Produces: `AppDetail` gains `base: string`, `onAddDomain?: (domain: string) => Promise<void>`, and `onRemoveDomain?: (domain: string) => Promise<void>`; its header no longer renders action buttons or domain lines; `TABS` becomes `["overview", "deployments", "env", "settings"]`.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/app-detail.test.tsx`:

```tsx
test("the settings tab holds the domains and the danger zone", () => {
	render(
		<AppDetail
			appName="web"
			base="abc-zoe"
			connected={true}
			app={app}
			deployments={[]}
			domains={[domain({ domain: "shop.octo.dev" })]}
			fetchLogs={emptyLogs}
			refresh={noop}
			onStop={noopAsync}
			onDelete={noopAsync}
		/>,
	);
	// The header sheds both: no action buttons, no domain lines.
	expect(screen.queryByText("shop.octo.dev")).toBeNull();
	expect(screen.queryByRole("button", { name: /^stop$/i })).toBeNull();

	fireEvent.click(screen.getByRole("tab", { name: /settings/i }));
	expect(screen.getByText("shop.octo.dev")).toBeTruthy();
	expect(screen.getByRole("button", { name: /^stop$/i })).toBeTruthy();
	expect(screen.getByRole("button", { name: /delete app/i })).toBeTruthy();
});
```

Then migrate the existing tests:

- Delete `"links a healthy custom domain without a warning"`, `"surfaces cert and dns status when a custom domain is unhealthy"`, and `"renders a line per custom domain"` — the header no longer renders domains, and `app-settings.test.tsx` now covers the settings table (which always shows dns + cert status, by design).
- In each of the nine action tests — `"Stop calls onStop and shows a pending state while it runs"`, `"hides Stop when the app is already stopped"`, `"shows Start (not Stop) when the app is stopped and calls onStart"`, `"hides Start when the app is running"`, `"a rejected onStart renders the error message"`, `"Delete stays disabled until the exact app name is typed, then calls onDelete"`, `"Cancel collapses the confirm block without calling onDelete"`, `"a rejected onStop renders the error message"`, and `"a rejected onDelete renders the error and keeps the confirm block"` — add `base="abc-zoe"` to the props and click into settings right after `render(...)`:

```tsx
	fireEvent.click(screen.getByRole("tab", { name: /settings/i }));
```

- Add `base="abc-zoe"` to every other `render(<AppDetail …>)` call in the file.
- Delete the now-unused `domain()` helper if no test in this file still uses it (the new settings test above does, so keep it).

- [ ] **Step 2: Run them to verify they fail**

Run: `bun test src/components/app-detail.test.tsx`
Expected: FAIL — no `settings` tab; `base` is not a prop.

- [ ] **Step 3: Mount `AppSettings` and strip the header**

In `src/components/app-detail.tsx`:

1. Add `base: string;`, `onAddDomain?: (domain: string) => Promise<void>;`, and `onRemoveDomain?: (domain: string) => Promise<void>;` to `AppDetailProps`, destructuring the two callbacks with `async () => {}` defaults.
2. Extend the tab union and list: `type TabId = "overview" | "deployments" | "env" | "settings";` and `const TABS: TabId[] = ["overview", "deployments", "env", "settings"];`
3. Delete the `<AppActions …>` call and the `{domains.map((d) => <DomainLine …/>)}` block from the header, then delete the three now-orphaned functions Task 5 copied into `app-settings.tsx` or replaced — `domainDeviceStatus`, `DomainLine`, and `AppActions` — along with the `StatusDot`/`DeviceStatus`, `inputClass`, and `isRedirect` imports if nothing else in the file uses them (`Button` stays only if something else needs it; after this deletion nothing in `app-detail.tsx` does).
4. Render the panel:

```tsx
			{tab === "settings" && (
				<AppSettings
					app={app}
					base={base}
					boxConnected={connected}
					domains={domains}
					onAddDomain={onAddDomain}
					onRemoveDomain={onRemoveDomain}
					onStop={onStop}
					onStart={onStart}
					onDelete={onDelete}
				/>
			)}
```

with `import { AppSettings } from "./app-settings";`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test src/components/app-detail.test.tsx`
Expected: PASS.

- [ ] **Step 5: Pass `base` and the domain callbacks from the route**

In `src/routes/boxes/$base_.apps.$app.tsx`, add to the imports:

```tsx
	addAppDomainFn,
	removeAppDomainFn,
```

and to the `<AppDetail>` props:

```tsx
			base={base}
			onAddDomain={async (domain) => {
				await addAppDomainFn({ data: { base, app: appName, domain } });
				router.invalidate();
			}}
			onRemoveDomain={async (domain) => {
				await removeAppDomainFn({ data: { base, app: appName, domain } });
				router.invalidate();
			}}
```

- [ ] **Step 6: Run the full gate**

Run: `bun run verify`
Expected: all green. If Biome flags import order, run `bun run format`.

- [ ] **Step 7: Commit and open PR 2**

```bash
git add src/components/app-detail.tsx src/components/app-detail.test.tsx "src/routes/boxes/\$base_.apps.\$app.tsx"
git commit -m "feat: app settings tab with domains and danger zone

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push
gh pr create --title "[app] app detail settings tab" --body "$(cat <<'EOF'
## Summary
Adds the settings tab from the design: runtime and git facts (read-only —
piper has no update endpoint for port, branch, or repo unlink), the app's
custom domains with dns/cert status and add/remove, and the danger zone,
which absorbs the stop/start/delete row from the page header.

Design: `docs/superpowers/specs/2026-07-30-app-detail-tabs-env-design.md`.

## Test plan
- `bun run verify`
- Manually: open an app's settings tab, add and remove a custom domain, stop
  and start the app, and confirm delete still requires the typed name.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Notes for the implementer

- **`piper env` is the escape hatch.** If a write fails against a real box, `piper env <app> ls --show` on the box tells you what actually persisted.
- **Restart is stop-then-start.** There is no single restart endpoint; the route composes the two. A stopped app skips the stop.
- **Values are plaintext on the wire.** Masking is cosmetic. Don't add logging that would print an env payload.
- **The design file is the reference for spacing and copy**, but every color goes through a token class. If you need a value the tokens don't have, that's a signal to re-read `docs/superpowers/specs/2026-07-15-design-philosophy-design.md`, not to inline hex.
