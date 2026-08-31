import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const tsxCli = require.resolve("tsx/cli");
const cli = join(here, "..", "src", "cli.ts");

function rpc(method: string, id: number, params?: unknown): Buffer {
  const body = JSON.stringify({ jsonrpc: "2.0", id, method, params });
  return Buffer.from(`Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`);
}

test("MCP stdio lists citekit tools", async () => {
  const child = spawn(process.execPath, [tsxCli, cli, "mcp"], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  const chunks: Buffer[] = [];
  child.stdout.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  child.stdin.write(
    rpc("initialize", 1, {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test", version: "0" },
    }),
  );
  child.stdin.write(rpc("tools/list", 2));

  const text = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`MCP timed out. stderr=${child.stderr.read() ?? ""}`));
    }, 4000);
    const check = () => {
      const out = Buffer.concat(chunks).toString("utf8");
      if (out.includes("citekit_ingest") && out.includes("citekit_ask")) {
        clearTimeout(timer);
        child.kill("SIGTERM");
        resolve(out);
      }
    };
    child.stdout.on("data", check);
  });

  assert.match(text, /citekit_ingest/);
  assert.match(text, /citekit_search/);
  assert.match(text, /citekit_ask/);
  assert.match(text, /"name":"citekit"/);
});
