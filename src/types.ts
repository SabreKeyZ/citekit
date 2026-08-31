export type AskMode = "extractive" | "generate";

export type Chunk = {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  text: string;
  hash: string;
  heading?: string;
  ext: string;
};

export type DocumentRecord = {
  path: string;
  bytes: number;
  lineCount: number;
  hash: string;
  mtimeMs: number;
};

export type Citation = {
  path: string;
  startLine: number;
  endLine: number;
  quote: string;
  heading?: string;
  score: number;
};

export type AskResult = {
  question: string;
  mode: AskMode;
  refused: boolean;
  reason?: string;
  answer: string;
  citations: Citation[];
  confidence: number;
  retrieved: number;
};

export type StoreMeta = {
  version: 1;
  root: string;
  createdAt: string;
  documentCount: number;
  chunkCount: number;
  hybrid: boolean;
};

export type Store = {
  meta: StoreMeta;
  documents: DocumentRecord[];
  chunks: Chunk[];
  miniSearch: object;
  embeddings?: Record<string, number[]>;
};

export type LastAnswerFile = {
  generatedAt: string;
  indexRoot: string;
  documentCount: number;
  chunkCount: number;
  sessions: AskResult[];
};

export type SearchHit = {
  chunk: Chunk;
  score: number;
  termOverlap: number;
};
