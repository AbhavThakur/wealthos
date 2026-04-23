#!/usr/bin/env node
/**
 * WealthOS release helper — adds a new entry to src/data/releaseNotes.js
 * and bumps the service worker cache version.
 *
 * Usage:
 *   node scripts/release.js            # interactive prompts
 *   node scripts/release.js minor      # pre-select bump type
 *   node scripts/release.js patch      # pre-select bump type
 *
 * What it does:
 *   1. Reads current version from releaseNotes.js
 *   2. Prompts: bump type (major / minor / patch)
 *   3. Prompts: release title
 *   4. Prompts: bullet points (blank line to finish)
 *   5. Prepends new entry to releaseNotes.js
 *   6. Updates CACHE_NAME in public/sw.js to bust the PWA cache
 */

import { createInterface } from "readline";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const NOTES_PATH = resolve(ROOT, "src/data/releaseNotes.js");
const SW_PATH = resolve(ROOT, "public/sw.js");

// ── Helpers ───────────────────────────────────────────────────────────────────
function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function bumpVersion(current, type) {
  const [major, minor, patch] = current.split(".").map(Number);
  if (type === "major") return `${major + 1}.0.0`;
  if (type === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ── Read current version from releaseNotes.js ─────────────────────────────────
function getCurrentVersion() {
  const src = readFileSync(NOTES_PATH, "utf8");
  const match = src.match(/version:\s*"(\d+\.\d+\.\d+)"/);
  if (!match)
    throw new Error("Could not find current version in releaseNotes.js");
  return match[1];
}

// ── Write new entry into releaseNotes.js ──────────────────────────────────────
function prependRelease(version, date, title, highlights) {
  const src = readFileSync(NOTES_PATH, "utf8");

  const highlightLines = highlights
    .map((h) => `      "${h.replace(/"/g, '\\"')}"`)
    .join(",\n");

  const newEntry = `  {
    version: "${version}",
    date: "${date}",
    title: "${title.replace(/"/g, '\\"')}",
    highlights: [
${highlightLines},
    ],
  },`;

  // Insert after "const RELEASE_NOTES = ["
  const updated = src.replace(
    /const RELEASE_NOTES = \[/,
    `const RELEASE_NOTES = [\n${newEntry}`,
  );

  if (updated === src) throw new Error("Failed to insert new release entry");
  writeFileSync(NOTES_PATH, updated, "utf8");
}

// ── Bump CACHE_NAME in sw.js ──────────────────────────────────────────────────
function bumpServiceWorker(version) {
  try {
    const src = readFileSync(SW_PATH, "utf8");
    // Matches: const CACHE_NAME = "wealthos-v2.5.0" or 'wealthos-v2.5.0'
    const updated = src.replace(
      /(const CACHE_NAME\s*=\s*['"]wealthos-v)[^'"]+(['"])/,
      `$1${version}$2`,
    );
    if (updated === src) {
      console.log(
        "  ⚠  Could not find CACHE_NAME in sw.js — update it manually",
      );
      return;
    }
    writeFileSync(SW_PATH, updated, "utf8");
    console.log(`  ✓ sw.js CACHE_NAME → wealthos-v${version}`);
  } catch {
    console.log("  ⚠  sw.js not found — skipping cache bump");
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log("\n🚀 WealthOS Release Helper\n");

  const currentVersion = getCurrentVersion();
  console.log(`  Current version: v${currentVersion}`);

  // Bump type
  let bumpType = process.argv[2];
  const validTypes = ["major", "minor", "patch"];
  if (!validTypes.includes(bumpType)) {
    const input = await ask(
      rl,
      "  Bump type [major / minor / patch] (default: minor): ",
    );
    bumpType = validTypes.includes(input.trim()) ? input.trim() : "minor";
  }

  const newVersion = bumpVersion(currentVersion, bumpType);
  const releaseDate = today();
  console.log(`  New version: v${newVersion}  (${releaseDate})\n`);

  // Title
  const title = (await ask(rl, "  Release title: ")).trim();
  if (!title) {
    console.error("  ✗ Title cannot be empty.");
    rl.close();
    process.exit(1);
  }

  // Highlights
  console.log("  Highlights (enter one per line, blank line to finish):");
  const highlights = [];
  while (true) {
    const line = (await ask(rl, `  • `)).trim();
    if (!line) break;
    highlights.push(line);
  }

  if (highlights.length === 0) {
    console.error("  ✗ At least one highlight is required.");
    rl.close();
    process.exit(1);
  }

  rl.close();

  // Write files
  console.log("\n  Writing files...");
  prependRelease(newVersion, releaseDate, title, highlights);
  console.log(`  ✓ releaseNotes.js updated → v${newVersion}`);
  bumpServiceWorker(newVersion);

  console.log(`
✅ Done! v${newVersion} is ready.

Next steps:
  git add src/data/releaseNotes.js public/sw.js
  git commit -m "chore: release v${newVersion}"
  git push   # or: vercel --prod
`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
