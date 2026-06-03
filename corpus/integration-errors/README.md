# integration-errors

Checker **integration oracles** — real-project `.tsx` + `.module.scss`/`.less`
snippets that exercise the omena-css checker's diagnostic surface end to end.

COPIED (point-in-time **2026-06-03**) from the omena-css monorepo:

| subdir | monorepo source | files |
|---|---|---|
| `real-project-corpus/` | `test/_fixtures/real-project-corpus/` | 10 (4 scenarios) |
| `real-project-checker-corpus/` | `test/_fixtures/real-project-checker-corpus/` | 5 |

## How they are driven upstream

In the monorepo each scenario is fed to the checker CLI **argv-driven with
`--preset ci`** and asserted on **exit code** (pass/fail), e.g.:

```
cme-checker --preset ci \
  test/_fixtures/real-project-corpus/ButtonVariants.tsx \
  test/_fixtures/real-project-corpus/ButtonVariants.module.scss
```

The scenario list lives in `scripts/real-project-corpus.ts` and is run by
`scripts/check-real-project-corpus.ts`. The fixtures here are the **data only**;
the driver scripts are NOT lifted (they are crate/CLI-coupled harness, not
portable corpus).
