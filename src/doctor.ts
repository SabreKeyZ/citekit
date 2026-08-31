import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { findIndexDir } from "./store.js";
import { VERSION, canWrite, llmConfigured, openaiBaseUrl, style } from "./util.js";

type Check = { name: string; ok: boolean; detail: string };

export async function runDoctor(cwd = process.cwd()): Promise<{ ok: boolean; checks: Check[] }> {
  const major = Number(process.versions.node.split(".")[0]);
  const nodeOk = major >= 20;
  const writeOk = await canWrite(cwd);
  const index = await findIndexDir(cwd);
  const llm = llmConfigured();

  const checks: Check[] = [
    {
      name: "node",
      ok: nodeOk,
      detail: nodeOk
        ? `Node ${process.versions.node} (>=20)`
        : `Node ${process.versions.node} is too old; CiteKit needs 20+`,
    },
    {
      name: "write",
      ok: writeOk,
      detail: writeOk ? `can write in ${cwd}` : `cannot write in ${cwd}`,
    },
    {
      name: "index",
      ok: true,
      detail: index ? `found ${join(index, "index.json")}` : "no .citekit index yet (run ingest)",
    },
    {
      name: "openai",
      ok: true,
      detail: llm
        ? `optional generate/hybrid ready (${openaiBaseUrl()})`
        : "OPENAI_API_KEY / OPENAI_BASE_URL unset — extractive mode only",
    },
  ];

  console.log(style.gold(`CiteKit doctor  v${VERSION}`));
  for (const check of checks) {
    const mark = check.ok ? style.green("ok") : style.red("fail");
    console.log(`  ${mark}  ${check.name.padEnd(8)} ${style.dim(check.detail)}`);
  }

  if (writeOk) {
    const probe = join(cwd, ".citekit-doctor.tmp");
    await writeFile(probe, "ok\n");
    const { unlink } = await import("node:fs/promises");
    await unlink(probe);
  }

  const ok = checks.every((check) => check.ok);
  if (!ok) process.exitCode = 1;
  return { ok, checks };
}
