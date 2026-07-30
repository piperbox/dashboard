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
		return Response.json({
			env: { NODE_ENV: "production", PORT_HINT: "8080" },
		});
	}) as typeof fetch;

	const env = await fetchAppEnv("cred-1", "abc-zoe", "api");
	expect(seenUrl).toBe("https://relay.test/agents/abc-zoe/v1/apps/api/env");
	expect<string | null>(seenAuth).toBe("Bearer cred-1");
	expect(env).toEqual({ NODE_ENV: "production", PORT_HINT: "8080" });
});

test("fetchAppEnv returns an empty record when the box omits env", async () => {
	globalThis.fetch = (async () => Response.json({})) as unknown as typeof fetch;
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
