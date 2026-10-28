# Seeded population and reaction experiments (PP-101)

The `stochastic-ssa@1.0.0` capability supports a finite registry of integer-count models through the existing source-linked representation lifecycle. It complements deterministic dynamics; it does not reinterpret an ODE trajectory as random measurement data. JSON selects a registered model, assumptions, counts/rates, observation grid, replicate streams and bounded work settings. It cannot supply code, propensity expressions or arbitrary stoichiometry.

The supported models are independent first-order losses (`pure-death`) and a conservative finite two-state pool (`two-state-pool`). The latter is equivalent to reversible unimolecular conversion at fixed total population. Negative/fractional counts, incompatible rate semantics, missing assumptions and excessive resources fail before work. Counts are not inferred from concentration without a declared conversion.

## Randomness and summaries

Direct SSA samples a waiting time from the total propensity, chooses a registered event and updates integer counts. Zero propensity is absorbing. Observation times do not consume random numbers and never change the underlying event history; samples use the declared right-continuous convention. Jumps are drawn as steps, without linear interpolation.

This adapter uses its own versioned PCG32 stream implementation, with upstream known-answer vectors, pinned source/license attribution and explicit integer-to-uniform mapping. PP099’s generated-figure replay stream does not supply randomness to this scientific adapter. PRNG vectors establish implementation compatibility, not cryptographic security, biological validation or a theorem of replicate independence. Floating-point logarithms limit cross-engine bit-for-bit event-time guarantees.

Individual runs, empirical means, sample standard deviations across replicates and analytic expectations have distinct roles. Sample SD describes between-run spread. Estimated Monte Carlo standard error describes estimation of the mean under a stream-independence approximation. Neither is measurement error, parameter uncertainty or automatically a confidence interval. With one replicate, sample SD/SE are unavailable. Summaries must not discard expensive incomplete runs and present the remainder as an unbiased ensemble.

## Biological source mapping

The development example refers to Hodgkin–Huxley (1952), gating equation (7), printed p. 518. Its source card identifies a transcribed equation separately from an authored finite pool of independent gates at fixed rates/voltage. Synthetic counts, chosen rates, independence and finite-population variability are added assumptions. No whole-channel `n^4` conductance, physiological current, original voltage-clamp reproduction or clinical prediction is implied. The frozen corpus is unchanged.

Primary-source admission, independent binomial references, PRNG pin/license and design limitations are in [the research note](stochastic-adapter-research.md). ## Versioned execution and work budgets

The solver is `ssa-direct@1.0.0`, the PRNG port `pcg32-xsh-rr-64-32@1.0.0`, and the uniform mapping `pcg32-u53-open-both@1.0.0`. The mapping combines two raw words into a 53-bit integer, rejects zero, and supplies strictly open uniforms for both waiting time and channel selection. Every active replicate accounts for two initialization advances and all proposal/overshoot/rejection words. An already absorbing process initializes no PRNG and consumes no words.

Each request is at most 64 KiB and each result at most 3 MiB. Population is at most 4,096, with at most 32 replicates and 256 shared observation points; each replicate has at most 10,000 events, the request 200,000 events and one million raw words. The 32,768 scientific-scalar limit counts sampled count values, five summary vectors and two analytic moment vectors; time coordinates and work counters have separate fixed array bounds. Default worker time is three seconds, with host allowance capped at the global 30-second deadline. At most two disposable stochastic workers run concurrently.

Results bind the exact validated request, model, original rate/time units, assumptions, seed and per-replicate sequence selectors. They retain every requested replicate, including partial/not-started ones, and a summary only on the common supported grid prefix. The exported data study preserves the source, request and time selection; the separate ensemble download preserves numerical outputs and versions.

## Verification

TypeScript, 466 deterministic tests and the production build pass. Final axis-label text also passes typecheck/build. Focused tests include the six official PCG32 words at seed 42/sequence 54, full-width integer replay, deterministic inversion/channel/absorbing/overshoot cases, grid and replicate-count stream invariance, independent binomial histograms over 4,096 frozen distinct selectors per model with predeclared six-sigma engineering allowances, partial-initial-pool analytic moments, units/domains/counter validation, censoring rejection and worker lifecycle failures. Passing these checks is not a statistical battery or biological validation.

The native-browser walkthrough, exact export replay hash and desktop/mobile screenshots are recorded in [data/stochastic-browser.json](../data/stochastic-browser.json). No held-out evaluation, paid inference, human study or release change is part of this issue.
