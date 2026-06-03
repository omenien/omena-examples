# `@omena/corpus` — checker regression corpora

Golden / integration **oracle data** for the omena-css checker, used by the
examples workspace as portable regression fixtures.

These are **COPIES** (graduated, not moved). The authoritative originals stay
in the omena-css monorepo, where live tests depend on them — this package is a
point-in-time snapshot lifted for the standalone `omena-examples` repo.

> Provenance: copied (`cp -R`) from `css-module-explainer/test/_fixtures/` on
> **2026-06-03**. Data only — no `.ts` harness files (`test-helpers.ts`,
> `protocol.ts`, the `scripts/*.ts` drivers) were lifted. The monorepo remains
> the live-test source of truth; this snapshot can drift and is re-lifted on a
> user gate, not auto-synced.

## Layout

```
corpus/
├── integration-errors/                  # checker CLI pass/fail oracles
│   ├── real-project-corpus/             # 10 files, 4 scenarios
│   └── real-project-checker-corpus/     #  5 files
└── golden/                              # contract-parity goldens
    ├── contract-parity/                 # 17 files (.tsx/.module.scss + *-parity.json)
    └── contract-parity-v2/              #  4 files (v2 *-parity.json goldens)
```

### `integration-errors/`

Lifted from:

- `css-module-explainer/test/_fixtures/real-project-corpus/`
- `css-module-explainer/test/_fixtures/real-project-checker-corpus/`

**How they are driven upstream:** in the monorepo these are run through the
checker CLI with `--preset ci` (argv-driven, see
`scripts/real-project-corpus.ts` / `scripts/check-real-project-corpus.ts`),
asserting **exit-code pass/fail** per scenario. They are paired
`.tsx` + `.module.scss`/`.module.less` "real project" snippets that exercise the
checker's diagnostic surface end to end.

### `golden/`

Lifted from:

- `css-module-explainer/test/_fixtures/contract-parity/`
- `css-module-explainer/test/_fixtures/contract-parity-v2/`

Each scenario pairs a `.tsx` + `.module.scss` source with a companion
`*-parity.json` **golden** (the expected checker/contract output). Upstream
these back the contract-parity smoke + golden lanes
(`scripts/check-contract-parity-v1-golden.ts`,
`scripts/check-contract-parity-v2-golden.ts`).

## NOT lifted (stays in the monorepo — Salsa / crate-coupled)

Per doc 04 §2, the Rust-native / crate-internal seeds are **not** portable and
remain in omena-css:

- `rust/crates/omena-diff-test/wpt-corpus/` (WPT seed pinned via
  `wpt-seed-policy.toml`).
- `omena-testkit` inline `&'static str` cme-fixture-v0 seeds.

## Local check

```sh
node check-corpus.mjs   # or: pnpm --filter @omena/corpus run check:corpus
```

A minimal presence/shape check (asserts each lifted subdir exists and is
non-empty). It is **not** the upstream oracle — reproducing pass/fail or golden
comparison requires the checker CLI / parity runner in the monorepo.
