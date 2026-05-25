# Viewer Deployment

## Purpose
The harness viewer is a small read-only HTML surface for internet-facing observation. It is separate from the private JSON automation APIs used by workers, submitters, and admin tooling.

## Public exposure rule
Only these paths should be exposed publicly behind an HTTPS reverse proxy:
- `/viewer`
- `/viewer/*`
- `/health`

Do not expose these private automation routes publicly:
- `/alphas`
- `/alphas/*`
- `/queue/request`
- `/admin/*`

## Authentication
Configure Basic Auth credentials for the viewer with environment variables:
- `HARNESS_VIEWER_USERNAME`
- `HARNESS_VIEWER_PASSWORD`

If either variable is missing, the viewer stays unavailable.

## Reverse proxy guidance
- terminate TLS at the reverse proxy
- forward only `GET /viewer*` and `GET /health` from the public internet
- restrict all write/admin/worker JSON routes to private network callers
- keep the harness server on a private bind address or private network when possible
- avoid caching viewer pages because they contain live operational state

## Notes
The viewer intentionally omits private lease and worker identity fields and does not expose raw failure messages.
