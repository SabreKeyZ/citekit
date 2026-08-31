import { copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { SKILL_PATH, style } from "./util.js";

export function skillInstructions(): string {
  return `CiteKit Agent Skill
====================

The skill file lives at:
  ${SKILL_PATH}

Cursor (project)
  mkdir -p .cursor/skills/citekit
  cp "${SKILL_PATH}" .cursor/skills/citekit/SKILL.md

Claude Code (user)
  mkdir -p ~/.claude/skills/citekit
  cp "${SKILL_PATH}" ~/.claude/skills/citekit/SKILL.md

Or run:
  citekit skill --install

MCP (Cursor / Claude Code)
  {
    "mcpServers": {
      "citekit": {
        "command": "npx",
        "args": ["citekit", "mcp"]
      }
    }
  }

Rule of thumb: never answer a repo question without citekit_search or citekit_ask.
`;
}

export async function installSkill(cwd = process.cwd()): Promise<string[]> {
  const targets = [
    join(resolve(cwd), ".cursor", "skills", "citekit", "SKILL.md"),
    join(homedir(), ".claude", "skills", "citekit", "SKILL.md"),
  ];
  const written: string[] = [];
  for (const target of targets) {
    await mkdir(dirname(target), { recursive: true });
    await copyFile(SKILL_PATH, target);
    written.push(target);
  }
  return written;
}

export async function printSkill(install: boolean): Promise<void> {
  const body = await readFile(SKILL_PATH, "utf8");
  console.log(skillInstructions());
  console.log(style.dim("--- SKILL.md ---"));
  console.log(body.trimEnd());
  if (install) {
    const written = await installSkill();
    console.log("");
    for (const file of written) console.log(style.green(`copied → ${file}`));
  }
}
