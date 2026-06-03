/**
 * Pure LSP-stdio harness helpers.
 *
 * These are lifted VERBATIM from the monorepo source
 * `scripts/check-rust-omena-lsp-server-examples-regression.ts`
 * (frame / readFrames / positionInText / styleRange-family / positionForOffset).
 * Keep the bodies byte-identical so the generalized runner stays a faithful
 * superset of the hard-coded monorepo regression.
 *
 * No external deps: just `node:assert`. The harness knows nothing about which
 * scenarios exist — it only frames JSON-RPC, parses framed responses, and
 * computes text positions/ranges. The scenario knowledge lives in
 * `scenarios.ts` (the declarative expectation table).
 */
import { strict as assert } from "node:assert";

export interface Position {
  readonly line: number;
  readonly character: number;
}

export interface Range {
  readonly start: Position;
  readonly end: Position;
}

/** Encode a JSON-RPC value as an LSP `Content-Length`-framed message. */
export function frame(value: unknown): string {
  const body = JSON.stringify(value);
  return `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
}

/** Parse a concatenated stream of `Content-Length`-framed LSP messages. */
export function readFrames(stdout: string): any[] {
  const parsedFrames: any[] = [];
  let offset = 0;

  while (offset < stdout.length) {
    const headerEnd = stdout.indexOf("\r\n\r\n", offset);
    if (headerEnd < 0) break;
    const header = stdout.slice(offset, headerEnd);
    const match = /^Content-Length:\s*(\d+)$/imu.exec(header);
    assert.ok(match, `missing Content-Length in response header: ${header}`);
    const length = Number(match[1]);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + length;
    assert.ok(bodyEnd <= stdout.length, "incomplete response body");
    parsedFrames.push(JSON.parse(stdout.slice(bodyStart, bodyEnd)));
    offset = bodyEnd;
  }

  return parsedFrames;
}

/**
 * Position of (the middle of) `token`, searched for AFTER `anchor`, in `text`.
 * Used for source-document request positions (definition/hover land mid-token).
 */
export function positionInText(text: string, anchor: string, token: string, fromIndex = 0): Position {
  const anchorStart = text.indexOf(anchor, fromIndex);
  assert.notEqual(anchorStart, -1, `missing anchor ${anchor}`);
  const tokenStart = text.indexOf(token, anchorStart);
  assert.notEqual(tokenStart, -1, `missing token ${token} after ${anchor}`);
  const offset = tokenStart + Math.floor(token.length / 2);
  return positionForOffset(text, offset);
}

/**
 * Start position of `token`, searched for AFTER `anchor`, in `text`.
 * Used to build the EXPECTED definition/codeLens ranges in a style file.
 */
export function rangeStartInText(text: string, anchor: string, token: string, fromIndex = 0): Position {
  const anchorStart = text.indexOf(anchor, fromIndex);
  assert.notEqual(anchorStart, -1, `missing anchor ${anchor}`);
  const tokenStart = text.indexOf(token, anchorStart);
  assert.notEqual(tokenStart, -1, `missing token ${token} after ${anchor}`);
  return positionForOffset(text, tokenStart);
}

/** Full `[token.start, token.start + token.length)` range of a style token. */
export function styleRange(text: string, anchor: string, token: string): Range {
  const start = rangeStartInText(text, anchor, token, 0);
  return {
    start,
    end: {
      line: start.line,
      character: start.character + token.length,
    },
  };
}

/** Translate a flat character offset into an LSP {line, character} position. */
export function positionForOffset(text: string, offset: number): Position {
  const before = text.slice(0, offset).split("\n");
  return {
    line: before.length - 1,
    character: before.at(-1)?.length ?? 0,
  };
}
