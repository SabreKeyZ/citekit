import { extname } from "node:path";
import type { Chunk } from "./types.js";
import { posixPath, sha256, splitLines } from "./util.js";

export type ChunkDraft = {
  path: string;
  startLine: number;
  endLine: number;
  text: string;
  heading?: string;
  ext: string;
};

const WINDOW = 40;
const STEP = 30;
const MAX_SECTION = 50;

function draftToChunk(draft: ChunkDraft): Chunk {
  const hash = sha256(
    `${draft.path}\0${draft.startLine}\0${draft.endLine}\0${draft.text}`,
  );
  return {
    id: hash.slice(0, 16),
    path: draft.path,
    startLine: draft.startLine,
    endLine: draft.endLine,
    text: draft.text,
    hash,
    heading: draft.heading,
    ext: draft.ext,
  };
}

function sliceLines(lines: string[], start: number, end: number): string {
  return lines.slice(start, end + 1).join("\n");
}

function isBlank(text: string): boolean {
  return text.trim().length === 0;
}

function windowRange(
  path: string,
  lines: string[],
  from: number,
  to: number,
  ext: string,
  heading?: string,
): ChunkDraft[] {
  const drafts: ChunkDraft[] = [];
  for (let start = from; start <= to; start += STEP) {
    const end = Math.min(to, start + WINDOW - 1);
    const text = sliceLines(lines, start, end);
    if (!isBlank(text)) {
      drafts.push({
        path,
        startLine: start + 1,
        endLine: end + 1,
        text,
        heading,
        ext,
      });
    }
    if (end === to) break;
  }
  return drafts;
}

function slidingWindow(path: string, lines: string[], ext: string, heading?: string): ChunkDraft[] {
  if (lines.length === 0 || lines.every((line) => isBlank(line))) return [];
  if (lines.length <= WINDOW) {
    const last = lines.length - 1;
    return [
      {
        path,
        startLine: 1,
        endLine: last + 1,
        text: sliceLines(lines, 0, last),
        heading,
        ext,
      },
    ];
  }
  return windowRange(path, lines, 0, lines.length - 1, ext, heading);
}

function headingOf(line: string): string | undefined {
  const md = /^(#{1,6})\s+(.+)$/.exec(line);
  if (md) return md[2].trim();
  const html = /^<h[1-6][^>]*>(.*?)<\/h[1-6]>/i.exec(line);
  if (html) return html[1].replace(/<[^>]+>/g, "").trim();
  return undefined;
}

export function chunkMarkdown(path: string, content: string): ChunkDraft[] {
  const lines = splitLines(content);
  const ext = ".md";
  const headingRe = /^(#{1,6})\s+\S/;
  const starts: number[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (headingRe.test(lines[i])) starts.push(i);
  }
  if (starts.length === 0) return slidingWindow(path, lines, ext);

  const ranges: Array<{ start: number; end: number; heading?: string }> = [];
  if (starts[0] > 0) {
    ranges.push({ start: 0, end: starts[0] - 1, heading: undefined });
  }
  for (let i = 0; i < starts.length; i += 1) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] - 1 : lines.length - 1;
    ranges.push({ start, end, heading: headingOf(lines[start]) });
  }

  const drafts: ChunkDraft[] = [];
  for (const range of ranges) {
    const text = sliceLines(lines, range.start, range.end);
    if (isBlank(text)) continue;
    const size = range.end - range.start + 1;
    if (size > MAX_SECTION) {
      drafts.push(
        ...windowRange(path, lines, range.start, range.end, ext, range.heading),
      );
    } else {
      drafts.push({
        path,
        startLine: range.start + 1,
        endLine: range.end + 1,
        text,
        heading: range.heading,
        ext,
      });
    }
  }
  return drafts;
}

const CODE_START: Record<string, RegExp> = {
  ".ts":
    /^(export\s+)?(default\s+)?(async\s+)?(function\s+\w+|class\s+\w+|interface\s+\w+|type\s+\w+|const\s+\w+\s*=\s*(async\s*)?\()/,
  ".js":
    /^(export\s+)?(default\s+)?(async\s+)?(function\s+\w+|class\s+\w+|const\s+\w+\s*=\s*(async\s*)?\()/,
  ".py": /^(async\s+)?def\s+\w+|class\s+\w+/,
  ".go": /^func\s+|^type\s+\w+\s+(struct|interface)/,
  ".rs": /^(pub\s+)?(async\s+)?fn\s+\w+|^(pub\s+)?struct\s+\w+|^(pub\s+)?enum\s+\w+|^impl\b/,
};

export function chunkCode(path: string, content: string, ext: string): ChunkDraft[] {
  const lines = splitLines(content);
  const startRe = CODE_START[ext];
  if (!startRe) return slidingWindow(path, lines, ext);

  const starts: number[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (startRe.test(lines[i])) starts.push(i);
  }
  if (starts.length === 0) return slidingWindow(path, lines, ext);

  const drafts: ChunkDraft[] = [];
  if (starts[0] > 0) {
    const text = sliceLines(lines, 0, starts[0] - 1);
    if (!isBlank(text)) {
      drafts.push({
        path,
        startLine: 1,
        endLine: starts[0],
        text,
        heading: "preamble",
        ext,
      });
    }
  }
  for (let i = 0; i < starts.length; i += 1) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] - 1 : lines.length - 1;
    const text = sliceLines(lines, start, end);
    if (isBlank(text)) continue;
    const heading = lines[start].trim().slice(0, 80);
    if (end - start + 1 > MAX_SECTION) {
      drafts.push(...windowRange(path, lines, start, end, ext, heading));
    } else {
      drafts.push({
        path,
        startLine: start + 1,
        endLine: end + 1,
        text,
        heading,
        ext,
      });
    }
  }
  return drafts;
}

export function chunkHtml(path: string, content: string): ChunkDraft[] {
  const lines = splitLines(content);
  const starts: number[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (/<h[1-6]\b/i.test(lines[i])) starts.push(i);
  }
  if (starts.length === 0) return slidingWindow(path, lines, ".html");
  return chunkByStarts(path, lines, starts, ".html");
}

function chunkByStarts(
  path: string,
  lines: string[],
  starts: number[],
  ext: string,
): ChunkDraft[] {
  const drafts: ChunkDraft[] = [];
  if (starts[0] > 0) {
    const text = sliceLines(lines, 0, starts[0] - 1);
    if (!isBlank(text)) {
      drafts.push({ path, startLine: 1, endLine: starts[0], text, ext });
    }
  }
  for (let i = 0; i < starts.length; i += 1) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] - 1 : lines.length - 1;
    const text = sliceLines(lines, start, end);
    if (isBlank(text)) continue;
    drafts.push({
      path,
      startLine: start + 1,
      endLine: end + 1,
      text,
      heading: headingOf(lines[start]),
      ext,
    });
  }
  return drafts;
}

export function chunkFile(relativePath: string, content: string): Chunk[] {
  const path = posixPath(relativePath);
  const ext = extname(path).toLowerCase();
  let drafts: ChunkDraft[];
  if (ext === ".md") drafts = chunkMarkdown(path, content);
  else if (ext === ".html") drafts = chunkHtml(path, content);
  else if (CODE_START[ext]) drafts = chunkCode(path, content, ext);
  else drafts = slidingWindow(path, splitLines(content), ext);
  return drafts.map(draftToChunk);
}
