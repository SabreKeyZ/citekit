import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const require = createRequire(import.meta.url);
const tsxCli = require.resolve("tsx/cli");
const cli = join(root, "src", "cli.ts");

test("CLI demo exits 0 and writes evidence.html", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "citekit-demo-"));
  try {
    const ran = spawnSync(process.execPath, [tsxCli, cli, "demo"], {
      cwd,
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1" },
    });
    assert.equal(ran.status, 0, ran.stderr || ran.stdout);
    const htmlPath = join(cwd, "demo-out", "evidence.html");
    const html = await readFile(htmlPath, "utf8");
    assert.match(html, /CiteKit/);
    assert.match(html, /Evidence board/);
    assert.match(html, /data-theme/);
    assert.doesNotMatch(html, /cdn\./i);
    assert.match(ran.stdout, /Argon2id|02-auth\.md/);
    assert.match(ran.stdout, /evidence board/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
