import { cosine, embedTexts } from "./llm.js";
import { loadMiniSearch } from "./store.js";
import type { Chunk, SearchHit, Store } from "./types.js";
import { distinctiveTerms, hasTerm, termOverlap } from "./util.js";

export function evidenceTerms(query: string, chunks: Chunk[]): string[] {
  const terms = distinctiveTerms(query);
  if (terms.length === 0 || chunks.length === 0) return terms;
  const ceiling = Math.max(2, Math.ceil(chunks.length * 0.28));
  const focused = terms.filter((term) => {
    const df = chunks.filter((chunk) =>
      hasTerm(`${chunk.heading ?? ""} ${chunk.path} ${chunk.text}`.toLowerCase(), term),
    ).length;
    return df <= ceiling;
  });
  return focused.length > 0 ? focused : terms;
}

export type RetrieveOptions = {
  k?: number;
  hybrid?: boolean;
};

function byId(store: Store): Map<string, Store["chunks"][number]> {
  return new Map(store.chunks.map((chunk) => [chunk.id, chunk]));
}

function normalize(scores: number[]): number[] {
  const max = Math.max(...scores, 1e-9);
  const min = Math.min(...scores, 0);
  const span = max - min || 1;
  return scores.map((score) => (score - min) / span);
}

export async function retrieve(
  store: Store,
  query: string,
  options: RetrieveOptions = {},
): Promise<SearchHit[]> {
  const k = options.k ?? 8;
  const mini = loadMiniSearch(store.miniSearch);
  const chunksById = byId(store);
  const terms = evidenceTerms(query, store.chunks);

  const andHits = mini.search(query, { combineWith: "AND" });
  const rawHits = andHits.length > 0 ? andHits : mini.search(query, { combineWith: "OR" });

  const lexical: SearchHit[] = [];
  for (const hit of rawHits) {
    const chunk = chunksById.get(String(hit.id));
    if (!chunk) continue;
    const overlap = termOverlap(terms, `${chunk.heading ?? ""} ${chunk.path} ${chunk.text}`);
    lexical.push({
      chunk,
      score: hit.score * (1 + overlap),
      termOverlap: overlap,
    });
  }

  let ranked = lexical;

  const canHybrid =
    options.hybrid !== false &&
    Boolean(store.embeddings) &&
    Object.keys(store.embeddings ?? {}).length > 0;

  if (canHybrid) {
    try {
      const [queryVec] = await embedTexts([query]);
      const dense = store.chunks
        .map((chunk) => {
          const vec = store.embeddings?.[chunk.id];
          if (!vec) return null;
          const overlap = termOverlap(terms, `${chunk.heading ?? ""} ${chunk.path} ${chunk.text}`);
          return {
            chunk,
            cosine: cosine(queryVec, vec),
            termOverlap: overlap,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);

      const lexNorm = new Map(
        lexical.map((hit, i) => [hit.chunk.id, normalize(lexical.map((h) => h.score))[i]]),
      );
      const denseNorm = new Map(
        dense.map((hit, i) => [hit.chunk.id, normalize(dense.map((h) => h.cosine))[i]]),
      );

      const ids = new Set([...lexNorm.keys(), ...denseNorm.keys()]);
      ranked = [...ids].map((id) => {
        const chunk = chunksById.get(id);
        if (!chunk) return null;
        const overlap = termOverlap(terms, `${chunk.heading ?? ""} ${chunk.path} ${chunk.text}`);
        const fused = 0.6 * (lexNorm.get(id) ?? 0) + 0.4 * (denseNorm.get(id) ?? 0);
        return {
          chunk,
          score: fused * (1 + overlap),
          termOverlap: overlap,
        };
      }).filter((row): row is SearchHit => row !== null);
    } catch {
      ranked = lexical;
    }
  }

  ranked.sort((a, b) => b.score - a.score || b.termOverlap - a.termOverlap);
  return ranked.slice(0, k);
}

export function confidenceOf(hits: SearchHit[]): number {
  if (hits.length === 0) return 0;
  const best = hits[0];
  const overlap = best.termOverlap;
  const support = hits.filter((hit) => hit.termOverlap >= 0.34).length;
  const spread = Math.min(1, support / 2);
  return Math.max(0, Math.min(1, 0.75 * overlap + 0.25 * spread));
}

export function shouldRefuse(hits: SearchHit[], confidence: number): boolean {
  if (hits.length === 0) return true;
  if (hits[0].termOverlap <= 0) return true;
  if (confidence < 0.22) return true;
  return false;
}

export function selectEvidence(hits: SearchHit[]): SearchHit[] {
  if (hits.length === 0) return [];
  const best = hits[0].termOverlap;
  const floor = Math.max(0.34, best * 0.6);
  const kept = hits.filter((hit) => hit.termOverlap >= floor);
  const files = new Set(kept.map((hit) => hit.chunk.path));
  const limit = files.size >= 2 ? 4 : 3;
  return kept.slice(0, limit);
}

export function isConflict(hits: SearchHit[]): boolean {
  const strong = hits.filter((hit) => hit.termOverlap >= 0.45);
  return new Set(strong.map((hit) => hit.chunk.path)).size >= 2;
}
