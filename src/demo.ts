import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ask } from "./ask.js";
import { writeBoard } from "./board.js";
import { ingest } from "./ingest.js";
import { saveLastAnswer } from "./store.js";
import { DEMO_CORPUS, style } from "./util.js";

export const DEMO_QUESTIONS = [
  "What password hashing algorithm does Lumen Notes use?",
  "How long do user sessions last?",
  "How does the Lumen retrieval pipeline attach citations to answers?",
];

export async function runDemo(cwd = process.cwd()): Promise<{
  outDir: string;
  boardFile: string;
  exitCode: number;
}> {
  const outDir = resolve(cwd, "demo-out");
  const indexDir = join(outDir, ".citekit");
  await mkdir(outDir, { recursive: true });

  console.log(style.gold("CiteKit demo"));
  console.log(style.dim("Zero API keys. Extractive answers only.\n"));

  const ingested = await ingest({
    root: DEMO_CORPUS,
    outDir: indexDir,
    embed: false,
  });
  console.log(
    style.dim(
      `ingested ${ingested.documents} files → ${ingested.chunks} chunks with line spans\n`,
    ),
  );

  const { loadStore } = await import("./store.js");
  const store = await loadStore(indexDir);
  const sessions = [];
  for (const question of DEMO_QUESTIONS) {
    const result = await ask(store, question, { mode: "extractive", k: 6 });
    sessions.push(result);
    console.log(style.bold(question));
    if (result.refused) {
      console.log(style.rose(result.answer));
    } else {
      console.log(result.answer.trimEnd());
    }
    console.log("");
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    indexRoot: ingested.root,
    documentCount: ingested.documents,
    chunkCount: ingested.chunks,
    sessions,
  };
  await saveLastAnswer(indexDir, payload);
  const boardFile = await writeBoard(payload, join(outDir, "evidence.html"));
  console.log(style.green(`evidence board → ${boardFile}`));
  return { outDir, boardFile, exitCode: 0 };
}
