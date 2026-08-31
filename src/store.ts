import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import MiniSearch from "minisearch";
import type { Chunk, LastAnswerFile, Store } from "./types.js";
import { INDEX_DIR_NAME, INDEX_FILE_NAME, LAST_ANSWER_FILE, ensureDir } from "./util.js";

export const MINISEARCH_OPTIONS = {
  fields: ["text", "path", "heading"],
  storeFields: ["path", "startLine", "endLine", "heading"],
  searchOptions: {
    boost: { text: 2, heading: 1.6, path: 0.4 },
    fuzzy: 0.15,
    prefix: true,
    combineWith: "AND" as const,
  },
};

export function createMiniSearch(): MiniSearch {
  return new MiniSearch(MINISEARCH_OPTIONS);
}

export function buildMiniSearch(chunks: Chunk[]): MiniSearch {
  const mini = createMiniSearch();
  mini.addAll(
    chunks.map((chunk) => ({
      id: chunk.id,
      text: chunk.text,
      path: chunk.path,
      heading: chunk.heading ?? "",
      startLine: chunk.startLine,
      endLine: chunk.endLine,
    })),
  );
  return mini;
}

export function loadMiniSearch(serialized: object): MiniSearch {
  return MiniSearch.loadJSON(JSON.stringify(serialized), MINISEARCH_OPTIONS);
}

export function indexDir(cwd = process.cwd()): string {
  return join(resolve(cwd), INDEX_DIR_NAME);
}

export function indexPath(dir: string): string {
  return join(dir, INDEX_FILE_NAME);
}

export function lastAnswerPath(dir: string): string {
  return join(dir, LAST_ANSWER_FILE);
}

export async function findIndexDir(start = process.cwd()): Promise<string | null> {
  let current = resolve(start);
  for (;;) {
    try {
      await readFile(indexPath(join(current, INDEX_DIR_NAME)), "utf8");
      return join(current, INDEX_DIR_NAME);
    } catch {
      const parent = dirname(current);
      if (parent === current) return null;
      current = parent;
    }
  }
}

export async function requireIndexDir(explicit?: string): Promise<string> {
  if (explicit) return resolve(explicit);
  const found = await findIndexDir();
  if (!found) {
    throw new Error(
      "No CiteKit index found. Run `citekit ingest <dir>` first (looks for .citekit/index.json).",
    );
  }
  return found;
}

export async function saveStore(dir: string, store: Store): Promise<string> {
  await ensureDir(dir);
  const file = indexPath(dir);
  await writeFile(file, `${JSON.stringify(store)}\n`, "utf8");
  return file;
}

export async function loadStore(dir: string): Promise<Store> {
  const raw = await readFile(indexPath(dir), "utf8");
  const store = JSON.parse(raw) as Store;
  if (store.meta?.version !== 1 || !Array.isArray(store.chunks)) {
    throw new Error(`Unrecognized CiteKit index at ${indexPath(dir)}`);
  }
  return store;
}

export async function saveLastAnswer(dir: string, payload: LastAnswerFile): Promise<string> {
  await ensureDir(dir);
  const file = lastAnswerPath(dir);
  await writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return file;
}

export async function loadLastAnswer(dir: string): Promise<LastAnswerFile> {
  const raw = await readFile(lastAnswerPath(dir), "utf8");
  return JSON.parse(raw) as LastAnswerFile;
}
