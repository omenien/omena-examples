/**
 * Resolve how to invoke the omena LSP **Rust** server (`omena-lsp-server`).
 *
 * Targets ONLY the Rust binary — there is no path here to the legacy Node
 * language server. Two sources, in priority order:
 *
 *   1. PREFERRED — an env-injected prebuilt binary at `OMENA_LSP_SERVER_PATH`.
 *      This is the SAME env var the monorepo's
 *      `scripts/omena-lsp-server-invocation.ts` reads, so a standalone consumer
 *      (this repo, pinned to a shipping build via `.omena-version` PRIMARY) can
 *      inject the prebuilt `omena-lsp-server` it downloaded for that pin.
 *
 *   2. FALLBACK — `cargo run -p omena-lsp-server`, used ONLY when a monorepo
 *      Cargo workspace is configured/available. Standalone (post-genesis, no
 *      monorepo checkout) this fallback does not apply: the env var is the path.
 *
 * When NEITHER source resolves we return `{ kind: "none" }` so the runner can
 * print a clear actionable message instead of crashing (the expected
 * pre-genesis state: no published/prebuilt binary, no monorepo).
 */
import { existsSync, statSync } from "node:fs";
import path from "node:path";

/** The exact env var the monorepo uses; reused verbatim for injection parity. */
export const OMENA_LSP_SERVER_PATH_ENV = "OMENA_LSP_SERVER_PATH";

export interface Invocation {
  readonly command: string;
  readonly args: readonly string[];
  /** Working directory for the spawn (the Cargo workspace root, for cargo runs). */
  readonly cwd: string;
  /** Human-readable description of which source resolved, for logs. */
  readonly source: string;
}

export type Resolution = { readonly kind: "ok"; readonly invocation: Invocation } | { readonly kind: "none" };

export interface ResolveOptions {
  /** Defaults to `process.env`. */
  readonly env?: NodeJS.ProcessEnv;
  /**
   * Path to a monorepo Cargo workspace (the dir containing `rust/Cargo.toml`),
   * enabling the `cargo run` fallback. Defaults to the `OMENA_CSS_DIR` env var
   * if set; otherwise the fallback is only used when the cwd itself looks like
   * the monorepo (a `rust/Cargo.toml` exists relative to it).
   */
  readonly monorepoDir?: string;
  /** Working directory the runner is operating from. Defaults to `process.cwd()`. */
  readonly cwd?: string;
}

function isRegularFile(candidate: string): boolean {
  try {
    return existsSync(candidate) && statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function looksLikeCargoWorkspace(dir: string): boolean {
  return isRegularFile(path.join(dir, "rust", "Cargo.toml"));
}

export function resolveOmenaLspServer(options: ResolveOptions = {}): Resolution {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();

  // 1. PREFERRED: env-injected prebuilt binary (the standalone path).
  const explicitPath = env[OMENA_LSP_SERVER_PATH_ENV]?.trim();
  if (explicitPath) {
    const resolved = path.resolve(cwd, explicitPath);
    if (isRegularFile(resolved)) {
      return {
        kind: "ok",
        invocation: {
          command: resolved,
          args: [],
          cwd,
          source: `${OMENA_LSP_SERVER_PATH_ENV}=${explicitPath}`,
        },
      };
    }
    // Env was set but points at nothing usable — treat as unresolved rather
    // than silently falling through to a (possibly absent) cargo workspace.
    return { kind: "none" };
  }

  // 2. FALLBACK: `cargo run -p omena-lsp-server`, only inside a Cargo workspace.
  const monorepoDir = options.monorepoDir ?? env.OMENA_CSS_DIR?.trim();
  const workspaceDir =
    monorepoDir && looksLikeCargoWorkspace(monorepoDir)
      ? monorepoDir
      : looksLikeCargoWorkspace(cwd)
        ? cwd
        : undefined;

  if (workspaceDir) {
    return {
      kind: "ok",
      invocation: {
        command: "cargo",
        args: [
          "run",
          "--manifest-path",
          "rust/Cargo.toml",
          "-p",
          "omena-lsp-server",
          "--bin",
          "omena-lsp-server",
          "--quiet",
        ],
        cwd: workspaceDir,
        source: `cargo run -p omena-lsp-server (workspace: ${workspaceDir})`,
      },
    };
  }

  return { kind: "none" };
}
