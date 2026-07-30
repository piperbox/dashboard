# App detail tabs + env vars (design)

**Date:** 2026-07-30
**Status:** approved design, pre-implementation
**Source:** imported from the Claude Design project *Piper Dashboard*
(`Piper Dashboard.dc.html`), drawn against this repo's own terminal design
system.
**Dependency:** [piperbox/piper#441](https://github.com/piperbox/piper/pull/441)
(per-app environment variables) — shipped.

The imported file covers five screens: apps, boxes, box detail, domains, and app
detail. Three of them already ship essentially as drawn
([`apps-list.tsx`](../../../src/components/apps-list.tsx),
[`apps-home.tsx`](../../../src/components/apps-home.tsx),
[`domains-list.tsx`](../../../src/components/domains-list.tsx)) and are not
touched by this spec. The delta is app detail: it becomes tabbed, gains an **env**
tab, and gains a **settings** tab that absorbs the lifecycle actions and the app's
custom domains.

## Goal

From the app-detail page, a user can manage the app's environment variables
end-to-end — read, add, edit, remove, reveal — and apply them by restarting the
app, without touching the CLI. Everything else about how the app is built,
routed, and served is legible from one settings tab.

## Non-goals

Each of these is a piper-side gap, not a design preference. They were checked
against `piperbox/piper` at `1f6593d`:

- **`updated` timestamps per variable.** `app_env` is `(app, key, value)` — the
  table has no timestamp column and the API returns none. The design's `updated`
  column is dropped. Follow-up: piper issue to add `updated_at`.
- **Discard pending changes.** Every edit has already been persisted by
  `POST .../env`; there is no server-side draft to discard. Dropped. The banner
  stays, meaning "saved on the box, not yet in the running container" — which is
  true.
- **Editing container port, unlinking the repo, changing the tracked branch,
  toggling deploy-on-push.** Only `POST /v1/apps/{name}/link` exists; there is no
  update endpoint and no autodeploy flag in the app model. These render read-only,
  with no dead buttons.
- **`restart policy: always`.** `DockerRuntime.Run` sets no `RestartPolicy`
  (`internal/runtime/docker.go`), so Docker's default `no` applies. The row is
  dropped rather than shipped wrong.
- **Variable counts.** No `env: N vars` row on the apps grid (it would also double
  that page's per-app request fan-out), and no count in the env tab's subtitle.
- **Bulk `.env` paste.** The API takes one variable per request; a paste importer
  is N sequential writes with partial-failure states. Deferred.
- **Per-environment values.** Piper stores one set per app; PR previews inherit
  it. There is no production/preview selector to build.

## The control path (verified against `piperbox/piper`)

The relay forwards any `/agents/{base}/v1/*` to the box over the tunnel,
authenticated with the account bearer in the `piper_session` cookie — the same
plumbing every prior slice used, including the nested `DELETE .../domains/{domain}`
this repo already calls. **No new piper or relay endpoint is required.**

| Action | Request | Response |
| --- | --- | --- |
| Read | `GET {relay}/agents/{base}/v1/apps/{app}/env` | `200 {"env": {"KEY": "value", …}}` — full plaintext values |
| Upsert | `POST {relay}/agents/{base}/v1/apps/{app}/env` body `{key, value}` | `204`; `400` key fails `^[A-Za-z_][A-Za-z0-9_]*$`; `400` key is `PORT` (case-insensitive); `404` unknown app |
| Remove | `DELETE {relay}/agents/{base}/v1/apps/{app}/env/{key}` | `204`, idempotent |

Two consequences worth stating plainly:

- Values come back in **full plaintext**. Masking in the UI is a display default,
  not a security boundary — exactly as piper's own spec says of `piper env ls`.
- Writes **never touch the running container**. They apply on the app's next
  deploy or stop/start. The dashboard has no deploy trigger, so restart is the
  only in-UI apply path.

## Design

### Transport — `src/server/relay.ts`

Three functions mirroring the `fetchAppDomains` / `addAppDomain` /
`removeAppDomain` trio directly above them, including the same error ladder
(`401` → `RelayAuthError`, `502`/`503` → `BoxOfflineError`, otherwise the body
text):

```ts
fetchAppEnv(credential, base, app): Promise<Record<string, string>>
setAppEnv(credential, base, app, key, value): Promise<void>
removeAppEnv(credential, base, app, key): Promise<void>
```

The wire shape is already lowercase, so no `Raw*` capital-key remap is needed:
`fetchAppEnv` unwraps `{env}` and returns the record. `removeAppEnv`
`encodeURIComponent`s the key.

### Session — `src/server/fns.ts`

`getAppEnv` (validator `{base, app}`), `setAppEnvFn`, and `removeAppEnvFn`
(`{base, app, key[, value]}`, `method: "POST"`), each reading the
`piper_session` cookie, redirecting to `/login` when absent, and calling
`dropSessionAndRedirect()` on `RelayAuthError` — the established shape.

### Route — `src/routes/boxes/$base_.apps.$app.tsx`

`env` joins `deployments` and `domains` in the loader's existing `Promise.all`,
and the three write callbacks are threaded down and each `router.invalidate()` on
success, as `onStop`/`onStart` already do.

### Tab shell — `src/components/app-detail.tsx`

Tabs `overview | deployments | env | settings`, held in local `useState`,
defaulting to `overview`. Deliberately **not** a URL search param: the design's
only cross-screen deep link into a tab was the domains page, and our domains page
adds domains inline instead. The cost — tabs are not linkable or back-navigable —
is accepted for now and noted as a follow-up.

The header keeps name, status, hostname, and repo·branch. Its stop/start/delete
row and its `DomainLine` list move into settings, so the header stops carrying
actions.

**Overview** is two stat tiles (`status · port`, `last deploy`) plus the
`$ push to <branch> to build and publish.` hint. The design's third tile was the
variable count, dropped per above.

**Deployments** is today's section unchanged, moved behind the tab.

### Env tab — `src/components/app-env.tsx` (new)

A new file rather than more of `app-detail.tsx`, which is already ~390 lines. It
takes data and callbacks only — no server-fn imports:

```ts
type AppEnvProps = {
  appName: string;
  status: string;
  env: Record<string, string>;
  onSet: (key: string, value: string) => Promise<void>;
  onRemove: (key: string) => Promise<void>;
  onRestart: () => Promise<void>;
};
```

Local state: `reveal`, the key being edited, its draft value, the add-row's
key/value, and `pendingKeys` — the set of keys written since mount, which drives
both the banner and each row's `pending` badge.

**Table** (`Panel` + `PanelHeader`): columns key / value / actions, keys sorted
alphabetically so the order is stable across writes (the API returns an unordered
map).

**Masking.** A key matching
`/(SECRET|TOKEN|_KEY|KEY_|PASSWORD|CREDENTIAL|PRIVATE|DSN|DATABASE_URL)/i`
carries a `secret` badge and renders its value as `•` × `min(length, 26)`;
everything else renders plain. One `Reveal all` / `Hide values` toggle flips the
masked ones. Editing a row always shows the real value.

**Add row.** Key and value inputs with `Save` / `Cancel`. Validation runs
client-side before any request and blocks `Save`, mirroring what the API would
return so the two never disagree: key must match
`^[A-Za-z_][A-Za-z0-9_]*$`; `PORT` is reserved because piper sets it from the
app's configured port; a duplicate key points the user at the existing row. A
persistent hint below the table states the key rule and the `PORT` reservation.

**Edit / remove.** Inline per row: `edit` swaps the value cell for an input with
`save` / `cancel`; `remove` deletes without a confirm step (the endpoint is
idempotent and one variable is cheap to retype — unlike app deletion, which keeps
its type-to-confirm).

**Pending banner.** Shown while `pendingKeys` is non-empty:
`▲ N changes pending — restart <app> to apply them.` with one action. For a
running app that is `Restart app` (`stopApp` then `startApp`); for a stopped one
it is `Start app` (`startApp` only), since stopping a stopped app is not a
restart. On success `pendingKeys` clears; on failure the banner stays and shows
the error.

**Empty state.** A `HintBar` reading "no variables yet — add one, or run
`piper env set` on the box."

### Settings tab — `src/components/app-settings.tsx` (new)

Four sections of `Panel`/`Row`:

- **Runtime** — container port (read-only, `health-checked on deploy`), and the
  box with its connection `StatusDot`, linking to box detail.
- **Git** — repository, tracked branch, and `preview deploys: pull requests ·
  one URL per open PR`, all read-only, under the hint that the GitHub App private
  key and webhook secret stay on the box.
- **Domains** — the app's hostname row (`relay wildcard · managed`), its custom
  domains with dns/cert status and `remove`, and an add-domain input. Wired to the
  existing `addAppDomainFn` / `removeAppDomainFn`; the app-detail route already
  loads `domains`.
- **Danger zone** — today's `AppActions` verbatim: stop/start, and delete behind
  type-the-app-name confirmation.

## Error handling

Unchanged in kind from the existing components: each action owns a `busy` flag
and an inline `text-destructive` message, and every `catch` re-throws
`isRedirect(err)` first so TanStack's redirects still propagate. Because env
writes are one request per variable, a mid-sequence failure leaves earlier writes
saved — the message names the key that failed rather than implying the whole edit
rolled back.

## Testing

Test-first throughout, at the seams the repo already tests
(`bun test` + Testing Library; nothing under `src/routes/`):

- **`src/server/relay-app-env.test.ts`** — `{env}` unwrapping, `POST` body
  shape, key encoding in the `DELETE` path, `401` → `RelayAuthError`, `502` →
  `BoxOfflineError`, non-2xx body text surfaced.
- **`src/components/app-env.test.tsx`** — renders keys; masks a secret-looking
  value and reveals it on toggle; a non-secret value renders plain; add-row
  blocks an invalid key, `PORT`, and a duplicate, each with its message; a valid
  add calls `onSet`; edit calls `onSet` with the new value; `remove` calls
  `onRemove`; the banner appears after a write and clears after a successful
  restart; a failed restart keeps the banner and shows the error; empty state.
- **`src/components/app-detail.test.tsx`** — tab switching reveals each panel and
  hides the others; the existing deployment/log and stop/start/delete assertions
  move to their new tabs.
- **`src/components/app-settings.test.tsx`** — read-only rows render their
  values with no controls; domain add/remove call their callbacks; danger-zone
  delete still requires the typed name.

## Delivery

Two PRs, so the env work doesn't wait on the rest:

1. Transport + session fns + tab shell + the env tab (the point of the slice).
2. The settings tab and overview tab, which relocate existing behaviour.

## Layering check

`relay.ts` (transport) → `fns.ts` (session + redirects) → route loader →
components (props and callbacks only). `app-env.tsx` and `app-settings.tsx`
import no server functions, so both are directly testable with fakes. Nothing
imports up.

## Follow-ups

- **piper** — `updated_at` on `app_env`, exposed in the env payload, so the
  `updated` column can come back.
- **piper** — app config updates (container port, tracked branch, repo unlink)
  and an autodeploy flag, so the settings rows can become editable.
- **dashboard** — bulk `.env` paste import.
- **dashboard** — deep-linkable tabs (`?tab=`), if cross-screen links into a
  specific tab appear.
