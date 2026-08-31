# Session policy

This note is the security team's rewrite of session lifetime. It intentionally
disagrees with `02-auth.md`.

## Lifetime

Active sessions remain valid for 7 days, even if the user is idle. The
`lumen_session` cookie is persistent. Idle timeout is not applied. A user who
logs in on Monday morning is still signed in the following Sunday evening
without touching the app.

The authentication service still documents a 24-hour inactivity timeout.
Until the two teams merge the documents, both statements exist in the corpus.

## Revocation

Admins can revoke a session from the workspace audit log. Revocation is
immediate for API requests and takes effect on the next page load for the
web client.

## Device list

Each session records a device label, IP city, and last-seen timestamp. Users
can end other devices from Settings → Sessions.
