#!/usr/bin/env node
// Minimal presence/shape check for the lifted checker corpora.
// NOT the upstream oracle (that needs the checker CLI / parity runner in the monorepo).
// This only asserts the COPIED fixture data is present and non-empty so the
// workspace package resolves and obvious lift-rot (a deleted subdir) reds CI.
import { readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

// expected[subdir] = minimum file count observed at lift time (2026-06-03).
const expected = {
  "integration-errors/real-project-corpus": 10,
  "integration-errors/real-project-checker-corpus": 5,
  "golden/contract-parity": 17,
  "golden/contract-parity-v2": 4,
};

function countFiles(dir) {
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) n += countFiles(p);
    else if (entry.isFile()) n += 1;
  }
  return n;
}

let ok = true;
for (const [rel, min] of Object.entries(expected)) {
  const dir = join(here, rel);
  let count = 0;
  try {
    if (!statSync(dir).isDirectory()) throw new Error("not a directory");
    count = countFiles(dir);
  } catch (err) {
    console.error(`MISSING ${rel}: ${err.message}`);
    ok = false;
    continue;
  }
  const mark = count >= min ? "OK " : "LOW";
  if (count < min) ok = false;
  console.log(`${mark} ${rel}: ${count} files (expected >= ${min})`);
}

if (!ok) {
  console.error("corpus check FAILED");
  process.exit(1);
}
console.log("corpus check OK");
