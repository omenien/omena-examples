# `@omena/lsp-e2e`

Generalized end-to-end LSP regression for [omena-css](https://github.com/omenien/omena-css).

It drives the omena LSP **Rust** binary (`omena-lsp-server`) over a pure
JSON-RPC stdio harness against the onboarding scenarios in the sibling
[`@omena/examples`](../examples) package, asserting definition / hover /
codeLens / diagnostic behavior from a **declarative expectation table**.

This targets **only the Rust binary** — there is no path here to the legacy
Node language server.

## How to run

```bash
# 1. Standalone (post-genesis): inject a prebuilt omena-lsp-server binary.
OMENA_LSP_SERVER_PATH=/path/to/omena-lsp-server pnpm --filter @omena/lsp-e2e test

# 2. Inside the omena-css monorepo: cargo-run fallback.
OMENA_CSS_DIR=/path/to/omena-css pnpm --filter @omena/lsp-e2e test

# Type-check only (always works, no binary needed):
pnpm --filter @omena/lsp-e2e typecheck
```

The runner reads scenario files from `../examples/src/scenarios` (resolved
relative to this package), opens them via `textDocument/didOpen`, issues the
declared requests, and checks the declared expectations.

### Binary resolution (priority order)

1. **PREFERRED — `OMENA_LSP_SERVER_PATH`.** A path to a prebuilt
   `omena-lsp-server` binary. This is the **same env var name the monorepo
   uses** (`scripts/omena-lsp-server-invocation.ts`), reused verbatim so a
   standalone consumer — pinned to a shipping build via `.omena-version`
   PRIMARY — can inject the exact binary it downloaded for that pin.
2. **FALLBACK — `cargo run -p omena-lsp-server`.** Used **only** when a Cargo
   workspace is available: either `OMENA_CSS_DIR` points at a monorepo checkout
   (a dir containing `rust/Cargo.toml`), or this package is itself running
   inside such a workspace.

If **neither** resolves, the runner prints a clear message
(`no omena-lsp-server binary available. Set OMENA_LSP_SERVER_PATH …`) and exits
**0** (advisory skip). It never tries to build the Rust binary itself.

## Declarative expectation-table model

Coverage lives entirely in [`src/scenarios.ts`](src/scenarios.ts) as a table of
`ScenarioCase` rows:

```ts
{
  scenarioDir,   // folder under ../examples/src/scenarios
  opens,         // files to didOpen, each tagged role: source | style | context
  requests,      // definition / hover / codeLens, anchored by text snippets
  expect,        // definition / hover / diagnosticsEmpty / codeLensReferenceCount
}
```

- **Anchors, not line numbers.** Request positions and expected style ranges are
  located by searching for a text snippet (`anchor` + `token`) in the file, so a
  row stays correct even if the scenario's line numbers shift.
- **Expected ranges are computed**, not literal — the same harness helpers
  (`positionInText`, `styleRange`) that build the request also build the
  expectation, against the live file text.
- **Easily extensible:** add a `ScenarioCase` to promote any onboarding scenario
  to a regression case. See the in-file `TO ADD A SCENARIO` comment.

### Seeded scenarios

The table is seeded with the single case the monorepo regression script already
covers:

| `scenarioDir` | role of `06-alias` | checks |
|---|---|---|
| `12-nested-style-facts` | opened as a **context** document (seeds the workspace index, exactly as the monorepo script does) | 3 definitions (`wrapper`, `&--primary`, `&__icon`), 1 hover (`type-card` markdown facts), empty source diagnostics, 10 codeLens reference counts |

`06-alias` is currently only an opened context document. To make it its own
regression case, add a `ScenarioCase` with `scenarioDir: "06-alias"`.

## Source layout

| File | Role |
|---|---|
| [`src/harness.ts`](src/harness.ts) | Pure LSP-stdio helpers (`frame` / `readFrames` / `positionInText` / `styleRange` …), lifted **verbatim** from the monorepo script. No scenario knowledge. |
| [`src/resolve-binary.ts`](src/resolve-binary.ts) | Rust-binary resolution (env-injected prebuilt preferred, `cargo run` fallback). |
| [`src/scenarios.ts`](src/scenarios.ts) | The declarative expectation table. |
| [`src/run.ts`](src/run.ts) | The runner: load → frame → spawn → parse → assert. |

## Pre-genesis caveat

Before genesis (no published or prebuilt `omena-lsp-server`, and no monorepo
checkout), **this test cannot actually run** — and that is fine. `pnpm test`
will print the "no binary available" message and exit 0 (advisory skip), while
`pnpm typecheck` stays green. Real execution begins once a binary can be
injected via `OMENA_LSP_SERVER_PATH` (a shipped/prebuilt server) or the monorepo
is present for the `cargo run` fallback.
