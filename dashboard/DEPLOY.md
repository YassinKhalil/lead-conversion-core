# Deploying the dashboard web build

The dashboard is served as static files by Caddy at
`https://core.tryrolefit.com/app`, on the **same origin** as the API at
`https://core.tryrolefit.com/api/*`.

That is the whole point of the arrangement. Same origin means:

- no CORS configuration on the Fastify API,
- the existing `HttpOnly; Secure; SameSite=Lax` session cookie is sent with
  every `/api/*` request from the app with no changes,
- no session token is ever readable by browser JavaScript.

Moving the app to its own subdomain would break all three.

## Why static files rather than a container

Caddy already terminates TLS and is already the only thing listening on 443.
The build is 1.6 MB of hashed, immutable assets and one `index.html`. Serving
it with `root` + `file_server` costs no extra process, no image build, no
Compose service, and no memory on the VPS. A container would add a second
long-running service and an image rebuild to every front-end change, in
exchange for nothing.

The one thing the filesystem approach needs that a container gets for free is a
way to get files onto the box. That is `rsync` over SSH, below.

## 1. Build

From `dashboard/` on your machine:

```bash
npm ci && npm run build:web
```

Expect: a couple of minutes, ending with a summary listing one web bundle and
`Exported: dist`. The result is `dashboard/dist/`, about 1.6 MB.

`build:web` sets `EXPO_WEB_BASE_URL=/app`, which makes `app.config.js` apply
`experiments.baseUrl`. Verify the base path was applied:

```bash
grep -o 'src="[^"]*"' dist/index.html
```

Expect exactly one line, beginning `/app/_expo/static/js/web/entry-`. If it
starts with `/_expo` instead, the base path was not applied and every asset
will 404 in production — rebuild with the npm script rather than a bare
`expo export`.

`dist/` is gitignored on purpose. The build is an artefact, not source.

## 2. Ship the files

Releases are timestamped and switched by symlink, so a partial upload never
serves a broken app and a rollback is one command.

From `dashboard/` on your machine:

```bash
RELEASE=$(date -u +%Y%m%d-%H%M%S)
rsync -avz --delete dist/ root@core.tryrolefit.com:/var/www/rolefit-dashboard/releases/"$RELEASE"/
```

Expect: a file list ending with a `sent … bytes` summary. First run also
creates the directories.

Then, on the server, point `current` at the new release:

```bash
ln -sfn /var/www/rolefit-dashboard/releases/"$RELEASE" /var/www/rolefit-dashboard/current.tmp
mv -Tf /var/www/rolefit-dashboard/current.tmp /var/www/rolefit-dashboard/current
chown -R caddy:caddy /var/www/rolefit-dashboard
chmod -R a+rX /var/www/rolefit-dashboard
```

`mv -Tf` replaces the symlink atomically, so no request ever sees a missing
`current`. No Caddy reload is needed for a release switch — `file_server`
resolves the symlink per request.

Expect: no output. Confirm with `ls -l /var/www/rolefit-dashboard/current`,
which should show an arrow to the release you just uploaded.

## 3. Caddyfile

Extend the existing `core.tryrolefit.com` block. Do not replace it. The only
change is carving out `/app/*`; everything else still reaches the API exactly
as it does today.

```caddy
core.tryrolefit.com {
    # Static dashboard. handle_path strips the /app prefix, so a request for
    # /app/_expo/... is read from <root>/_expo/... on disk. try_files sends
    # unknown paths to index.html, which is what an SPA needs for deep links
    # such as /app/leads/<uuid>.
    handle_path /app/* {
        root * /var/www/rolefit-dashboard/current
        try_files {path} /index.html
        file_server

        # Bundle filenames contain a content hash, so they can be cached hard.
        @hashed path /_expo/static/*
        header @hashed Cache-Control "public, max-age=31536000, immutable"
        header /index.html Cache-Control "no-cache"
    }

    redir /app /app/ 301

    # Everything else — /api/*, /webhooks/*, /internal/*, /health, /ready,
    # /metrics — continues to the Fastify API unchanged.
    handle {
        reverse_proxy 127.0.0.1:8084
    }
}
```

Two notes on why it is shaped this way:

- `handle` blocks are mutually exclusive, so the catch-all cannot swallow
  `/app/*`, and the API keeps receiving every other path without listing them
  individually. Nothing about the current routing changes.
- `redir /app /app/ 301` exists because `/app/*` does not match a bare `/app`.

## 4. Validate, then reload

Always validate before reloading. A reload with a bad config leaves the old
config running, but validating first turns a silent no-op into a clear error.

```bash
caddy validate --config /etc/caddy/Caddyfile
```

Expect: `Valid configuration`. If it reports an adapter error, fix it before
going further — nothing has changed yet at this point.

```bash
systemctl reload caddy
```

Expect: no output, exit status 0. `reload` is graceful; in-flight requests are
not dropped and TLS certificates are untouched.

## 5. Check it worked

```bash
curl -sI https://core.tryrolefit.com/app/ | head -1
curl -s https://core.tryrolefit.com/api/leads
curl -sI https://core.tryrolefit.com/health | head -1
```

Expect, in order:

1. `HTTP/2 200` — the app's `index.html`.
2. `{"ok":false,"error":"unauthenticated"}` — the API is still on the same
   origin and still gated. This is the check that matters: it proves the
   carve-out did not capture `/api`.
3. `HTTP/2 200` — the health route still reaches the API.

Then open `https://core.tryrolefit.com/app/` in a browser and sign in. The
network tab should show requests to `/api/auth/login` and `/api/leads` on the
same origin, with no preflight `OPTIONS` requests and no CORS errors.

## 6. Rolling back

List the releases and repoint the symlink:

```bash
ls -1 /var/www/rolefit-dashboard/releases
ln -sfn /var/www/rolefit-dashboard/releases/<previous> /var/www/rolefit-dashboard/current.tmp
mv -Tf /var/www/rolefit-dashboard/current.tmp /var/www/rolefit-dashboard/current
```

Effective immediately, no reload required. Keep the last few releases and prune
older ones when convenient.

To roll back the Caddy change itself, remove the `handle_path /app/*` and
`redir` lines so the block is just the catch-all `reverse_proxy` again, then
`caddy validate` and `systemctl reload caddy`. The API is unaffected either
way, because the API route was never modified.

## Local development is unchanged

`npm run web` still serves at `http://localhost:8081` with no base path, and
`metro.config.js` proxies `/api/*` to `https://core.tryrolefit.com` so the dev
build is same-origin too. `EXPO_WEB_BASE_URL` is set only by `build:web`, so
the dev server never sees it.

Native builds are unaffected by all of this: they call
`https://core.tryrolefit.com` directly and carry a bearer token from the device
keychain rather than a cookie.

## Kadensio's own deployment (app.kadensio.com)

The sections above describe the original deployment on `core.tryrolefit.com`, which is a separate project and is not touched by anything below. Kadensio's dashboard has its own folder and its own Caddy snippet:

| | |
|---|---|
| URL | `https://app.kadensio.com/app/` |
| Files | `/var/www/kadensio-dashboard/releases/<stamp>`, `current` is a symlink |
| Caddy | `(kadensio_dashboard)` in `/etc/caddy/sites/kadensio.caddy`, imported by `app.kadensio.com` only |
| API | the same Fastify server on `127.0.0.1:8084`, same origin, so the HttpOnly cookie keeps working |

`core.tryrolefit.com` keeps `(kadensio_app)` and `/var/www/rolefit-dashboard`. Do not change that block or folder from here.

### Release

Build from committed code with the production script, never `expo export` directly, and never with `EXPO_PUBLIC_ALLOW_PROFILE_OVERRIDE` set (that flag exists only for preview builds and would let a URL switch the vertical).

```bash
cd dashboard && docker run --rm -v "$PWD":/work -w /work -e CI=1 node:22-bookworm \
  sh -c 'npm ci && npm run build:web'
grep -o 'src="[^"]*"' dist/index.html     # must start with /app/_expo/
R=/var/www/kadensio-dashboard/releases/$(date -u +%Y%m%d-%H%M%S)
mkdir -p "$R" && cp -r dist/. "$R"/
chown -R caddy:caddy /var/www/kadensio-dashboard && chmod -R a+rX /var/www/kadensio-dashboard
ln -sfn "$R" /var/www/kadensio-dashboard/current.tmp && mv -Tf /var/www/kadensio-dashboard/current.tmp /var/www/kadensio-dashboard/current
```

No Caddy reload is needed for a release switch. To roll back, point `current` at the previous release the same way.

### Caching

The bundle name carries a content hash, so `/app/_expo/static/*` is immutable. Everything else, the HTML shell included, is `no-cache`. The old rule matched the literal path `/index.html`, but the shell is requested as `/app/` and `/app/leads`, so it was sent with no Cache-Control and a browser could keep a shell pointing at a bundle a later release had removed.

### Undoing the Caddy change

A copy of the Caddy file from before the split is in `/var/www/.kadensio-publish-state/dashboard-*/kadensio.caddy`. Restoring it and running `systemctl reload caddy` puts `app.kadensio.com` back on the shared folder.

### Which view a tenant sees

See `dashboard/src/profile/README.md`. The API sends the client's `vertical` (`real_estate`, `hospitality` or `clinic`, set by the tenant provisioning scripts) and the dashboard picks that view; a tenant with no match is real estate. Clinic tenants also get an Appointments screen.

## Analytics tag (added 2026-10-21)

`app.kadensio.com/app` is tracked by the self-hosted Umami at `/srv/umami` (first-party, cookie-free, served through `/_a/` by Caddy).
Expo's web export writes `index.html` itself, so after every export add the tag to the new release:

    /root/work/addtag.py kadensio-app /var/www/kadensio-dashboard/current/index.html
