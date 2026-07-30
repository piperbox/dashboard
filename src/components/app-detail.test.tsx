import { expect, jest, mock, test } from "bun:test";
import {
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import type { App, AppDomainStatus, Deployment } from "@/server/relay";
import { AppDetail } from "./app-detail";

const app: App = {
	name: "web",
	port: 8081,
	repo: "getpiper/example",
	branch: "main",
	hostname: "web-hash-zoe.public.example",
	createdAt: "2026-07-11T10:00:00Z",
	status: "running",
};

const dep = (over: Partial<Deployment>): Deployment => ({
	id: "dep-abc1234",
	pr: 0,
	status: "running",
	createdAt: "2026-07-11T10:00:00Z",
	...over,
});

const noop = () => {};
const emptyLogs = async () => "";
const noopAsync = async () => {};

const domain = (over: Partial<AppDomainStatus>): AppDomainStatus => ({
	domain: "shop.octo.dev",
	app: "web",
	status: "active",
	error: "",
	certNotAfter: null,
	dnsRecords: [],
	dnsOk: true,
	...over,
});

// The settings tab mounts AppSettings, which renders <Link> — that needs a
// router context to mount.
async function renderInRouter(el: ReactElement) {
	const rootRoute = createRootRoute({ component: () => el });
	const router = createRouter({ routeTree: rootRoute });
	await router.navigate({ to: "/" });
	// biome-ignore lint/suspicious/noExplicitAny: test router typing shortcut
	return render(<RouterProvider router={router as any} />);
}

test("renders the app header with repo and branch", () => {
	render(
		<AppDetail
			appName="web"
			base="abc-zoe"
			connected={true}
			app={app}
			deployments={[]}
			fetchLogs={emptyLogs}
			refresh={noop}
			onStop={noopAsync}
			onDelete={noopAsync}
		/>,
	);
	expect(screen.getByText("web")).toBeTruthy();
	expect(screen.getByText(/getpiper\/example · main/)).toBeTruthy();
});

test("links to the app's relay-assigned hostname", () => {
	render(
		<AppDetail
			appName="web"
			base="abc-zoe"
			connected={true}
			app={app}
			deployments={[]}
			fetchLogs={emptyLogs}
			refresh={noop}
			onStop={noopAsync}
			onDelete={noopAsync}
		/>,
	);
	const link = screen.getByText("web-hash-zoe.public.example");
	expect(link.getAttribute("href")).toBe("https://web-hash-zoe.public.example");
});

test("shows 'Not deployed yet' when the app has no hostname", () => {
	render(
		<AppDetail
			appName="web"
			base="abc-zoe"
			connected={true}
			app={{ ...app, hostname: "" }}
			deployments={[]}
			fetchLogs={emptyLogs}
			refresh={noop}
			onStop={noopAsync}
			onDelete={noopAsync}
		/>,
	);
	expect(screen.getByText(/not deployed yet/i)).toBeTruthy();
});

test("shows an offline message when the app is null", () => {
	render(
		<AppDetail
			appName="web"
			base="abc-zoe"
			connected={false}
			app={null}
			deployments={[]}
			fetchLogs={emptyLogs}
			refresh={noop}
			onStop={noopAsync}
			onDelete={noopAsync}
		/>,
	);
	expect(screen.getByText(/offline/i)).toBeTruthy();
});

test("shows a not-found message when the box is connected but the app is missing", () => {
	render(
		<AppDetail
			appName="web"
			base="abc-zoe"
			connected={true}
			app={null}
			deployments={[]}
			fetchLogs={emptyLogs}
			refresh={noop}
			onStop={noopAsync}
			onDelete={noopAsync}
		/>,
	);
	expect(screen.getByText(/not found/i)).toBeTruthy();
});

test("lists deployments and distinguishes production from PR previews", () => {
	render(
		<AppDetail
			appName="web"
			base="abc-zoe"
			connected={true}
			app={app}
			deployments={[
				dep({ id: "dep-prod0001", pr: 0, status: "running" }),
				dep({ id: "dep-prev0002", pr: 12, status: "failed" }),
			]}
			fetchLogs={emptyLogs}
			refresh={noop}
			onStop={noopAsync}
			onDelete={noopAsync}
		/>,
	);
	fireEvent.click(screen.getByRole("tab", { name: /deployments/i }));
	expect(screen.getByText(/Production/)).toBeTruthy();
	const prLink = screen.getByRole("link", { name: /PR #12/ });
	expect(prLink.getAttribute("href")).toBe(
		"https://github.com/getpiper/example/pull/12",
	);
});

test("expanding a deployment fetches and shows its logs", async () => {
	const fetchLogs = async (id: string) => `logs for ${id}`;
	render(
		<AppDetail
			appName="web"
			base="abc-zoe"
			connected={true}
			app={app}
			deployments={[dep({ id: "dep-abc1234", status: "failed" })]}
			fetchLogs={fetchLogs}
			refresh={noop}
			onStop={noopAsync}
			onDelete={noopAsync}
		/>,
	);
	fireEvent.click(screen.getByRole("tab", { name: /deployments/i }));
	fireEvent.click(screen.getByRole("button", { name: /dep-abc1/ }));
	expect(await screen.findByText("logs for dep-abc1234")).toBeTruthy();
});

test("a building deployment live-tails logs and refreshes on interval", async () => {
	jest.useFakeTimers();
	let calls = 0;
	let refreshes = 0;
	const fetchLogs = async () => {
		calls++;
		return `log ${calls}`;
	};
	render(
		<AppDetail
			appName="web"
			base="abc-zoe"
			connected={true}
			app={app}
			deployments={[dep({ id: "dep-build001", status: "building" })]}
			fetchLogs={fetchLogs}
			refresh={() => {
				refreshes++;
			}}
			onStop={noopAsync}
			onDelete={noopAsync}
		/>,
	);
	fireEvent.click(screen.getByRole("tab", { name: /deployments/i }));
	await act(async () => {
		fireEvent.click(screen.getByRole("button", { name: /dep-buil/ }));
	});
	expect(calls).toBe(1);
	await act(async () => {
		jest.advanceTimersByTime(4000);
	});
	expect(calls).toBe(3);
	expect(refreshes).toBe(2);
	jest.useRealTimers();
});

test("Stop calls onStop and shows a pending state while it runs", async () => {
	let release: () => void = () => {};
	const gate = new Promise<void>((r) => {
		release = r;
	});
	const onStop = mock(() => gate);
	await renderInRouter(
		<AppDetail
			appName="web"
			base="abc-zoe"
			connected={true}
			app={app}
			deployments={[]}
			fetchLogs={emptyLogs}
			refresh={noop}
			onStop={onStop}
			onDelete={noopAsync}
		/>,
	);
	fireEvent.click(screen.getByRole("tab", { name: /settings/i }));
	fireEvent.click(screen.getByRole("button", { name: /^stop$/i }));
	expect(onStop).toHaveBeenCalledTimes(1);
	expect(screen.getByRole("button", { name: /stopping/i })).toBeTruthy();
	await act(async () => {
		release();
		await gate;
	});
});

test("hides Stop when the app is already stopped", async () => {
	await renderInRouter(
		<AppDetail
			appName="web"
			base="abc-zoe"
			connected={true}
			app={{ ...app, status: "stopped" }}
			deployments={[]}
			fetchLogs={emptyLogs}
			refresh={noop}
			onStop={noopAsync}
			onDelete={noopAsync}
		/>,
	);
	fireEvent.click(screen.getByRole("tab", { name: /settings/i }));
	expect(screen.queryByRole("button", { name: /^stop$/i })).toBeNull();
});

test("shows Start (not Stop) when the app is stopped and calls onStart", async () => {
	const onStart = mock(async () => {});
	await renderInRouter(
		<AppDetail
			appName="web"
			base="abc-zoe"
			connected={true}
			app={{ ...app, status: "stopped" }}
			deployments={[]}
			fetchLogs={emptyLogs}
			refresh={noop}
			onStop={noopAsync}
			onStart={onStart}
			onDelete={noopAsync}
		/>,
	);
	fireEvent.click(screen.getByRole("tab", { name: /settings/i }));
	expect(screen.queryByRole("button", { name: /^stop$/i })).toBeNull();
	await act(async () => {
		fireEvent.click(screen.getByRole("button", { name: /^start$/i }));
	});
	expect(onStart).toHaveBeenCalledTimes(1);
});

test("hides Start when the app is running", async () => {
	await renderInRouter(
		<AppDetail
			appName="web"
			base="abc-zoe"
			connected={true}
			app={app}
			deployments={[]}
			fetchLogs={emptyLogs}
			refresh={noop}
			onStop={noopAsync}
			onStart={noopAsync}
			onDelete={noopAsync}
		/>,
	);
	fireEvent.click(screen.getByRole("tab", { name: /settings/i }));
	expect(screen.queryByRole("button", { name: /^start$/i })).toBeNull();
	expect(screen.getByRole("button", { name: /^stop$/i })).toBeTruthy();
});

test("a rejected onStart renders the error message", async () => {
	const onStart = async () => {
		throw new Error("boom start");
	};
	await renderInRouter(
		<AppDetail
			appName="web"
			base="abc-zoe"
			connected={true}
			app={{ ...app, status: "stopped" }}
			deployments={[]}
			fetchLogs={emptyLogs}
			refresh={noop}
			onStop={noopAsync}
			onStart={onStart}
			onDelete={noopAsync}
		/>,
	);
	fireEvent.click(screen.getByRole("tab", { name: /settings/i }));
	await act(async () => {
		fireEvent.click(screen.getByRole("button", { name: /^start$/i }));
	});
	expect(screen.getByText(/boom start/i)).toBeTruthy();
});

test("Delete stays disabled until the exact app name is typed, then calls onDelete", async () => {
	const onDelete = mock(async () => {});
	await renderInRouter(
		<AppDetail
			appName="web"
			base="abc-zoe"
			connected={true}
			app={app}
			deployments={[]}
			fetchLogs={emptyLogs}
			refresh={noop}
			onStop={noopAsync}
			onDelete={onDelete}
		/>,
	);
	fireEvent.click(screen.getByRole("tab", { name: /settings/i }));
	fireEvent.click(screen.getByRole("button", { name: /delete app/i }));
	const confirm = screen.getByRole("button", { name: /^delete$/i });
	expect((confirm as HTMLButtonElement).disabled).toBe(true);
	fireEvent.change(screen.getByLabelText(/confirm app name/i), {
		target: { value: "web" },
	});
	expect((confirm as HTMLButtonElement).disabled).toBe(false);
	await act(async () => {
		fireEvent.click(confirm);
	});
	expect(onDelete).toHaveBeenCalledTimes(1);
});

test("Cancel collapses the confirm block without calling onDelete", async () => {
	const onDelete = mock(async () => {});
	await renderInRouter(
		<AppDetail
			appName="web"
			base="abc-zoe"
			connected={true}
			app={app}
			deployments={[]}
			fetchLogs={emptyLogs}
			refresh={noop}
			onStop={noopAsync}
			onDelete={onDelete}
		/>,
	);
	fireEvent.click(screen.getByRole("tab", { name: /settings/i }));
	fireEvent.click(screen.getByRole("button", { name: /delete app/i }));
	fireEvent.change(screen.getByLabelText(/confirm app name/i), {
		target: { value: "web" },
	});
	fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
	expect(screen.queryByLabelText(/confirm app name/i)).toBeNull();
	expect(onDelete).not.toHaveBeenCalled();
});

test("a rejected onStop renders the error message", async () => {
	const onStop = async () => {
		throw new Error("boom stop");
	};
	await renderInRouter(
		<AppDetail
			appName="web"
			base="abc-zoe"
			connected={true}
			app={app}
			deployments={[]}
			fetchLogs={emptyLogs}
			refresh={noop}
			onStop={onStop}
			onDelete={noopAsync}
		/>,
	);
	fireEvent.click(screen.getByRole("tab", { name: /settings/i }));
	await act(async () => {
		fireEvent.click(screen.getByRole("button", { name: /^stop$/i }));
	});
	expect(screen.getByText(/boom stop/i)).toBeTruthy();
});

test("a rejected onDelete renders the error and keeps the confirm block", async () => {
	const onDelete = async () => {
		throw new Error("boom delete");
	};
	await renderInRouter(
		<AppDetail
			appName="web"
			base="abc-zoe"
			connected={true}
			app={app}
			deployments={[]}
			fetchLogs={emptyLogs}
			refresh={noop}
			onStop={noopAsync}
			onDelete={onDelete}
		/>,
	);
	fireEvent.click(screen.getByRole("tab", { name: /settings/i }));
	fireEvent.click(screen.getByRole("button", { name: /delete app/i }));
	fireEvent.change(screen.getByLabelText(/confirm app name/i), {
		target: { value: "web" },
	});
	await act(async () => {
		fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
	});
	expect(screen.getByText(/boom delete/i)).toBeTruthy();
	expect(screen.getByLabelText(/confirm app name/i)).toBeTruthy();
});

test("opens on the overview tab with the app's port and last deploy", () => {
	render(
		<AppDetail
			appName="web"
			base="abc-zoe"
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
		screen
			.getByRole("tab", { name: /overview/i })
			.getAttribute("aria-selected"),
	).toBe("true");
	expect(screen.getByText(/port 8081/i)).toBeTruthy();
	expect(screen.getByText(/dep-prod/)).toBeTruthy();
	expect(screen.getByText(/push to main/i)).toBeTruthy();
});

test("overview says so when the app has never deployed", () => {
	render(
		<AppDetail
			appName="web"
			base="abc-zoe"
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
			base="abc-zoe"
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

test("the settings tab holds the domains and the danger zone", async () => {
	await renderInRouter(
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
