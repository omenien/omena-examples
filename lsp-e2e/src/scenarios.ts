/**
 * DECLARATIVE per-scenario expectation table.
 *
 * Each entry is `{ scenarioDir, opens, requests, expect }` so ANY onboarding
 * scenario under `../examples/src/scenarios` can become an LSP regression case
 * just by adding a row here — no new harness code.
 *
 * Seeded with the SINGLE case the monorepo script
 * (`scripts/check-rust-omena-lsp-server-examples-regression.ts`) hard-codes:
 * `12-nested-style-facts` driven with `06-alias` also opened (to populate the
 * workspace index), with its known definition/hover/codeLens/diagnostic
 * expectations inlined below.
 *
 * ── TO ADD A SCENARIO ──────────────────────────────────────────────────────
 *  1. Append a `ScenarioCase` with its `scenarioDir`.
 *  2. List every file to `opens` (role "source" = the .tsx that issues cx(),
 *     role "style" = the .module.scss it resolves into; languageId is derived).
 *  3. Add `requests` (definition/hover/codeLens/...) anchored by text snippets.
 *  4. Add the matching `expect` rows. Expected style ranges/codeLens counts are
 *     computed against the STYLE file's text via the harness helpers — so they
 *     stay correct even if line numbers shift, as long as the anchors hold.
 * ───────────────────────────────────────────────────────────────────────────
 */

/** A file opened via textDocument/didOpen before any requests run. */
export interface OpenSpec {
  /** Path relative to the scenario dir, e.g. "NestedStyleFacts.module.scss". */
  readonly file: string;
  /**
   * "source" = the .tsx issuing cx() calls (request positions resolve here);
   * "style"  = the .module.scss the source resolves into (expected ranges here).
   * A scenario has exactly one "source" and one primary "style"; extra style
   * files (role "context") are opened only to seed the workspace index.
   */
  readonly role: "source" | "style" | "context";
}

/** A JSON-RPC request to issue, anchored by text snippets (not line numbers). */
export type RequestSpec =
  | {
      readonly id: number;
      readonly method: "textDocument/definition" | "textDocument/hover";
      /** Issued against the "source" document. */
      readonly on: "source";
      /** Search anchor + token to locate the request position in the source. */
      readonly anchor: string;
      readonly token: string;
    }
  | {
      readonly id: number;
      readonly method: "textDocument/codeLens";
      /** codeLens is whole-document; issued against the "style" document. */
      readonly on: "style";
    };

/** A single style-token reference (anchor+token located in the style file). */
export interface StyleToken {
  readonly anchor: string;
  readonly token: string;
}

/** Expectations checked after the responses come back. */
export type ExpectSpec =
  | {
      /** Response `id` must be a definition resolving to these style tokens. */
      readonly kind: "definition";
      readonly id: number;
      /** Each location is the full range of a token in the STYLE file. */
      readonly locations: readonly StyleToken[];
    }
  | {
      /** Response `id` must be a markdown hover matching/anti-matching these. */
      readonly kind: "hover";
      readonly id: number;
      readonly matches: readonly string[];
      readonly doesNotMatch: readonly string[];
    }
  | {
      /** The SOURCE document's final diagnostics must equal this (usually []). */
      readonly kind: "diagnosticsEmpty";
      readonly on: "source";
    }
  | {
      /** Response `id` (a codeLens) must report N references for this token. */
      readonly kind: "codeLensReferenceCount";
      readonly id: number;
      readonly anchor: string;
      readonly token: string;
      readonly count: number;
    };

export interface ScenarioCase {
  /** Folder name under ../examples/src/scenarios, e.g. "12-nested-style-facts". */
  readonly scenarioDir: string;
  readonly opens: readonly OpenSpec[];
  readonly requests: readonly RequestSpec[];
  readonly expect: readonly ExpectSpec[];
}

/**
 * The seed table. Currently the one case the monorepo script already covers.
 * Add more `ScenarioCase` entries below to extend coverage.
 */
export const SCENARIOS: readonly ScenarioCase[] = [
  {
    scenarioDir: "12-nested-style-facts",
    opens: [
      // Opened first in the monorepo script to seed the workspace index.
      { file: "../06-alias/Alias.module.scss", role: "context" },
      { file: "NestedStyleFacts.module.scss", role: "style" },
      { file: "NestedStyleFactsScenario.tsx", role: "source" },
    ],
    requests: [
      { id: 2, method: "textDocument/definition", on: "source", anchor: 'cx("wrapper")', token: "wrapper" },
      { id: 3, method: "textDocument/hover", on: "source", anchor: 'cx("item", "type-card"', token: "type-card" },
      {
        id: 4,
        method: "textDocument/definition",
        on: "source",
        anchor: 'cx("item", "item--primary"',
        token: "item--primary",
      },
      { id: 5, method: "textDocument/definition", on: "source", anchor: 'cx("item__icon")', token: "item__icon" },
      { id: 6, method: "textDocument/codeLens", on: "style" },
    ],
    expect: [
      // Definition: cx("wrapper") -> `.wrapper` selector.
      { kind: "definition", id: 2, locations: [{ anchor: ".wrapper", token: "wrapper" }] },
      // Hover: type-card -> markdown with selector, file name, and color fact.
      {
        kind: "hover",
        id: 3,
        matches: ["`\\.type-card`", "NestedStyleFacts\\.module\\.scss", "background: #eff6ff"],
        doesNotMatch: ["Rust opened|document index"],
      },
      // Definition: item--primary -> `&--primary` BEM selector.
      { kind: "definition", id: 4, locations: [{ anchor: "&--primary", token: "--primary" }] },
      // Definition: item__icon -> `&__icon` BEM selector.
      { kind: "definition", id: 5, locations: [{ anchor: "&__icon", token: "__icon" }] },
      // Source document ends with no diagnostics.
      { kind: "diagnosticsEmpty", on: "source" },
      // CodeLens reference counts for every selector in the style file.
      { kind: "codeLensReferenceCount", id: 6, anchor: ".item", token: "item", count: 3 },
      { kind: "codeLensReferenceCount", id: 6, anchor: "&.type-card", token: "type-card", count: 1 },
      { kind: "codeLensReferenceCount", id: 6, anchor: "&.compact", token: "compact", count: 1 },
      { kind: "codeLensReferenceCount", id: 6, anchor: ".body", token: "body", count: 3 },
      { kind: "codeLensReferenceCount", id: 6, anchor: "&.type-inline", token: "type-inline", count: 1 },
      { kind: "codeLensReferenceCount", id: 6, anchor: "&.disabled", token: "disabled", count: 1 },
      { kind: "codeLensReferenceCount", id: 6, anchor: "&--primary", token: "--primary", count: 1 },
      { kind: "codeLensReferenceCount", id: 6, anchor: "&__icon", token: "__icon", count: 1 },
      { kind: "codeLensReferenceCount", id: 6, anchor: ".wrapper", token: "wrapper", count: 1 },
      { kind: "codeLensReferenceCount", id: 6, anchor: ".inner", token: "inner", count: 1 },
    ],
  },
  // NOTE: 06-alias is seeded above only as an opened "context" document (it
  // populates the workspace index for the 12-nested-style-facts case, exactly
  // as the monorepo script does). To make 06-alias its OWN regression case,
  // add a new ScenarioCase whose scenarioDir is "06-alias" with its own
  // source/style opens, requests, and expectations.
];
