# HTTP API

The Lumen relay exposes a small JSON API. All routes require a
`lumen_session` cookie or a bearer token minted from that session.

## Notes

`GET /v1/notes` lists workspace notes the caller can read.
`POST /v1/notes` creates a note. Free workspaces receive `402` when the
50-note billing cap is exceeded.
`GET /v1/notes/:id` returns the Markdown body and the current visibility.

## Ask

`POST /v1/ask` accepts `{ "question": "..." }` and returns an extractive
answer plus an array of citations. Each citation includes `path`,
`startLine`, `endLine`, and `quote`. A weak retrieval result returns HTTP
409 with `"refused": true`.

## Billing portal

`GET /v1/billing` returns the plan name and note cap. This endpoint reads
from billing, so Free is reported as 50 notes even when marketing still
says 100.
