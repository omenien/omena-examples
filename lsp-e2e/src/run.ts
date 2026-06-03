/**
 * Generalized omena-css LSP regression runner.
 *
 * Drives the omena LSP **Rust** binary (`omena-lsp-server`) over a pure stdio
 * harness against the onboarding scenarios in the sibling `@omena/examples`
 * package, checking each scenario's row in the declarative expectation table
 * (`scenarios.ts`).
 *
 * Binary resolution PREFERS an env-injected prebuilt binary
 * (`OMENA_LSP_SERVER_PATH`, the same var the monorepo uses) and falls back to
 * `cargo run -p omena-lsp-server` only inside a Cargo workspace. With NEITHER
 * available (the expected pre-genesis state) it exits with a clear message
 * instead of crashing — it does NOT attempt to build the Rust binary.
 */
import { spawnSync } from "node:child_process";
import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  frame,
  positionInText,
  readFrames,
  styleRange,
  type Position,
  type Range,
} from "./harness.ts";
import {
  OMENA_LSP_SERVER_PATH_ENV,
  resolveOmenaLspServer,
  type Invocation,
} from "./resolve-binary.ts";
import {
  SCENARIOS,
  type ExpectSpec,
  type OpenSpec,
  type RequestSpec,
  type ScenarioCase,
} from "./scenarios.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
/** lsp-e2e/src -> lsp-e2e -> repo root -> examples/src/scenarios */
const SCENARIOS_ROOT = path.resolve(here, "..", "..", "examples", "src", "scenarios");

function languageIdFor(file: string): string {
  if (file.endsWith(".tsx")) return "typescriptreact";
  if (file.endsWith(".ts")) return "typescript";
  if (file.endsWith(".scss")) return "scss";
  if (file.endsWith(".sass")) return "sass";
  if (file.endsWith(".less")) return "less";
  if (file.endsWith(".css")) return "css";
  return "plaintext";
}

interface LoadedOpen {
  readonly spec: OpenSpec;
  readonly absPath: string;
  readonly uri: string;
  readonly text: string;
}

interface LoadedScenario {
  readonly scenario: ScenarioCase;
  readonly opens: readonly LoadedOpen[];
  readonly source: LoadedOpen;
  readonly style: LoadedOpen;
}

function loadScenario(scenario: ScenarioCase): LoadedScenario {
  const scenarioDir = path.join(SCENARIOS_ROOT, scenario.scenarioDir);
  const opens = scenario.opens.map((spec): LoadedOpen => {
    const absPath = path.resolve(scenarioDir, spec.file);
    assert.ok(existsSync(absPath), `scenario file not found: ${absPath}`);
    return {
      spec,
      absPath,
      uri: pathToFileURL(absPath).href,
      text: readFileSync(absPath, "utf8"),
    };
  });
  const source = opens.find((open) => open.spec.role === "source");
  const style = opens.find((open) => open.spec.role === "style");
  assert.ok(source, `scenario ${scenario.scenarioDir} has no "source" open`);
  assert.ok(style, `scenario ${scenario.scenarioDir} has no "style" open`);
  return { scenario, opens, source, style };
}

function didOpen(open: LoadedOpen): unknown {
  return {
    jsonrpc: "2.0",
    method: "textDocument/didOpen",
    params: {
      textDocument: {
        uri: open.uri,
        languageId: languageIdFor(open.spec.file),
        version: 1,
        text: open.text,
      },
    },
  };
}

function buildRequest(loaded: LoadedScenario, req: RequestSpec): unknown {
  if (req.method === "textDocument/codeLens") {
    return {
      jsonrpc: "2.0",
      id: req.id,
      method: req.method,
      params: { textDocument: { uri: loaded.style.uri } },
    };
  }
  const position: Position = positionInText(loaded.source.text, req.anchor, req.token);
  return {
    jsonrpc: "2.0",
    id: req.id,
    method: req.method,
    params: {
      textDocument: { uri: loaded.source.uri },
      position,
    },
  };
}

function buildMessages(loaded: LoadedScenario, rootUri: string): unknown[] {
  const initializeRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      processId: null,
      rootUri,
      workspaceFolders: [{ uri: rootUri, name: "omena-examples" }],
      capabilities: {},
    },
  };
  const lastRequestId = loaded.scenario.requests.reduce((max, req) => Math.max(max, req.id), 1);
  const shutdownId = lastRequestId + 1;
  return [
    initializeRequest,
    ...loaded.opens.map(didOpen),
    ...loaded.scenario.requests.map((req) => buildRequest(loaded, req)),
    {
      jsonrpc: "2.0",
      id: shutdownId,
      method: "shutdown",
      params: { textDocument: { uri: loaded.style.uri } },
    },
    { jsonrpc: "2.0", method: "exit" },
  ];
}

function responseById(responses: readonly any[], id: number): any {
  const response = responses.find((candidate) => candidate.id === id);
  assert.ok(response, `missing response ${id}`);
  return response;
}

function lastDiagnosticsForUri(diagnosticMessages: readonly any[], uri: string): any[] | undefined {
  for (let index = diagnosticMessages.length - 1; index >= 0; index -= 1) {
    const message = diagnosticMessages[index];
    if (message.params.uri === uri) {
      return message.params.diagnostics;
    }
  }
  return undefined;
}

function referenceTitle(count: number): string {
  return count === 1 ? "1 reference" : `${count} references`;
}

function assertExpectation(
  loaded: LoadedScenario,
  expect: ExpectSpec,
  responses: readonly any[],
  diagnostics: readonly any[],
): void {
  const styleText = loaded.style.text;
  switch (expect.kind) {
    case "definition": {
      const actual = responseById(responses, expect.id).result;
      const expected = expect.locations.map((loc) => ({
        uri: loaded.style.uri,
        range: styleRange(styleText, loc.anchor, loc.token),
      }));
      assert.deepEqual(actual, expected, `definition mismatch for response ${expect.id}`);
      return;
    }
    case "hover": {
      const hover = responseById(responses, expect.id).result;
      assert.equal(hover.contents.kind, "markdown", `hover ${expect.id} is not markdown`);
      for (const pattern of expect.matches) {
        assert.match(hover.contents.value, new RegExp(pattern), `hover ${expect.id} missing /${pattern}/`);
      }
      for (const pattern of expect.doesNotMatch) {
        assert.doesNotMatch(hover.contents.value, new RegExp(pattern), `hover ${expect.id} unexpectedly matched /${pattern}/`);
      }
      return;
    }
    case "diagnosticsEmpty": {
      const uri = loaded.source.uri;
      const finalDiagnostics = lastDiagnosticsForUri(diagnostics, uri);
      assert.deepEqual(finalDiagnostics, [], `expected no diagnostics for ${uri}`);
      return;
    }
    case "codeLensReferenceCount": {
      const codeLenses: readonly any[] = responseById(responses, expect.id).result;
      const range: Range = styleRange(styleText, expect.anchor, expect.token);
      const lens = codeLenses.find(
        (candidate) =>
          candidate.range.start.line === range.start.line &&
          candidate.range.start.character === range.start.character,
      );
      assert.ok(lens, `missing code lens for ${expect.token}`);
      assert.equal(lens.command.title, referenceTitle(expect.count), `wrong code lens title for ${expect.token}`);
      const locations = lens.command.arguments[2];
      assert.equal(locations.length, expect.count, `unexpected location count for ${expect.token}`);
      const locationKeys = new Set(
        locations.map((location: any) =>
          [
            location.uri,
            location.range.start.line,
            location.range.start.character,
            location.range.end.line,
            location.range.end.character,
          ].join(":"),
        ),
      );
      assert.equal(locationKeys.size, locations.length, `duplicate reference locations for ${expect.token}`);
      return;
    }
  }
}

function runScenario(invocation: Invocation, scenario: ScenarioCase): void {
  const loaded = loadScenario(scenario);
  const rootUri = pathToFileURL(SCENARIOS_ROOT).href.replace(/\/$/, "");
  const messages = buildMessages(loaded, rootUri);

  const result = spawnSync(invocation.command, invocation.args as string[], {
    cwd: invocation.cwd,
    input: messages.map(frame).join(""),
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });

  assert.equal(
    result.status,
    0,
    [
      `omena-lsp-server regression failed for ${scenario.scenarioDir}`,
      result.error ? `error=${result.error.message}` : null,
      result.stderr?.trim() ? `stderr=${result.stderr.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  const protocolFrames = readFrames(result.stdout);
  const responses = protocolFrames.filter((message) => "id" in message);
  const diagnostics = protocolFrames.filter(
    (message) => message.method === "textDocument/publishDiagnostics",
  );

  for (const expect of scenario.expect) {
    assertExpectation(loaded, expect, responses, diagnostics);
  }

  process.stdout.write(`  ok ${scenario.scenarioDir} (${scenario.expect.length} expectations)\n`);
}

function main(): void {
  const resolution = resolveOmenaLspServer();
  if (resolution.kind === "none") {
    process.stderr.write(
      [
        "no omena-lsp-server binary available.",
        `Set ${OMENA_LSP_SERVER_PATH_ENV} to a prebuilt omena-lsp-server binary,`,
        "or run inside the omena-css monorepo (set OMENA_CSS_DIR or run from a Cargo workspace).",
        "Pre-genesis this is expected: no binary has been published yet — skipping.",
      ].join("\n"),
    );
    process.stderr.write("\n");
    // Pre-genesis: nothing to run against. Exit cleanly (advisory skip), do NOT
    // attempt to build the Rust binary.
    process.exit(0);
  }

  const { invocation } = resolution;
  process.stdout.write(`omena-lsp-server regression via ${invocation.source}\n`);

  let failures = 0;
  for (const scenario of SCENARIOS) {
    try {
      runScenario(invocation, scenario);
    } catch (error) {
      failures += 1;
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      process.stderr.write(`  FAIL ${scenario.scenarioDir}\n${message}\n`);
    }
  }

  if (failures > 0) {
    process.stderr.write(`\n${failures} scenario(s) failed\n`);
    process.exit(1);
  }
  process.stdout.write(`\nvalidated ${SCENARIOS.length} scenario(s)\n`);
}

main();
