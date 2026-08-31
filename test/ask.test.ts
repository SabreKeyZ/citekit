import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { ask } from "../src/ask.js";
import { ingest } from "../src/ingest.js";
import { loadStore } from "../src/store.js";
import { DEMO_CORPUS } from "../src/util.js";

async function demoStore() {
  const outDir = await mkdtemp(join(tmpdir(), "citekit-ask-"));
  await ingest({ root: DEMO_CORPUS, outDir, embed: false, quiet: true });
  return { outDir, store: await loadStore(outDir) };
}

test("unique fact cites only the auth file", async () => {
  const { outDir, store } = await demoStore();
  try {
    const result = await ask(store, "What password hashing algorithm does Lumen Notes use?");
    assert.equal(result.refused, false, result.answer);
    assert.ok(result.citations.length > 0);
    const files = new Set(result.citations.map((citation) => citation.path));
    assert.deepEqual([...files], ["02-auth.md"], `citations were ${[...files].join(", ")}`);
    assert.ok(
      result.citations.some((citation) => citation.quote.includes("Argon2id")),
      "expected the Argon2id quote",
    );
    assert.ok(result.answer.includes("02-auth.md"));
    assert.match(result.answer, /02-auth\.md:\d+-\d+/);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("conflict question surfaces both session policies", async () => {
  const { outDir, store } = await demoStore();
  try {
    const result = await ask(store, "How long do user sessions last?");
    assert.equal(result.refused, false, result.answer);
    const files = new Set(result.citations.map((citation) => citation.path));
    assert.ok(files.has("02-auth.md"), "missing 24-hour auth source");
    assert.ok(files.has("03-sessions.md"), "missing 7-day session-policy source");
    const blob = `${result.answer}\n${result.citations.map((c) => c.quote).join("\n")}`;
    assert.match(blob, /24 hours/i);
    assert.match(blob, /7 days/i);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("refuses when the corpus has no relevant text", async () => {
  const { outDir, store } = await demoStore();
  try {
    const result = await ask(
      store,
      "What is the orbital period of Kepler-452b's fictional moon Thalassa-9?",
    );
    assert.equal(result.refused, true, result.answer);
    assert.equal(result.citations.length, 0);
    assert.match(result.answer, /refused/i);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
