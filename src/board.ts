import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { AskResult, LastAnswerFile } from "./types.js";
import { citationKey } from "./util.js";

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028");
}

function graph(sessions: AskResult[]): { nodes: Array<{ id: string; label: string; kind: string }>; edges: Array<{ from: string; to: string }> } {
  const nodes = new Map<string, { id: string; label: string; kind: string }>();
  const edges: Array<{ from: string; to: string }> = [];
  sessions.forEach((session, s) => {
    const claimId = `q${s}`;
    nodes.set(claimId, {
      id: claimId,
      label: session.question.length > 42 ? `${session.question.slice(0, 40)}…` : session.question,
      kind: session.refused ? "refused" : "claim",
    });
    const files = new Set(session.citations.map((c) => c.path));
    for (const file of files) {
      const fileId = `f:${file}`;
      nodes.set(fileId, { id: fileId, label: file, kind: "file" });
      edges.push({ from: fileId, to: claimId });
    }
  });
  return { nodes: [...nodes.values()], edges };
}

export function renderBoard(payload: LastAnswerFile): string {
  const title = "CiteKit evidence board";
  const data = {
    ...payload,
    graph: graph(payload.sessions),
  };
  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <style>
    :root, [data-theme="dark"] {
      --bg: #0b0c10;
      --bg-2: #12141b;
      --card: #171922;
      --ink: #ece7dc;
      --muted: #9a9386;
      --line: #2a2d38;
      --gold: #e0b567;
      --gold-2: #f0d9a6;
      --rose: #e08b8b;
      --green: #8fcaa4;
      --file: #7ea2d6;
      --shadow: 0 18px 50px rgba(0,0,0,.35);
    }
    [data-theme="light"] {
      --bg: #f6f1e8;
      --bg-2: #fffdf8;
      --card: #ffffff;
      --ink: #1c1914;
      --muted: #6d665b;
      --line: #e4dccf;
      --gold: #9a6b16;
      --gold-2: #6a4a10;
      --rose: #a33b3b;
      --green: #1f6d45;
      --file: #2c5d9e;
      --shadow: 0 16px 40px rgba(73, 55, 24, .08);
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: var(--bg); color: var(--ink); }
    body {
      font-family: "Iowan Old Style", "Palatino Linotype", Palatino, "Times New Roman", serif;
      line-height: 1.55;
      min-height: 100vh;
      background-image:
        radial-gradient(1200px 500px at 10% -10%, rgba(224,181,103,.12), transparent 50%),
        linear-gradient(var(--bg), var(--bg));
    }
    .wrap { max-width: 1080px; margin: 0 auto; padding: 36px 22px 80px; }
    header {
      display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;
      border-bottom: 1px solid var(--line); padding-bottom: 22px; margin-bottom: 28px;
    }
    .brand { font-size: 13px; letter-spacing: .18em; text-transform: uppercase; color: var(--gold); }
    h1 { font-size: 34px; margin: 6px 0 8px; font-weight: 600; letter-spacing: -.02em; }
    .lede { color: var(--muted); margin: 0; max-width: 46rem; }
    button.theme {
      border: 1px solid var(--line); background: var(--card); color: var(--ink);
      padding: 8px 12px; border-radius: 999px; cursor: pointer; font: inherit; font-size: 13px;
    }
    .meta {
      display: flex; flex-wrap: wrap; gap: 8px; margin: 18px 0 8px;
    }
    .pill {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 12px; padding: 4px 8px; border: 1px solid var(--line); border-radius: 999px;
      color: var(--muted); background: var(--bg-2);
    }
    section.session {
      background: var(--card); border: 1px solid var(--line); border-radius: 18px;
      padding: 22px 22px 8px; margin: 22px 0; box-shadow: var(--shadow);
    }
    section.session h2 { font-size: 22px; margin: 0 0 10px; }
    .answer {
      white-space: pre-wrap; background: var(--bg-2); border-radius: 12px; padding: 14px 16px;
      border: 1px solid var(--line); font-size: 15px;
    }
    .refused .answer { border-color: var(--rose); color: var(--rose); }
    .quotes { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; margin: 16px 0 20px; }
    article.quote {
      border: 1px solid var(--line); border-left: 3px solid var(--gold); border-radius: 12px;
      padding: 12px 14px; background: var(--bg-2);
    }
    article.quote .cite {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      color: var(--gold); font-size: 12px; margin-bottom: 8px;
    }
    article.quote pre {
      margin: 0; white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 12px; color: var(--ink); opacity: .92;
    }
    h3 { font-size: 16px; margin: 28px 0 10px; letter-spacing: .02em; }
    .graph-wrap {
      background: var(--card); border: 1px solid var(--line); border-radius: 18px;
      padding: 12px; overflow: auto; box-shadow: var(--shadow);
    }
    svg text { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 11px; fill: var(--ink); }
    .legend { color: var(--muted); font-size: 13px; margin-top: 10px; }
    footer { margin-top: 36px; color: var(--muted); font-size: 13px; }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <div>
        <div class="brand">CiteKit</div>
        <h1>Evidence board</h1>
        <p class="lede">Every claim below is a quote with an exact source span. If retrieval is weak, CiteKit refuses instead of inventing a citation.</p>
      </div>
      <button class="theme" id="themeBtn" type="button">Light</button>
    </header>
    <div class="meta">
      <span class="pill" id="docCount"></span>
      <span class="pill" id="chunkCount"></span>
      <span class="pill" id="indexRoot"></span>
    </div>
    <div id="sessions"></div>
    <h3>Files ↔ claims</h3>
    <div class="graph-wrap"><svg id="graph" width="100%" height="360"></svg></div>
    <p class="legend">Gold nodes are questions. Blue nodes are files that supplied a quote. Rose means the question was refused.</p>
    <footer>Generated locally by CiteKit · single HTML file · no CDN · MIT</footer>
  </div>
  <script id="data" type="application/json">${jsonForScript(data)}</script>
  <script>
    const data = JSON.parse(document.getElementById("data").textContent);
    const root = document.documentElement;
    const btn = document.getElementById("themeBtn");
    function setTheme(theme) {
      root.setAttribute("data-theme", theme);
      btn.textContent = theme === "dark" ? "Light" : "Dark";
      try { localStorage.setItem("citekit-theme", theme); } catch (e) {}
    }
    try {
      const wanted = new URLSearchParams(location.search).get("theme") || localStorage.getItem("citekit-theme");
      if (wanted === "light" || wanted === "dark") setTheme(wanted);
    } catch (e) {}
    btn.addEventListener("click", () => {
      setTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark");
    });
    document.getElementById("docCount").textContent = data.documentCount + " documents";
    document.getElementById("chunkCount").textContent = data.chunkCount + " chunks";
    document.getElementById("indexRoot").textContent = data.indexRoot;
    const sessions = document.getElementById("sessions");
    data.sessions.forEach((session) => {
      const el = document.createElement("section");
      el.className = "session" + (session.refused ? " refused" : "");
      const cites = (session.citations || []).map((c) => {
        const key = c.path + ":" + c.startLine + "-" + c.endLine;
        const quote = (c.quote || "").replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]));
        return '<article class="quote"><div class="cite">' + key + (c.heading ? " · " + c.heading : "") + '</div><pre>' + quote + "</pre></article>";
      }).join("");
      el.innerHTML = "<h2>" + session.question.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch])) + "</h2>" +
        '<div class="meta"><span class="pill">' + session.mode + '</span><span class="pill">' +
        (session.refused ? "refused" : "cited") + '</span><span class="pill">confidence ' +
        Math.round((session.confidence || 0) * 100) + "%</span></div>" +
        '<div class="answer"></div><div class="quotes">' + cites + "</div>";
      el.querySelector(".answer").textContent = session.answer;
      sessions.appendChild(el);
    });
    const svg = document.getElementById("graph");
    const g = data.graph || { nodes: [], edges: [] };
    const files = g.nodes.filter((n) => n.kind === "file");
    const claims = g.nodes.filter((n) => n.kind !== "file");
    const width = Math.max(720, svg.clientWidth || 720);
    const height = Math.max(280, 80 + Math.max(files.length, claims.length) * 56);
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    svg.setAttribute("height", String(height));
    function ypos(list, i) { return 40 + (list.length <= 1 ? height / 2 - 20 : (i * (height - 80)) / (list.length - 1)); }
    const pos = {};
    files.forEach((n, i) => { pos[n.id] = { x: 150, y: ypos(files, i) }; });
    claims.forEach((n, i) => { pos[n.id] = { x: width - 180, y: ypos(claims, i) }; });
    g.edges.forEach((e) => {
      const a = pos[e.from], b = pos[e.to];
      if (!a || !b) return;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const mid = (a.x + b.x) / 2;
      path.setAttribute("d", "M " + a.x + " " + a.y + " C " + mid + " " + a.y + ", " + mid + " " + b.y + ", " + b.x + " " + b.y);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "currentColor");
      path.setAttribute("stroke-opacity", "0.35");
      path.setAttribute("stroke-width", "1.4");
      svg.appendChild(path);
    });
    g.nodes.forEach((n) => {
      const p = pos[n.id];
      if (!p) return;
      const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c.setAttribute("cx", p.x); c.setAttribute("cy", p.y); c.setAttribute("r", n.kind === "file" ? 8 : 10);
      c.setAttribute("fill", n.kind === "file" ? "#7ea2d6" : n.kind === "refused" ? "#e08b8b" : "#e0b567");
      svg.appendChild(c);
      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("x", n.kind === "file" ? p.x - 16 : p.x + 16);
      t.setAttribute("y", p.y + 4);
      t.setAttribute("text-anchor", n.kind === "file" ? "end" : "start");
      t.textContent = n.label;
      svg.appendChild(t);
    });
  </script>
</body>
</html>
`;
}

export async function writeBoard(payload: LastAnswerFile, outFile: string): Promise<string> {
  const file = resolve(outFile);
  await writeFile(file, renderBoard(payload), "utf8");
  return file;
}

export function formatCitation(path: string, startLine: number, endLine: number): string {
  return citationKey(path, startLine, endLine);
}
