import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import { makeTempDir, run } from "./helpers.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, "scripts", "bump-version.mjs");

function writeJson(filePath, json) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function makeVersionFixture() {
  const root = makeTempDir();

  writeJson(path.join(root, "package.json"), {
    name: "codex-plugin-for-any",
    version: "2.0.0"
  });
  writeJson(path.join(root, "package-lock.json"), {
    name: "codex-plugin-for-any",
    version: "2.0.0",
    lockfileVersion: 3,
    packages: {
      "": {
        name: "codex-plugin-for-any",
        version: "2.0.0"
      }
    }
  });
  writeJson(path.join(root, "plugin.json"), {
    name: "codex",
    version: "2.0.0"
  });

  const skillPath = path.join(root, "skills", "codex", "SKILL.md");
  fs.mkdirSync(path.dirname(skillPath), { recursive: true });
  fs.writeFileSync(
    skillPath,
    ["---", "name: codex", "description: Codex skill", "metadata:", '  version: "2.0.0"', "---", "", "# Codex"].join(
      "\n"
    ) + "\n"
  );

  const versionModulePath = path.join(root, "skills", "codex", "scripts", "lib", "version.mjs");
  fs.mkdirSync(path.dirname(versionModulePath), { recursive: true });
  fs.writeFileSync(versionModulePath, 'export const COMPANION_VERSION = "2.0.0";\n');

  return root;
}

test("bump-version updates every release manifest and skill metadata file", () => {
  const root = makeVersionFixture();

  const result = run("node", [SCRIPT, "--root", root, "2.1.0"], {
    cwd: ROOT
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(readJson(path.join(root, "package.json")).version, "2.1.0");
  assert.equal(readJson(path.join(root, "package-lock.json")).version, "2.1.0");
  assert.equal(readJson(path.join(root, "package-lock.json")).packages[""].version, "2.1.0");
  assert.equal(readJson(path.join(root, "plugin.json")).version, "2.1.0");
  assert.match(fs.readFileSync(path.join(root, "skills", "codex", "SKILL.md"), "utf8"), /version: "2\.1\.0"/);
  assert.equal(
    fs.readFileSync(path.join(root, "skills", "codex", "scripts", "lib", "version.mjs"), "utf8"),
    'export const COMPANION_VERSION = "2.1.0";\n'
  );
});

test("bump-version check mode reports stale metadata", () => {
  const root = makeVersionFixture();
  writeJson(path.join(root, "package.json"), {
    name: "codex-plugin-for-any",
    version: "2.0.1"
  });

  const result = run("node", [SCRIPT, "--root", root, "--check"], {
    cwd: ROOT
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /plugin\.json version/);
  assert.match(result.stderr, /skills\/codex\/SKILL\.md metadata\.version/);
  assert.match(result.stderr, /skills\/codex\/scripts\/lib\/version\.mjs COMPANION_VERSION/);
});
