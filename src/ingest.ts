import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import { chunkFile } from "./chunk.js";
import { embedTexts, embeddingsEnabled } from "./llm.js";
import { buildMiniSearch, saveStore } from "./store.js";
import type { Chunk, DocumentRecord, Store } from "./types.js";
import {
  INGEST_EXTENSIONS,
  SKIP_DIRS,
  ensureDir,
  posixPath,
  sha256,
  splitLines,
  style,
} from "./util.js";

const MAX_FILE_BYTES = 1_500_000;

export type IngestOptions = {
  root: string;
  outDir: string;
  embed?: boolean;
  quiet?: boolean;
};

export type IngestResult = {
  root: string;
  outDir: string;
  documents: number;
  chunks: number;
  skipped: number;
  hybrid: boolean;
  indexFile: string;
};

async function walkFiles(dir: string): Promise<string[]> {
  const found: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    if (entry.name.startsWith(".") && entry.name !== ".env.example") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await walkFiles(full)));
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = extname(entry.name).toLowerCase();
    if (INGEST_EXTENSIONS.has(ext)) found.push(full);
  }
  return found;
}

export async function ingest(options: IngestOptions): Promise<IngestResult> {
  const root = resolve(options.root);
  const outDir = resolve(options.outDir);
  await ensureDir(outDir);

  const files = (await walkFiles(root)).sort();
  const documents: DocumentRecord[] = [];
  const chunks: Chunk[] = [];
  let skipped = 0;

  for (const file of files) {
    const info = await stat(file);
    if (info.size > MAX_FILE_BYTES) {
      skipped += 1;
      if (!options.quiet) {
        console.error(style.dim(`skip (too large): ${relative(root, file)}`));
      }
      continue;
    }
    const content = await readFile(file, "utf8");
    const rel = posixPath(relative(root, file));
    const fileChunks = chunkFile(rel, content);
    chunks.push(...fileChunks);
    documents.push({
      path: rel,
      bytes: info.size,
      lineCount: splitLines(content).length,
      hash: sha256(content),
      mtimeMs: info.mtimeMs,
    });
  }

  let embeddings: Record<string, number[]> | undefined;
  let hybrid = false;
  const wantEmbed = options.embed !== false && embeddingsEnabled();
  if (wantEmbed && chunks.length > 0) {
    try {
      const vectors = await embedTexts(chunks.map((chunk) => chunk.text.slice(0, 8000)));
      embeddings = {};
      chunks.forEach((chunk, i) => {
        embeddings![chunk.id] = vectors[i];
      });
      hybrid = true;
    } catch (error) {
      if (!options.quiet) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(style.dim(`embeddings skipped: ${message}`));
      }
    }
  }

  const mini = buildMiniSearch(chunks);
  const store: Store = {
    meta: {
      version: 1,
      root,
      createdAt: new Date().toISOString(),
      documentCount: documents.length,
      chunkCount: chunks.length,
      hybrid,
    },
    documents,
    chunks,
    miniSearch: mini.toJSON() as object,
    embeddings,
  };

  const indexFile = await saveStore(outDir, store);
  return {
    root,
    outDir,
    documents: documents.length,
    chunks: chunks.length,
    skipped,
    hybrid,
    indexFile,
  };
}
