import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILL_ROOT = path.join(ROOT, "skills", "codex");

function readFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  assert.ok(match, "SKILL.md must begin with YAML frontmatter delimited by ---");
  const [, rawFrontmatter, body] = match;
  const fields = {};
  let currentKey = null;
  let multilineMode = false;

  for (const line of rawFrontmatter.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }
    if (multilineMode && /^\s+/.test(line)) {
      fields[currentKey] = fields[currentKey] ? `${fields[currentKey]} ${line.trim()}` : line.trim();
      continue;
    }
    multilineMode = false;

    const nestedMatch = line.match(/^\s+([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (nestedMatch && currentKey && typeof fields[currentKey] === "object") {
      fields[currentKey][nestedMatch[1]] = nestedMatch[2].trim().replace(/^["']|["']$/g, "");
      continue;
    }

    const topMatch = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    assert.ok(topMatch, `Unexpected frontmatter line: ${line}`);
    const [, key, rawValue] = topMatch;
    currentKey = key;
    const value = rawValue.trim();
    if (value === ">-" || value === ">" || value === "|" || value === "|-") {
      fields[key] = "";
      multilineMode = true;
    } else if (value === "") {
      fields[key] = {};
    } else {
      fields[key] = value.replace(/^["']|["']$/g, "");
    }
  }

  return { fields, rawFrontmatter, body };
}

function walkFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

test("skills/codex/SKILL.md complies with the open Agent Skills specification", () => {
  const skillMd = readFile("skills/codex/SKILL.md");
  const { fields, rawFrontmatter, body } = parseFrontmatter(skillMd);

  // Required fields and naming constraints (agentskills.io)
  assert.equal(fields.name, path.basename(SKILL_ROOT));
  assert.match(fields.name, /^[a-z0-9]+(-[a-z0-9]+)*$/);
  assert.ok(fields.name.length >= 1 && fields.name.length <= 64);

  assert.equal(typeof fields.description, "string");
  assert.ok(fields.description.length >= 1 && fields.description.length <= 1024);
  assert.doesNotMatch(rawFrontmatter, /[<>]/, "Frontmatter must not contain XML angle brackets");

  // Optional standard fields
  assert.equal(fields.license, "Apache-2.0");
  assert.equal(typeof fields.compatibility, "string");
  assert.ok(fields.compatibility.length <= 500);
  assert.equal(typeof fields.metadata?.version, "string");

  // Only standard agentskills.io frontmatter keys are used (no Claude-only keys)
  const allowedKeys = new Set(["name", "description", "license", "compatibility", "metadata", "allowed-tools"]);
  for (const key of Object.keys(fields)) {
    assert.ok(allowedKeys.has(key), `Non-standard frontmatter key found: ${key}`);
  }
  assert.equal(fields["allowed-tools"], undefined, "Avoid experimental/client-specific allowed-tools");

  // Progressive disclosure line budget (< 500 lines)
  const lineCount = skillMd.split(/\r?\n/).length;
  assert.ok(lineCount < 500, `SKILL.md should stay under 500 lines (got ${lineCount})`);

  // Key safety and workflow rules are documented
  assert.match(body, /scripts\/codex-companion\.mjs/);
  assert.match(body, /review-only constraint/i);
  assert.match(body, /never substitute for a failed codex run/i);
  assert.match(body, /## Gotchas/);
});

test("SKILL.md relative links resolve to existing one-level-deep files inside skills/codex", () => {
  const skillMd = readFile("skills/codex/SKILL.md");
  const links = [...skillMd.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]);
  assert.ok(links.length >= 3, "Expected links to progressive-disclosure references");

  for (const href of links) {
    assert.equal(path.isAbsolute(href), false, `Link must be relative: ${href}`);
    assert.equal(href.includes("\\"), false, `Link must use forward slashes: ${href}`);
    assert.equal(href.startsWith(".."), false, `Link must stay inside skill root: ${href}`);
    const segments = href.split("/");
    assert.equal(segments.length, 2, `Reference link should stay one level deep from SKILL.md: ${href}`);
    const targetPath = path.join(SKILL_ROOT, href);
    assert.equal(fs.existsSync(targetPath), true, `Linked file missing: ${href}`);
  }
});

test("plugin.json complies with Antigravity / universal plugin manifest constraints", () => {
  const manifest = JSON.parse(readFile("plugin.json"));
  const allowedKeys = new Set([
    "$schema",
    "name",
    "displayName",
    "version",
    "description",
    "disabled",
    "logo",
    "suggestedPrompts",
    "skills",
    "author",
    "homepage",
    "repository",
    "license",
    "keywords",
    "extensions"
  ]);

  for (const key of Object.keys(manifest)) {
    assert.ok(allowedKeys.has(key), `Unexpected key in plugin.json: ${key}`);
  }

  assert.equal(manifest.$schema, "https://antigravity.google/schemas/v1/plugin.json");
  assert.match(manifest.name, /^[a-z0-9]+(-[a-z0-9]+)*$/);
  assert.doesNotMatch(manifest.displayName, /^(Antigravity|Gemini|Claude|Cursor)\b/i);
  assert.doesNotMatch(manifest.displayName, /\b(Plugin|MCP)$/i);
  assert.ok(Array.isArray(manifest.suggestedPrompts) && manifest.suggestedPrompts.length <= 3);
  assert.equal(manifest.license, "Apache-2.0");
});

test("repository and skill bundle contain no Claude Code-specific interfaces or variables", () => {
  assert.equal(fs.existsSync(path.join(ROOT, ".claude-plugin")), false);
  assert.equal(fs.existsSync(path.join(ROOT, "plugins")), false);

  const forbiddenPatterns = [
    /CLAUDE_PLUGIN_ROOT/,
    /CLAUDE_PLUGIN_DATA/,
    /CLAUDE_ENV_FILE/,
    /CLAUDE_PROJECT_DIR/,
    /AskUserQuestion/,
    /\/codex:[a-z-]+/,
    /!codex login/,
    /user-invocable:/,
    /disable-model-invocation:/,
    /subagent_type/
  ];

  const skillFiles = walkFiles(SKILL_ROOT);
  assert.ok(skillFiles.length > 0);
  for (const filePath of skillFiles) {
    const content = fs.readFileSync(filePath, "utf8");
    const rel = path.relative(ROOT, filePath);
    for (const pattern of forbiddenPatterns) {
      assert.doesNotMatch(content, pattern, `Found Claude-specific pattern ${pattern} in ${rel}`);
    }
  }
});

test("bundled entrypoint scripts are executable on POSIX platforms", () => {
  if (process.platform === "win32") {
    return;
  }
  for (const rel of ["skills/codex/scripts/codex-companion.mjs", "skills/codex/scripts/app-server-broker.mjs"]) {
    const mode = fs.statSync(path.join(ROOT, rel)).mode;
    assert.ok((mode & 0o111) !== 0, `${rel} should have executable permission bits`);
  }
});
