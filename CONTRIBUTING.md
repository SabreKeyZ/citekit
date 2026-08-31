# Contributing to CiteKit

Thanks for helping keep answers cited.

## Setup

```bash
git clone https://github.com/SabreKeyZ/citekit.git
cd citekit
npm install
npm test
npm run build
```

Node 20+ is required. No API key is required for tests or `npm run demo`.

## What belongs here

CiteKit is a small local CLI + MCP server + Agent Skill. Please keep it that way.

- Prefer extractive, cited answers over generated prose.
- Do not add LangChain, LlamaIndex, Playwright, or a web app.
- Persistence must stay portable (JSON + MiniSearch). Avoid native addons.
- New commands should work offline unless they are explicitly optional LLM paths.

## Tests

`npm test` must stay green. If you change chunking, retrieval, or refuse logic, update the tests in `test/` and run the demo:

```bash
npm run demo
```

Confirm `demo-out/evidence.html` still opens as a single self-contained file.

## Pull requests

- One idea per PR.
- Keep the dependency list short.
- Update the English README and the 中文 section together when behavior changes.
