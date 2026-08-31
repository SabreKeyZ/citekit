import { chatComplete, generateEnabled } from "./llm.js";
import { confidenceOf, isConflict, retrieve, selectEvidence, shouldRefuse } from "./retrieve.js";
import type { AskMode, AskResult, Citation, SearchHit, Store } from "./types.js";
import { citationKey } from "./util.js";

export type AskOptions = {
  mode?: AskMode;
  k?: number;
  hybrid?: boolean;
};

function toCitation(hit: SearchHit): Citation {
  return {
    path: hit.chunk.path,
    startLine: hit.chunk.startLine,
    endLine: hit.chunk.endLine,
    quote: hit.chunk.text,
    heading: hit.chunk.heading,
    score: hit.score,
  };
}

function quoteBlock(citation: Citation): string {
  const clipped = citation.quote
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
  const body = clipped
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
  return `${body}\n${citationKey(citation.path, citation.startLine, citation.endLine)}`;
}

export function extractiveAnswer(question: string, hits: SearchHit[]): string {
  const citations = hits.map(toCitation);
  const conflict = isConflict(hits);
  const lines: string[] = [];
  lines.push(`CiteKit extractive answer for: ${question}`);
  lines.push("");
  if (conflict) {
    lines.push(
      "Sources disagree. Both sides are quoted below — CiteKit will not pick a winner.",
    );
    lines.push("");
  }
  citations.forEach((citation, index) => {
    const heading = citation.heading ? ` (${citation.heading})` : "";
    lines.push(`${index + 1}. ${citation.path}${heading}`);
    lines.push(quoteBlock(citation));
    lines.push("");
  });
  return lines.join("\n").trim() + "\n";
}

function refuseResult(
  question: string,
  mode: AskMode,
  hits: SearchHit[],
  confidence: number,
): AskResult {
  return {
    question,
    mode,
    refused: true,
    reason:
      "Retrieval is too weak. No passage has enough overlapping evidence to support a cited answer.",
    answer:
      "CiteKit refused to answer. Retrieval is too weak to support a cited claim — the corpus has no sufficiently relevant passage. Ingest more sources or rephrase the question.",
    citations: [],
    confidence,
    retrieved: hits.length,
  };
}

function generatePrompt(question: string, hits: SearchHit[]): { system: string; user: string } {
  const quotes = hits
    .map((hit, i) => {
      const key = citationKey(hit.chunk.path, hit.chunk.startLine, hit.chunk.endLine);
      return `[${i + 1}] ${key}\n"""\n${hit.chunk.text}\n"""`;
    })
    .join("\n\n");
  return {
    system:
      "You are CiteKit. You may use ONLY the numbered quotes. Every sentence must end with a citation like path:start-end copied from a quote header. If quotes conflict, report both sides. If they are insufficient, say you cannot answer. Never invent facts, files, or line numbers.",
    user: `Question: ${question}\n\nQuotes:\n${quotes}\n\nWrite a short cited answer.`,
  };
}

export async function ask(store: Store, question: string, options: AskOptions = {}): Promise<AskResult> {
  const requested = options.mode ?? "extractive";
  const mode: AskMode = requested === "generate" && generateEnabled() ? "generate" : "extractive";
  const hits = await retrieve(store, question, { k: options.k ?? 8, hybrid: options.hybrid });
  const used = selectEvidence(hits);
  const confidence = confidenceOf(used);

  if (shouldRefuse(used, confidence)) {
    return refuseResult(question, mode, hits, confidence);
  }

  if (mode === "generate") {
    const prompt = generatePrompt(question, used);
    const answer = await chatComplete([
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ]);
    return {
      question,
      mode,
      refused: false,
      answer: `${answer}\n`,
      citations: used.map(toCitation),
      confidence,
      retrieved: hits.length,
    };
  }

  return {
    question,
    mode: "extractive",
    refused: false,
    answer: extractiveAnswer(question, used),
    citations: used.map(toCitation),
    confidence,
    retrieved: hits.length,
  };
}
