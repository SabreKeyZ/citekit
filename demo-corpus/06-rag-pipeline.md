# Retrieval pipeline

Lumen's assistant is citation-first. It does not answer from model memory.

## Chunking

Markdown files are split on headings. Each chunk stores the file path plus
the inclusive start and end line in the original file. Code files are split
on function or class-like blocks, then a sliding window if a block is long.

Typical chunk size is 512 tokens with a 64-token overlap when a heading
section is too large. Line spans still refer to the source file, not to the
token window.

## Retrieval

The default ranker is BM25 over an inverted index. If an embedding endpoint
is configured, Lumen fuses BM25 with cosine similarity and a term-overlap
rerank. Hybrid search is optional. Extractive ask must work with BM25 alone.

## Citations on answers

Every sentence in a generated answer must cite a retrieved span using the
form `path:start-end`, for example `06-rag-pipeline.md:18-24`. Extractive
mode is stricter: the answer is almost entirely quoted text plus those
citations. If the top hit does not share distinctive query terms, Lumen
refuses instead of guessing.

The retrieval pipeline attaches citations by copying the chunk's stored
`path`, `startLine`, and `endLine`. It never invents a file name and never
rounds a line number.
