# Frozen scientific evaluation

PP-113 separates the twelve-paper intake metadata from actual admitted sources and executed outcomes. The old `scripts/evaluate-corpus.ts` uses the earlier H1/H2/H3 corpus and may download sources without `--live`; it is not this evaluation runner.

## Freeze before admitting reserved content

Commit the complete clean implementation and evaluator first. Then create a new freeze:

```sh
npx tsx scripts/evaluate-scientific-corpus.ts --freeze=/tmp/paperplay-evaluation-freeze.json
```

The manifest records the commit, frozen split, exact corpus editions, capability catalog and application/evaluator/checker/dependency file hashes. It also hashes the active built browser workers, the artifact infrastructure manifest and its exact content-addressed compiler/runtime files; stale worker bundles are excluded. A later code, catalog, split or dependency change invalidates that round. Reports and local admission files can be written without pretending that changed execution code belongs to the old freeze. Fixes after observing outcomes require another labeled round; preserve the original results.

## Explicit local source admission

The runner never downloads a source, loads API credentials, constructs a provider or substitutes intake metadata for original text. An explicit bounded local admission manifest identifies each case, edition, actual inspected locator, source JSON file and original file. Its raw-byte SHA-256 and byte length must match the selected local original. Normalized source fingerprint, admission time after the freeze, attribution and rights scope remain explicit. Hashes establish identity; normalized-text correspondence, locator accuracy and rights are operator declarations rather than independent scientific or legal review.

Do not publish original bytes, unknown-rights text or private attachments in the evaluation report. An abstract, caption or saved excerpt does not establish coverage of the publication's complete argument, figures or experiment. A missing source is a recorded unavailable result with null measurements.

```sh
npx tsx scripts/evaluate-scientific-corpus.ts \
  --freeze-file=/tmp/paperplay-evaluation-freeze.json \
  --admissions=/tmp/paperplay-local-admissions.json \
  --report=/tmp/paperplay-first-offline-report.json \
  --round=first-offline
```

Report and freeze files use exclusive creation: a repeated command cannot overwrite the first round. A later round can identify its parent report SHA-256.

## What this runner measures

For an admitted source, the runner creates an actual host-owned source-guide fallback, checks source-bound coverage and measures complete planning/generated request bodies under the frozen capability policy. It records exact selection receipts and source/anchor hashes. It does not submit those requests.

Generated execution, scientific references, visual layout, accessibility and isolation are explicitly not performed per paper by this offline serialization runner. They must be supplied by actual independent execution or native-browser evidence. Authored adversarial fixtures and fixed numerical references remain separately labeled engineering evaluations, not generated outcomes for a reserved paper. Unknown provider usage stays null; it is not a zero-token measured response. The twelve-case sample cannot establish universal scientific coverage or human usefulness.

## Evidence status

The evaluator infrastructure is tested with authored development inputs, malformed/stale identities, changed code, explicit original-byte admission, aborts and protected first-round files. Source admission and actual frozen outcomes are now recorded in [the first-round results](frozen-evaluation-results.md). The offline runner remains provider-free; the separately authorized live appendix used normal application budget handlers, at most3creates and no repairs.
