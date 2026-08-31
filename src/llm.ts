import { llmConfigured, openaiBaseUrl } from "./util.js";

export function embeddingsEnabled(): boolean {
  return llmConfigured();
}

export function generateEnabled(): boolean {
  return llmConfigured();
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

async function openaiFetch(path: string, body: unknown): Promise<unknown> {
  const base = openaiBaseUrl();
  const key = process.env.OPENAI_API_KEY ?? "";
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (key) headers.authorization = `Bearer ${key}`;

  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI-compatible ${path} failed (${response.status}): ${text.slice(0, 400)}`);
  }
  return JSON.parse(text) as unknown;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const model = process.env.CITEKIT_EMBED_MODEL ?? "text-embedding-3-small";
  const payload = (await openaiFetch("/embeddings", { model, input: texts })) as {
    data?: Array<{ embedding: number[] }>;
  };
  if (!payload.data || payload.data.length !== texts.length) {
    throw new Error("Embedding response missing vectors");
  }
  return payload.data.map((row) => row.embedding);
}

export async function chatComplete(messages: ChatMessage[]): Promise<string> {
  const model = process.env.CITEKIT_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const payload = (await openaiFetch("/chat/completions", {
    model,
    temperature: 0,
    messages,
  })) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("Chat completion returned no content");
  return content.trim();
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
