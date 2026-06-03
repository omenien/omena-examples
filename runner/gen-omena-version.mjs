#!/usr/bin/env node
// Best-effort cross-repo writer for .omena-version.
//
// The AUTHORITATIVE bump happens on an omena-css RELEASE; this script only
// mirrors the two upstream sources into the pin when the monorepo is present
// in a standalone checkout. It degrades gracefully when it is absent.
//
//   PRIMARY   vsix         <- omena-css  package.json  "version"
//   SECONDARY crates_train <- omena-css  rust/Cargo.toml  [workspace.package].version
//                             (== the crates.io train version under Model A direct-publish)
//
// Resolve the monorepo via env OMENA_CSS_DIR, else the sibling ../omena-css.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const PIN_FILE = join(REPO_ROOT, ".omena-version");

const monorepo =
  process.env.OMENA_CSS_DIR
    ? resolve(process.env.OMENA_CSS_DIR)
    : resolve(REPO_ROOT, "..", "omena-css");

function fail(msg) {
  console.error(`gen-omena-version: ${msg}`);
  process.exit(1);
}

const pkgPath = join(monorepo, "package.json");
const cargoPath = join(monorepo, "rust", "Cargo.toml");

if (!existsSync(pkgPath) || !existsSync(cargoPath)) {
  fail(
    `monorepo not found at ${monorepo} ` +
      `(set OMENA_CSS_DIR or clone omena-css as a sibling). ` +
      `Authoritative bump is on release; nothing written.`,
  );
}

const vsix = JSON.parse(readFileSync(pkgPath, "utf8")).version;
if (!vsix) fail(`could not read "version" from ${pkgPath}`);

// crates_train == [workspace.package].version under Model A direct-publish.
const cargoToml = readFileSync(cargoPath, "utf8");
const wpIdx = cargoToml.indexOf("[workspace.package]");
const scope = wpIdx === -1 ? cargoToml : cargoToml.slice(wpIdx);
const cratesTrain = scope.match(/^\s*version\s*=\s*"([^"]+)"/m)?.[1];
if (!cratesTrain)
  fail(`could not read [workspace.package].version from ${cargoPath}`);

const header = `# Pins the shipping omena artifacts these examples target.
# GENERATED / CHECKED, not hand-edited (runner/gen-omena-version.mjs + check-omena-version.mjs).
# PRIMARY   = vsix         : the end-user VSIX product version (omena-css root package.json "version").
# SECONDARY = crates_train : the crates.io train version. Under the now-live Model A direct-publish,
#                            the train version EQUALS the monorepo workspace version
#                            (rust/Cargo.toml [workspace.package].version), so it tracks that single source.
# The two axes are documented together but may move independently in principle.
# Bump-on-RELEASE, never on corpus growth: adding an example does NOT re-pin this file.
`;

writeFileSync(PIN_FILE, `${header}vsix = "${vsix}"\ncrates_train = "${cratesTrain}"\n`);
console.log(`gen-omena-version: wrote vsix="${vsix}" crates_train="${cratesTrain}" (from ${monorepo})`);
