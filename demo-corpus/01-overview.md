# Lumen Notes

Lumen Notes is a local-first notebook for small teams. Each workspace stores
plain-text notes, optional attachments, and a retrieval index used by the
assistant. The product is fictional and exists so CiteKit can demonstrate
cited answers.

## What ships

The core loop is write → index → ask. Authors keep notes in Markdown. The
assistant may only answer from indexed notes. If a question is not supported
by a retrieved span, the assistant must refuse.

Lumen Notes is not a generic chatbot. It is a notebook with a citation-first
retrieval pipeline described in `06-rag-pipeline.md`.

## Plans at a glance

The marketing site currently says the Free plan includes 100 notes per
workspace. Billing engineering documents a different cap — read both
`01-overview.md` and `04-billing.md` before answering plan-limit questions.

Private notes stay on the device that created them. Workspace notes sync
through the Lumen relay after the owner accepts the workspace invite.
