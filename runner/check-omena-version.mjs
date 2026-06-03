#!/usr/bin/env node
// Best-effort cross-repo checker for .omena-version.
//
// Asserts the committed pin matches the two upstream omena-css sources.
// ADVISORY when the monorepo is absent (a standalone checkout cannot verify
// against a tree it does not have) -> exit 0 with a notice. Reds (exit 1)
// ONLY on a genuine drift detected against a present monorepo.
//
// Resolve the monorepo via env OMENA_CSS_DIR, else the sibling ../omena-css.

import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const PIN_FILE = join(REPO_ROOT, ".omena-version");

const monorepo = process.env.OMENA_CSS_DIR
  ? resolve(process.env.OMENA_CSS_DIR)
  : resolve(REPO_ROOT, "..", "omena-css");

function readField(text, key) {
  return text.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]+)"`, "m"))?.[1];
}

if (!existsSync(PIN_FILE)) {
  console.error("check-omena-version: .omena-version is missing");
  process.exit(1);
}
const pin = readFileSync(PIN_FILE, "utf8");
const pinned = { vsix: readField(pin, "vsix"), crates_train: readField(pin, "crates_train") };
if (!pinned.vsix || !pinned.crates_train) {
  console.error("check-omena-version: .omena-version is malformed (need vsix + crates_train)");
  process.exit(1);
}

const pkgPath = join(monorepo, "package.json");
const cargoPath = join(monorepo, "rust", "Cargo.toml");
if (!existsSync(pkgPath) || !existsSync(cargoPath)) {
  console.log(
    `check-omena-version: ADVISORY — monorepo not found at ${monorepo}; ` +
      `cannot verify upstream. Pinned vsix="${pinned.vsix}" crates_train="${pinned.crates_train}".`,
  );
  process.exit(0);
}

const vsix = JSON.parse(readFileSync(pkgPath, "utf8")).version;
const cargoToml = readFileSync(cargoPath, "utf8");
const wpIdx = cargoToml.indexOf("[workspace.package]");
const scope = wpIdx === -1 ? cargoToml : cargoToml.slice(wpIdx);
const cratesTrain = scope.match(/^\s*version\s*=\s*"([^"]+)"/m)?.[1];

const drift = [];
if (pinned.vsix !== vsix) drift.push(`vsix: pinned "${pinned.vsix}" != upstream "${vsix}"`);
if (pinned.crates_train !== cratesTrain)
  drift.push(`crates_train: pinned "${pinned.crates_train}" != upstream "${cratesTrain}"`);

if (drift.length) {
  console.error("check-omena-version: DRIFT — run `pnpm gen:version` and commit:");
  for (const d of drift) console.error(`  - ${d}`);
  process.exit(1);
}
console.log(`check-omena-version: OK — vsix="${vsix}" crates_train="${cratesTrain}" (vs ${monorepo})`);
