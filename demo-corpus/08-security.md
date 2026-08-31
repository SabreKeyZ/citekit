# Security

Lumen Notes aims for boring security. Secrets stay out of the retrieval
index. Session cookies are `HttpOnly` and `Secure`.

## Audit log

The workspace audit log records logins, revocations, plan changes, and
ingest jobs. Team plan customers can export the last 90 days.

## Session debate

Security signed off on the 7-day persistent session described in
`03-sessions.md`. Engineering still ships the 24-hour inactivity timeout
in `02-auth.md`. This file does not resolve the debate. It only records
that two written policies exist.

## Index hygiene

Ingest skips `node_modules`, `.git`, and `dist`. Files larger than 1.5 MB
are skipped. Hashed passwords and recovery codes are not valid note
content and must never be pasted into a notebook that will be indexed.
