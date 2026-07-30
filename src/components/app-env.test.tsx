import { expect, mock, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { AppEnv, type AppEnvProps } from "./app-env";

const env = {
	NODE_ENV: "production",
	DATABASE_URL: "postgres://piper:hunter2@127.0.0.1:5432/blog",
};

const noopSet = async (_k: string, _v: string) => {};
const noopRemove = async (_k: string) => {};
const noopRestart = async () => {};

// The pending set lives in the parent (AppDetail) so it survives a tab
// switch; this harness stands in for that parent during tests.
function Harness(over: Partial<AppEnvProps>) {
	const [pending, setPending] = useState<string[]>([]);
	return (
		<AppEnv
			appName="web"
			status="running"
			env={env}
			pending={pending}
			onPendingChange={setPending}
			onSet={noopSet}
			onRemove={noopRemove}
			onRestart={noopRestart}
			{...over}
		/>
	);
}

function renderEnv(over: Partial<AppEnvProps> = {}) {
	return render(<Harness {...over} />);
}

test("lists keys alphabetically", () => {
	renderEnv();
	const keys = screen
		.getAllByTestId("env-key")
		.map((el) => el.textContent?.trim());
	expect(keys).toEqual(["DATABASE_URL", "NODE_ENV"]);
});

test("masks every value by default, secret-shaped or not, and reveals them on toggle", () => {
	renderEnv();
	// Every value is masked by default, regardless of whether its key looks
	// secret-shaped — the secret badge marks emphasis, not masking eligibility.
	expect(screen.queryByText("production")).toBeNull();
	expect(screen.queryByText(env.DATABASE_URL)).toBeNull();
	expect(screen.getByText(/secret/i)).toBeTruthy();

	fireEvent.click(screen.getByRole("button", { name: /reveal all/i }));
	expect(screen.getByText("production")).toBeTruthy();
	expect(screen.getByText(env.DATABASE_URL)).toBeTruthy();

	fireEvent.click(screen.getByRole("button", { name: /hide values/i }));
	expect(screen.queryByText("production")).toBeNull();
	expect(screen.queryByText(env.DATABASE_URL)).toBeNull();
});

test("the secret badge only marks DATABASE_URL, not NODE_ENV", () => {
	renderEnv();
	expect(screen.getAllByText(/^secret$/i)).toHaveLength(1);
});

test("shows a hint instead of a table when the app has no variables", () => {
	renderEnv({ env: {} });
	expect(screen.getByText(/no variables yet/i)).toBeTruthy();
	expect(screen.getByText("piper env set")).toBeTruthy();
});

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

test("env === null renders only an upgrade hint — no table, add button, or reveal toggle", () => {
	renderEnv({ env: null });
	expect(screen.getByText(/upgrade/i)).toBeTruthy();
	expect(screen.queryByTestId("env-key")).toBeNull();
	expect(screen.queryByRole("button", { name: /new variable/i })).toBeNull();
	expect(screen.queryByRole("button", { name: /reveal all/i })).toBeNull();
	expect(screen.queryByRole("button", { name: /hide values/i })).toBeNull();
});
