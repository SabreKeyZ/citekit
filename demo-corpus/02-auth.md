# Authentication

Lumen Notes treats login as a local credential check plus a signed session.

## Password hashing

Passwords are hashed with Argon2id (memory 64 MiB, 3 iterations, parallelism 1)
before they are stored. The plaintext password never appears in logs, backups,
or the retrieval index. A failed login increments a per-account cooldown.

This is the only document that names the password hashing algorithm. Other
files may mention "hashed passwords" but they do not name Argon2id.

## Session cookies after login

A session cookie named `lumen_session` is issued after a successful login.
According to the authentication service, sessions expire after 24 hours of
inactivity. Sliding renewal happens on each authenticated request while the
session is still valid.

If you are asked how long a session lasts, this file says **24 hours of
inactivity**. The session-policy note in `03-sessions.md` disagrees. Quote
both. Do not silently pick one.

## Recovery

Account recovery uses a one-time code emailed to the verified address. Recovery
codes expire in 20 minutes and can be used once.
