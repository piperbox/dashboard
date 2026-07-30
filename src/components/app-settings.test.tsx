import { expect, mock, test } from "bun:test";
import {
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
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

// AppSettings renders <Link>, which needs a router context to mount.
async function renderSettings(
	over: Partial<Parameters<typeof AppSettings>[0]> = {},
) {
	const rootRoute = createRootRoute({
		component: () => (
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
			/>
		),
	});
	const router = createRouter({ routeTree: rootRoute });
	await router.navigate({ to: "/" });
	// biome-ignore lint/suspicious/noExplicitAny: test router typing shortcut
	return render(<RouterProvider router={router as any} />);
}

test("shows runtime and git facts read-only", async () => {
	await renderSettings();
	expect(screen.getByText("8081")).toBeTruthy();
	expect(screen.getByText("abc-zoe")).toBeTruthy();
	expect(screen.getByText("getpiper/example")).toBeTruthy();
	expect(screen.getByText("main")).toBeTruthy();
	// Piper has no update endpoint for these, so no edit affordances ship.
	expect(screen.queryByRole("button", { name: /^edit$/i })).toBeNull();
	expect(screen.queryByRole("button", { name: /unlink/i })).toBeNull();
});

test("lists a custom domain with its dns and cert status", async () => {
	await renderSettings({
		domains: [domain({ status: "issuing", dnsOk: false })],
	});
	expect(screen.getByText("shop.octo.dev")).toBeTruthy();
	expect(screen.getByText(/dns pending/i)).toBeTruthy();
	expect(screen.getByText(/issuing/i)).toBeTruthy();
});

test("adding a domain calls onAddDomain and clears the input", async () => {
	const onAddDomain = mock(async (_d: string) => {});
	await renderSettings({ onAddDomain });
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
	await renderSettings({ domains: [domain()], onRemoveDomain });
	await act(async () => {
		fireEvent.click(screen.getByRole("button", { name: /^remove$/i }));
	});
	expect(onRemoveDomain).toHaveBeenCalledWith("shop.octo.dev");
});

test("the danger zone still gates delete behind the typed app name", async () => {
	const onDelete = mock(async () => {});
	await renderSettings({ onDelete });
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
