const COOKIE_ATTRS = "HttpOnly; Secure; SameSite=Lax; Path=/";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// publicOrigin is the origin the browser sees. Behind piper's Caddy the
// container speaks plain HTTP, so request.url carries scheme http even when
// the user is on https — the proxy preserves the real scheme in
// X-Forwarded-Proto, and without honoring it the relay is asked to redirect
// to http://… and refuses (redirect_uri not allowed).
function publicOrigin(request: Request): string {
	const url = new URL(request.url);
	const proto = request.headers.get("X-Forwarded-Proto");
	if (proto === "http" || proto === "https") {
		url.protocol = `${proto}:`;
	}
	return url.origin;
}

export function handleLogin(request: Request, relayBase: string): Response {
	const params = new URLSearchParams({
		redirect_uri: `${publicOrigin(request)}/auth/callback`,
	});
	return Response.redirect(`${relayBase}/v1/login/web?${params}`, 302);
}

export async function handleSession(request: Request): Promise<Response> {
	const origin = request.headers.get("Origin");
	if (origin === null || origin !== publicOrigin(request)) {
		return new Response("cross-origin request rejected", { status: 403 });
	}
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return new Response("invalid JSON body", { status: 400 });
	}
	const { credential, username } = (body ?? {}) as {
		credential?: unknown;
		username?: unknown;
	};
	if (typeof credential !== "string" || credential === "") {
		return new Response("missing credential", { status: 400 });
	}
	const name = typeof username === "string" ? username : "";
	const response = new Response(null, { status: 204 });
	// Append Set-Cookie after construction: happy-dom's Response (test
	// preload) drops headers passed to the constructor.
	response.headers.append(
		"Set-Cookie",
		`piper_session=${encodeURIComponent(credential)}; ${COOKIE_ATTRS}; Max-Age=${SESSION_MAX_AGE}`,
	);
	response.headers.append(
		"Set-Cookie",
		`piper_username=${encodeURIComponent(name)}; ${COOKIE_ATTRS}; Max-Age=${SESSION_MAX_AGE}`,
	);
	return response;
}

export function handleLogout(): Response {
	const response = new Response(null, { status: 204 });
	response.headers.append(
		"Set-Cookie",
		`piper_session=; ${COOKIE_ATTRS}; Max-Age=0`,
	);
	response.headers.append(
		"Set-Cookie",
		`piper_username=; ${COOKIE_ATTRS}; Max-Age=0`,
	);
	return response;
}
