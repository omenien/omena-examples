# omena-examples

Portable examples, fixtures, and end-to-end regression for
[omena-css](https://github.com/omenien/omena-css), kept out of the shipping
monorepo. A **pnpm + turborepo** workspace. Nothing here is a Cargo member; the
language-level corpora that *graduate* out of the monorepo live here, while
Rust-native / Salsa-coupled seeds stay in-repo.

## Layout

| Package | Purpose |
|---|---|
| [`examples/`](examples/) | Onboarding sandbox — a single Vite/React app where each scenario exercises one `cx()` / CSS Modules pattern. Plus `plugin-consumers/` (eslint + stylelint demo). Manual-QA against the live LSP. |
| `corpus/` | Checker fixtures: integration-error corpora (argv-driven, exit-code pass/fail) and golden contract-parity fixtures. |
| `lsp-e2e/` | Rust-LSP regression — drives the omena LSP **binary** against scenario folders with declarative expectations. |

> `corpus/` and `lsp-e2e/` are declared in `pnpm-workspace.yaml` and populated by
> the lift workstream.

## Version pin — `.omena-version`

`.omena-version` pins the **shipping omena artifacts** these examples run
against (not the dev-tree version):

- **PRIMARY `vsix`** — the end-user VSIX product version (omena-css root
  `package.json` `"version"`).
- **SECONDARY `crates_train`** — the crates.io train version. Under the
  now-live Model A direct-publish this **equals** the monorepo workspace version
  (`rust/Cargo.toml [workspace.package].version`), so it tracks that single
  source.

It is **generated/checked, not hand-edited**, and bumps **on release, not on
corpus growth** — adding an example does not re-pin it.

```bash
pnpm gen:version    # rewrite .omena-version from the omena-css monorepo
pnpm check:version  # assert the pin matches upstream (advisory if absent)
```

Both scripts resolve the monorepo via `OMENA_CSS_DIR` (default: sibling
`../omena-css`) and degrade gracefully in a standalone checkout where the
monorepo is absent. The authoritative bump is on an omena-css release.

## Commands

```bash
pnpm install        # provision all workspace packages
pnpm build          # turbo run build
pnpm lint           # turbo run lint
pnpm test           # turbo run test
pnpm typecheck      # turbo run typecheck
```

Per-package tasks fan out through [turbo](turbo.json); run any of the above from
the repo root.

## Lineage

Lifted (COPY, not move) from the `omenien/omena-css` monorepo so live tests keep
their originals.
