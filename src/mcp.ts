import { ask } from "./ask.js";
import { ingest } from "./ingest.js";
import { retrieve } from "./retrieve.js";
import { indexDir, loadStore, requireIndexDir, saveLastAnswer } from "./store.js";
import { VERSION } from "./util.js";

type JsonRpc = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
};

function writeMessage(message: unknown): void {
  const body = JSON.stringify(message);
  const header = `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n`;
  process.stdout.write(header + body);
}

function ok(id: string | number | null | undefined, result: unknown): void {
  writeMessage({ jsonrpc: "2.0", id: id ?? null, result });
}

function fail(id: string | number | null | undefined, code: number, message: string): void {
  writeMessage({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

const TOOLS = [
  {
    name: "citekit_ingest",
    description:
      "Walk a local folder and build a CiteKit index of chunks with exact path + start/end line spans.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory to ingest" },
        outDir: { type: "string", description: "Index directory (default .citekit)" },
      },
      required: ["path"],
    },
  },
  {
    name: "citekit_search",
    description:
      "BM25 search over the CiteKit index. Returns chunks with path, startLine, endLine, text, and score.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        k: { type: "number", description: "Max hits (default 8)" },
      },
      required: ["query"],
    },
  },
  {
    name: "citekit_ask",
    description:
      "Answer a question using retrieved quotes only. Every claim is cited as path:start-end. Refuses when retrieval is weak.",
    inputSchema: {
      type: "object",
      properties: {
        question: { type: "string" },
        mode: { type: "string", enum: ["extractive", "generate"] },
        k: { type: "number" },
      },
      required: ["question"],
    },
  },
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function toolResult(data: unknown) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (name === "citekit_ingest") {
    const path = String(args.path ?? "");
    if (!path) throw new Error("path is required");
    const out = typeof args.outDir === "string" ? args.outDir : indexDir();
    const result = await ingest({ root: path, outDir: out });
    return toolResult(result);
  }
  if (name === "citekit_search") {
    const query = String(args.query ?? "");
    if (!query) throw new Error("query is required");
    const dir = await requireIndexDir();
    const store = await loadStore(dir);
    const hits = await retrieve(store, query, { k: Number(args.k ?? 8) });
    return toolResult({
      query,
      hits: hits.map((hit) => ({
        path: hit.chunk.path,
        startLine: hit.chunk.startLine,
        endLine: hit.chunk.endLine,
        heading: hit.chunk.heading,
        text: hit.chunk.text,
        score: hit.score,
        citation: `${hit.chunk.path}:${hit.chunk.startLine}-${hit.chunk.endLine}`,
      })),
    });
  }
  if (name === "citekit_ask") {
    const question = String(args.question ?? "");
    if (!question) throw new Error("question is required");
    const dir = await requireIndexDir();
    const store = await loadStore(dir);
    const result = await ask(store, question, {
      mode: args.mode === "generate" ? "generate" : "extractive",
      k: typeof args.k === "number" ? args.k : 6,
    });
    await saveLastAnswer(dir, {
      generatedAt: new Date().toISOString(),
      indexRoot: store.meta.root,
      documentCount: store.meta.documentCount,
      chunkCount: store.meta.chunkCount,
      sessions: [result],
    });
    return toolResult({
      ...result,
      citations: result.citations.map((citation) => ({
        path: citation.path,
        startLine: citation.startLine,
        endLine: citation.endLine,
        heading: citation.heading,
        quote: citation.quote,
        citation: `${citation.path}:${citation.startLine}-${citation.endLine}`,
      })),
    });
  }
  throw new Error(`Unknown tool: ${name}`);
}

async function handle(message: JsonRpc): Promise<void> {
  const { id, method } = message;
  if (!method) return;
  if (method === "initialize") {
    ok(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "citekit", version: VERSION },
    });
    return;
  }
  if (method === "notifications/initialized" || method.startsWith("notifications/")) return;
  if (method === "ping") {
    ok(id, {});
    return;
  }
  if (method === "tools/list") {
    ok(id, { tools: TOOLS });
    return;
  }
  if (method === "tools/call") {
    const params = asRecord(message.params);
    const name = String(params.name ?? "");
    const args = asRecord(params.arguments);
    try {
      const result = await callTool(name, args);
      ok(id, result);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      ok(id, {
        content: [{ type: "text", text }],
        isError: true,
      });
    }
    return;
  }
  fail(id, -32601, `Method not found: ${method}`);
}

async function readLoop(): Promise<void> {
  let buf = Buffer.alloc(0);
  let busy = false;

  async function drain(): Promise<void> {
    if (busy) return;
    busy = true;
    try {
      while (true) {
        const headerEnd = buf.indexOf("\r\n\r\n");
        if (headerEnd !== -1) {
          const header = buf.subarray(0, headerEnd).toString("utf8");
          const match = /Content-Length:\s*(\d+)/i.exec(header);
          if (!match) {
            buf = buf.subarray(headerEnd + 4);
            continue;
          }
          const len = Number(match[1]);
          const start = headerEnd + 4;
          if (buf.length < start + len) return;
          const body = buf.subarray(start, start + len).toString("utf8");
          buf = buf.subarray(start + len);
          await handle(JSON.parse(body) as JsonRpc);
          continue;
        }
        const nl = buf.indexOf("\n");
        if (nl === -1) return;
        const line = buf.subarray(0, nl).toString("utf8").trim();
        buf = buf.subarray(nl + 1);
        if (!line.startsWith("{")) continue;
        await handle(JSON.parse(line) as JsonRpc);
      }
    } finally {
      busy = false;
    }
  }

  process.stdin.on("data", (chunk: string | Buffer) => {
    buf = Buffer.concat([buf, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
    void drain();
  });
}

export async function startMcpServer(): Promise<void> {
  process.stdin.resume();
  await readLoop();
}
