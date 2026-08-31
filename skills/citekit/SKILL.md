---
name: citekit
description: Citation-first RAG for local docs and code. Ingest a folder, search with exact path:line spans, and refuse when evidence is weak. Use before answering questions about this repository or any ingested corpus.
---

# CiteKit

You are working in a repo that can be indexed by CiteKit. Do not answer questions about local docs or code from memory.

## Required loop

1. If `.citekit/index.json` is missing, ingest first:
   - CLI: `npx citekit ingest .`
   - MCP: `citekit_ingest` with `{ "path": "." }`
2. Search before you speak:
   - MCP: `citekit_search` with the user's question
   - or `citekit_ask` for a cited extractive answer
3. Copy citations exactly as `path:startLine-endLine`. Never invent a file or round a line number.
4. If CiteKit refuses, tell the user retrieval is too weak. Do not fill the gap with uncited claims.

## Rules

- Every claim needs a CiteKit citation. No citation, no claim.
- If two spans disagree, quote both. Do not pick a winner.
- Extractive mode is the default and works offline. Use generate mode only when the user asks and an OpenAI-compatible key is configured.
- Prefer `citekit_search` when you want raw quotes; prefer `citekit_ask` when you want a stitched cited answer.
- After a useful ask, you may run `npx citekit board` so the user gets `evidence.html`.

## MCP tools

- `citekit_ingest` — walk a directory, skip `node_modules` / `.git` / `dist`, store chunks with line spans
- `citekit_search` — BM25 (+ optional hybrid) hits with structured citations
- `citekit_ask` — extractive or generate; structured citations; refuses on weak retrieval

## What CiteKit is not

Do not treat this skill as conversation memory, a code-graph UI, or a hosted RAG studio. It is a local citation engine.
