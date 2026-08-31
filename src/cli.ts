#!/usr/bin/env node
import { resolve } from "node:path";
import { ask } from "./ask.js";
import { writeBoard } from "./board.js";
import { runDemo } from "./demo.js";
import { runDoctor } from "./doctor.js";
import { ingest } from "./ingest.js";
import { startMcpServer } from "./mcp.js";
import { retrieve } from "./retrieve.js";
import { printSkill } from "./skill.js";
import {
  indexDir,
  loadLastAnswer,
  loadStore,
  requireIndexDir,
  saveLastAnswer,
} from "./store.js";
import type { AskMode } from "./types.js";
import { VERSION, citationKey, parseArgs, style } from "./util.js";

function help(): string {
  return `
${style.gold("CiteKit")}  citation-first RAG for coding agents  v${VERSION}

Usage
  citekit <command> [options]

Commands
  demo                 Ingest the bundled corpus, ask 3 questions, write evidence HTML
  doctor               Check Node, write access, and optional LLM keys
  ingest <dir>         Walk a folder and build .citekit/index
  ask <question>       Answer using retrieved quotes only
  search <query>       Ranked chunks with path:start-end
  board                Write a self-contained evidence.html
  mcp                  Start the stdio MCP server
  skill                Print Agent Skill install instructions
  help                 Show this help

Options
  --out <dir>          Index directory (default .citekit)
  --mode extractive|generate
  --k <n>              Retrieval depth
  --json               Machine-readable output
  --install            For skill: copy SKILL.md into Cursor/Claude paths
  --no-embed           Skip optional embeddings during ingest

Examples
  npx citekit demo
  npx citekit ingest ./docs
  npx citekit ask "How does auth work?"
  npx citekit board
`.trim();
}

function printAsk(result: Awaited<ReturnType<typeof ask>>, asJson: boolean): void {
  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (result.refused) {
    console.log(style.rose(result.answer));
    return;
  }
  console.log(result.answer.trimEnd());
  console.log("");
  console.log(style.dim(`confidence ${Math.round(result.confidence * 100)}% · ${result.mode}`));
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const { command, positionals, flags } = parseArgs(argv);
  const json = Boolean(flags.json);
  const outDir =
    typeof flags.out === "string"
      ? resolve(flags.out)
      : command === "ingest"
        ? indexDir()
        : undefined;

  if (!command || command === "help" || flags.help || flags.h) {
    console.log(help());
    return;
  }
  if (command === "version" || flags.version || flags.v) {
    console.log(VERSION);
    return;
  }

  if (command === "demo") {
    const result = await runDemo(process.cwd());
    process.exitCode = result.exitCode;
    return;
  }
  if (command === "doctor") {
    await runDoctor(process.cwd());
    return;
  }
  if (command === "skill") {
    await printSkill(Boolean(flags.install));
    return;
  }
  if (command === "mcp") {
    await startMcpServer();
    return;
  }
  if (command === "ingest") {
    const dir = positionals[0];
    if (!dir) {
      console.error("Usage: citekit ingest <dir>");
      process.exitCode = 1;
      return;
    }
    const result = await ingest({
      root: dir,
      outDir: outDir ?? indexDir(),
      embed: flags["no-embed"] ? false : undefined,
    });
    if (json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log(
      style.green(
        `ingested ${result.documents} documents → ${result.chunks} chunks${result.hybrid ? " (hybrid)" : ""}`,
      ),
    );
    console.log(style.dim(result.indexFile));
    return;
  }
  if (command === "ask") {
    const question = positionals.join(" ").trim();
    if (!question) {
      console.error('Usage: citekit ask "your question"');
      process.exitCode = 1;
      return;
    }
    const dir = await requireIndexDir(typeof flags.out === "string" ? flags.out : undefined);
    const store = await loadStore(dir);
    const mode = flags.mode === "generate" ? "generate" : "extractive";
    const result = await ask(store, question, {
      mode: mode as AskMode,
      k: flags.k ? Number(flags.k) : 6,
    });
    await saveLastAnswer(dir, {
      generatedAt: new Date().toISOString(),
      indexRoot: store.meta.root,
      documentCount: store.meta.documentCount,
      chunkCount: store.meta.chunkCount,
      sessions: [result],
    });
    printAsk(result, json);
    if (result.refused) process.exitCode = 2;
    return;
  }
  if (command === "search") {
    const query = positionals.join(" ").trim();
    if (!query) {
      console.error('Usage: citekit search "query"');
      process.exitCode = 1;
      return;
    }
    const dir = await requireIndexDir(typeof flags.out === "string" ? flags.out : undefined);
    const store = await loadStore(dir);
    const hits = await retrieve(store, query, { k: flags.k ? Number(flags.k) : 8 });
    if (json) {
      console.log(JSON.stringify(hits, null, 2));
      return;
    }
    if (hits.length === 0) {
      console.log(style.dim("No chunks matched."));
      return;
    }
    for (const hit of hits) {
      const key = citationKey(hit.chunk.path, hit.chunk.startLine, hit.chunk.endLine);
      console.log(`${style.gold(key)}  ${style.dim(hit.score.toFixed(2))}`);
      const preview = hit.chunk.text.replace(/\s+/g, " ").slice(0, 160);
      console.log(`  ${preview}${hit.chunk.text.length > 160 ? "…" : ""}`);
    }
    return;
  }
  if (command === "board") {
    const dir = await requireIndexDir(typeof flags.out === "string" ? flags.out : undefined);
    let payload;
    try {
      payload = await loadLastAnswer(dir);
    } catch {
      console.error("No last answer found. Run `citekit ask` or `citekit demo` first.");
      process.exitCode = 1;
      return;
    }
    const dest =
      typeof flags.file === "string"
        ? resolve(flags.file)
        : resolve(process.cwd(), "evidence.html");
    const file = await writeBoard(payload, dest);
    console.log(style.green(file));
    return;
  }

  console.error(`Unknown command: ${command}`);
  console.error(help());
  process.exitCode = 1;
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(style.red(message));
  process.exitCode = 1;
});
