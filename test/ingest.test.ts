import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { ingest } from "../src/ingest.js";
import { loadStore } from "../src/store.js";
import { DEMO_CORPUS, splitLines } from "../src/util.js";

test("ingest demo-corpus produces chunks whose spans match file contents", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "citekit-ingest-"));
  try {
    const result = await ingest({
      root: DEMO_CORPUS,
      outDir,
      embed: false,
      quiet: true,
    });
    assert.ok(result.documents >= 8, "expected the bundled markdown corpus");
    assert.ok(result.chunks > result.documents, "heading/code chunking should split files");
    assert.equal(result.hybrid, false);

    const store = await loadStore(outDir);
    assert.equal(store.chunks.length, result.chunks);

    for (const chunk of store.chunks) {
      assert.ok(chunk.startLine >= 1, chunk.path);
      assert.ok(chunk.endLine >= chunk.startLine, chunk.id);
      const abs = join(DEMO_CORPUS, chunk.path);
      const content = await readFile(abs, "utf8");
      const lines = splitLines(content);
      const slice = lines.slice(chunk.startLine - 1, chunk.endLine).join("\n");
      assert.equal(
        chunk.text,
        slice,
        `${chunk.path}:${chunk.startLine}-${chunk.endLine} does not match the file`,
      );
    }

    const argon = store.chunks.filter((chunk) => chunk.text.includes("Argon2id"));
    assert.ok(
      argon.every((chunk) => chunk.path === "02-auth.md"),
      "Argon2id must live only in 02-auth.md",
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
