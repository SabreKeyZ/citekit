import { createHash } from "node:crypto";
import { access, constants, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const DEMO_CORPUS = join(PACKAGE_ROOT, "demo-corpus");
export const SKILL_PATH = join(PACKAGE_ROOT, "skills", "citekit", "SKILL.md");
export const VERSION = "0.1.0";

export const INDEX_DIR_NAME = ".citekit";
export const INDEX_FILE_NAME = "index.json";
export const LAST_ANSWER_FILE = "last-answer.json";

export const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  ".citekit",
  "coverage",
  "demo-out",
  ".next",
  ".turbo",
  ".cache",
]);

export const INGEST_EXTENSIONS = new Set([
  ".md",
  ".txt",
  ".html",
  ".json",
  ".ts",
  ".js",
  ".py",
  ".go",
  ".rs",
]);

export const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "if",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "do",
  "does",
  "did",
  "how",
  "what",
  "when",
  "where",
  "why",
  "who",
  "which",
  "with",
  "from",
  "by",
  "into",
  "about",
  "than",
  "then",
  "that",
  "this",
  "these",
  "those",
  "it",
  "its",
  "you",
  "your",
  "we",
  "our",
  "they",
  "their",
  "can",
  "could",
  "should",
  "would",
  "may",
  "might",
  "will",
  "just",
  "not",
  "no",
  "yes",
]);

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function splitLines(content: string): string[] {
  return content.split(/\r?\n/);
}

export function posixPath(path: string): string {
  return path.replaceAll("\\", "/");
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_+.-]+/)
    .filter((token) => token.length > 1);
}

export function distinctiveTerms(query: string): string[] {
  const tokens = tokenize(query);
  const kept = tokens.filter((token) => !STOPWORDS.has(token) && token.length > 2);
  return kept.length > 0 ? unique(kept) : unique(tokens);
}

export function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function termOverlap(queryTerms: string[], text: string): number {
  if (queryTerms.length === 0) return 0;
  const lower = text.toLowerCase();
  let hits = 0;
  for (const term of queryTerms) {
    if (hasTerm(lower, term)) hits += 1;
  }
  return hits / queryTerms.length;
}

export function hasTerm(haystackLower: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9_+.-])${escaped}([^a-z0-9_+.-]|$)`, "i").test(
    haystackLower,
  );
}

export function citationKey(path: string, startLine: number, endLine: number): string {
  return `${path}:${startLine}-${endLine}`;
}

export function useColor(): boolean {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}

const ansi = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  gold: "\x1b[38;5;180m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  rose: "\x1b[38;5;168m",
};

export const style = {
  bold: (s: string) => (useColor() ? `${ansi.bold}${s}${ansi.reset}` : s),
  dim: (s: string) => (useColor() ? `${ansi.dim}${s}${ansi.reset}` : s),
  gold: (s: string) => (useColor() ? `${ansi.gold}${s}${ansi.reset}` : s),
  green: (s: string) => (useColor() ? `${ansi.green}${s}${ansi.reset}` : s),
  red: (s: string) => (useColor() ? `${ansi.red}${s}${ansi.reset}` : s),
  cyan: (s: string) => (useColor() ? `${ansi.cyan}${s}${ansi.reset}` : s),
  rose: (s: string) => (useColor() ? `${ansi.rose}${s}${ansi.reset}` : s),
};

export function llmConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY || process.env.OPENAI_BASE_URL);
}

export function openaiBaseUrl(): string {
  const raw = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  return raw.replace(/\/$/, "");
}

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function canWrite(dir: string): Promise<boolean> {
  try {
    await access(dir, constants.W_OK);
    return true;
  } catch {
    try {
      await ensureDir(dir);
      const probe = join(dir, `.citekit-write-probe-${process.pid}`);
      await writeFile(probe, "ok");
      const { unlink } = await import("node:fs/promises");
      await unlink(probe);
      return true;
    } catch {
      return false;
    }
  }
}

export function parseArgs(argv: string[]): {
  command: string | undefined;
  positionals: string[];
  flags: Record<string, string | boolean>;
} {
  const [command, ...rest] = argv;
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token === "--") {
      positionals.push(...rest.slice(i + 1));
      break;
    }
    if (token.startsWith("--")) {
      const eq = token.indexOf("=");
      if (eq !== -1) {
        flags[token.slice(2, eq)] = token.slice(eq + 1);
        continue;
      }
      const key = token.slice(2);
      const next = rest[i + 1];
      if (next && !next.startsWith("-")) {
        flags[key] = next;
        i += 1;
      } else {
        flags[key] = true;
      }
      continue;
    }
    if (token.startsWith("-") && token.length === 2) {
      const next = rest[i + 1];
      if (next && !next.startsWith("-")) {
        flags[token.slice(1)] = next;
        i += 1;
      } else {
        flags[token.slice(1)] = true;
      }
      continue;
    }
    positionals.push(token);
  }
  return { command, positionals, flags };
}
