# PP-086 scientific corpus source brief

Primary sources checked 28 October 2026. This is a proposed manifest of exactly 12 papers: four biology, four physics and four computer science. It records planning judgments, not completed scientific reproductions, model evaluations or participant studies. No full papers, figures, datasets or model weights are added by this brief. Titles and author metadata below are bibliographic records; there are no prose quotations.

Representation levels below are proposed scope: **explanation** links concepts to source passages; **illustration** uses explicitly synthetic inputs; **reproduction candidate** requires specified source inputs and independent checks before any reproduction claim. A working illustration does not validate the paper.

## Biology

### B1 — Hodgkin–Huxley (development; empirical and mathematical)

**A quantitative description of membrane current and its application to conduction and excitation in nerve** — A. L. Hodgkin; A. F. Huxley (1952). DOI: `10.1113/jphysiol.1952.sp004764`. Canonical [publisher record](https://onlinelibrary.wiley.com/doi/pdf/10.1113/jphysiol.1952.sp004764); [archived original article](https://pmc.ncbi.nlm.nih.gov/articles/PMC1392413/). Pin the 1952 article, not the publisher's separately listed 2019 modern-convention supplement; no arXiv version identified.

Locator: Figure 1, printed p. 501, parallel membrane circuit. The preceding page 500 introduces the figure; the circuit and caption appear on page 501, verified in the [original published article scan hosted by NJIT](https://web.njit.edu/~matveev/Courses/M430_635_F15/HodgkinHuxley_JPhysiol-1952.pdf) (PDF page 4, counting its two cover pages). Concept: capacitive and ionic current contributions. Proposed scope: source-linked circuit explanation and bounded voltage/gating illustration. Requirements: declared original voltage sign convention, conductance/rate equations, temperature, initial state, stimulus and ODE step policy. Omissions: original squid preparation and voltage-clamp measurements; numerical trajectories alone do not replicate experiments. Rights: publisher states © 1952 The Physiological Society; general redistribution permission is not established here.

### B2 — Turing (development; theoretical; cross-domain biology/physics)

**The Chemical Basis of Morphogenesis** — A. M. Turing (1952). DOI: `10.1098/rstb.1952.0012`. Canonical [publisher URL](https://royalsocietypublishing.org/doi/10.1098/rstb.1952.0012); inspected [original paper scan hosted by Cambridge](https://www.damtp.cam.ac.uk/user/gold/pdfs/teaching/turing1952.pdf). Published 14 August 1952, volume 237, pp. 37–72; no arXiv version identified.

Locator: opening model discussion, printed pp. 37–38. Concept: reaction and diffusion can destabilize spatially uniform chemical states. Proposed scope: mechanism explanation, then a clearly declared illustrative reaction–diffusion field. Requirements: chosen reaction functions, diffusivities, spatial geometry, boundary conditions, perturbation seed and bounded integrator. Omissions: growing tissue mechanics and organism-specific validation; generic spots do not reproduce a biological experiment. Rights: inspected scan carries JSTOR usage restrictions; broader reuse rights unknown. Publisher endpoint returned an access challenge during this check; the original scan supports content/metadata, rather than a secondary summary.

### B3 — Monocle (held out; empirical and computational)

**The dynamics and regulators of cell fate decisions are revealed by pseudotemporal ordering of single cells** — Cole Trapnell; Davide Cacchiarelli; Jonna Grimsby; Prapti Pokharel; Shuqiang Li; Michael Morse; Niall J. Lennon; Kenneth J. Livak; Tarjei S. Mikkelsen; John L. Rinn (2014). DOI: `10.1038/nbt.2859`. [Publisher](https://www.nature.com/articles/nbt.2859), [deposited article](https://pmc.ncbi.nlm.nih.gov/articles/PMC4122333/), [bibliographic record](https://pubmed.ncbi.nlm.nih.gov/24658644/); no arXiv version identified.

Locator: Abstract, pseudotemporal ordering of differentiating single cells. Proposed scope: explanation of inferred ordering, with synthetic cells if original data are absent; a source-data analysis is a later reproduction candidate. Requirements: expression matrix, cell/sample metadata, filtering, normalization and ordering procedure. Omissions: pseudotime must not become an observed clock or proof of lineage causation. Rights: redistribution license unknown in this review; PMC access does not itself establish a license. Publisher lists supplementary figures/tables and source code; omitting those from a scenario does not imply they are unavailable.

### B4 — AlphaFold (development; computational; cross-domain biology/CS)

**Highly accurate protein structure prediction with AlphaFold** — John Jumper; Richard Evans; Alexander Pritzel; Tim Green; Michael Figurnov; Olaf Ronneberger; Kathryn Tunyasuvunakool; Russ Bates; Augustin Žídek; Anna Potapenko; Alex Bridgland; Clemens Meyer; Simon A. A. Kohl; Andrew J. Ballard; Andrew Cowie; Bernardino Romera-Paredes; Stanislav Nikolov; Rishub Jain; Jonas Adler; Trevor Back; Stig Petersen; David Reiman; Ellen Clancy; Michal Zielinski; Michalina Pacholska; Tamas Berghammer; Sebastian Bodenstein; Martin Steinegger; David Silver; Oriol Vinyals; Andrew W. Senior; Koray Kavukcuoglu; Pushmeet Kohli; Demis Hassabis (2021). DOI: `10.1038/s41586-021-03819-2`. [Publisher metadata, full roster, Methods and rights](https://www.nature.com/articles/s41586-021-03819-2); pin version of record, 18 August 2021; no arXiv version identified.

Locator: Methods, “Inference regimen.” Concept: separate learned structural inference, confidence scoring, sequence database search and relaxation. Proposed scope: source-linked pipeline explanation, not a local reimplementation. Requirements for actual inference: sequence inputs, database/MSA preparation, trained parameters, exact code/configuration and suitable accelerator resources. Omissions: weights/databases/compute in the planned incomplete scenario; no CASP benchmark rerun. Rights: article CC BY 4.0, subject to third-party credit lines; code, parameters and databases need their own rights checks.

## Physics

### P1 — Lorenz (development; mathematical and computational)

**Deterministic Nonperiodic Flow** — Edward N. Lorenz (1963). DOI: `10.1175/1520-0469(1963)020<0130:DNF>2.0.CO;2`. [Publisher](https://journals.ametsoc.org/doi/abs/10.1175/1520-0469%281963%29020%3C0130%3Adnf%3E2.0.CO%3B2); no arXiv version identified; pin March 1963 article, pp. 130–141.

Locator: Abstract, bounded trajectories and sensitivity to initial states. Concept: nearby initial conditions in a deterministic dissipative model can diverge. Proposed scope: paired-trajectory illustration; reproduction candidate only with matched equations, parameters and numerical policy. Requirements: initial states, parameter values, timestep/integrator, finite duration and convergence checks. Omissions: the full atmosphere and original computations; an attractive orbit does not establish weather predictability. Rights: reuse permission unknown from inspected publisher record.

### P2 — Bell (development; theoretical)

**On the Einstein Podolsky Rosen paradox** — J. S. Bell (1964). DOI: `10.1103/PhysicsPhysiqueFizika.1.195`. [Publisher](https://journals.aps.org/ppf/abstract/10.1103/PhysicsPhysiqueFizika.1.195), [CERN original PDF](https://cds.cern.ch/record/111654/files/vol1p195-200_001.pdf); no arXiv version identified.

Locator: §II, Formulation, equations (1)–(3). Concept: locality assumptions constrain correlations of a hidden-variable model. Proposed scope: assumption/derivation walkthrough and analytic correlation illustration. Requirements: measurement directions, singlet correlation formula, explicit hidden-variable assumptions; optional bounded quadrature for a named toy distribution. Omissions: no experimental Bell test, detector calibration or loophole closure. Rights: publisher labels free to read and © 1964 Physics Publishing Co.; a broad reuse license is not established.

### P3 — Bose–Einstein condensation (held out; empirical)

**Observation of Bose-Einstein Condensation in a Dilute Atomic Vapor** — M. H. Anderson; J. R. Ensher; M. R. Matthews; C. E. Wieman; E. A. Cornell (1995). DOI: `10.1126/science.269.5221.198`. Canonical [Science URL](https://www.science.org/doi/10.1126/science.269.5221.198); metadata independently verified against [authors' institutional record](https://experts.colorado.edu/display/pubid_11127) and [NIST institutional account, bibliography item 1](https://nvlpubs.nist.gov/nistpubs/sp958-lide/html/375-378.html). No arXiv version identified.

Locator: original Figure 2; NIST explicitly identifies its own rendered image as using that figure's data (bibliography note 10). Concept: distinguish the narrow condensate contribution from the thermal distribution. Proposed scope: source-linked observation explanation; synthetic distributions must be marked illustrative. Requirements for reproduction: calibrated absorption measurements, trap/expansion conditions, temperature estimation and analysis protocol. Omissions: raw measurements and apparatus protocol in the planned incomplete scenario. Rights: redistribution permission unknown; Science access was blocked and the institutional record marks closed access. The original article was not fully inspected here; quantitative figure extraction remains an admission check.

### P4 — Entanglement entropy (held out; theoretical)

**Entanglement Entropy and Quantum Field Theory** — Pasquale Calabrese; John Cardy (2004). DOI: `10.1088/1742-5468/2004/06/P06002`; pinned [arXiv:hep-th/0405152v3](https://arxiv.org/abs/hep-th/0405152v3), revised 2 October 2008.

Locator: Abstract, single-interval critical-system result, and version comments. Concept: logarithmic dependence of entanglement entropy on interval length in the stated 1+1-dimensional setting. Proposed scope: assumption-linked derivation/explanation and parameterized single-interval curve. Requirements: central charge, interval length, cutoff convention and additive constant; no empirical dataset is needed for an illustrative curve. Omissions: full field-theory derivation and model-specific numerical verification. Crucial limitation: v3 states that the multi-interval results are generally incorrect; do not present them as supported findings. Rights: [arXiv non-exclusive distribution license](https://arxiv.org/licenses/nonexclusive-distrib/1.0/license.html); no general third-party republication grant inferred.

## Computer science

### C1 — Priority search trees (development; formal and algorithmic)

**Proof Pearl: Purely Functional, Simple and Efficient Priority Search Trees and Applications to Prim and Dijkstra** — Peter Lammich; Tobias Nipkow (2019). DOI: `10.4230/LIPIcs.ITP.2019.23`. [Official publisher record/PDF](https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.ITP.2019.23); pin publisher article dated 5 September 2019; no arXiv version identified.

Locator: Abstract, decrease-key and verified Prim/Dijkstra applications. Proposed scope: synthetic graph/queue trace linked to the algorithm discussion; explanation of the distinction between running a trace and proving correctness. Requirements: small graph, edge weights, deterministic tie policy and bounded queue operations; original Isabelle artifacts are required to claim proof replay. Omissions: full formal verification and original efficiency experiments. Rights: publisher CC BY 3.0. Already prepared in Paperplay; cannot serve as an independent held-out source.

### C2 — Adaptive mergesort (development; theoretical and computational)

**Nearly-Optimal Mergesorts: Fast, Practical Sorting Methods That Optimally Adapt to Existing Runs** — J. Ian Munro; Sebastian Wild (2018). DOI: `10.4230/LIPIcs.ESA.2018.63`. [Publisher](https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.ESA.2018.63); pinned [arXiv:1805.04154v1](https://arxiv.org/abs/1805.04154v1), 10 May 2018. Keep extended arXiv and conference locators separate.

Locator: publisher Abstract, peeksort/powersort and existing runs. Proposed scope: synthetic run decomposition and merge-order/cost illustration. Requirements: input array/run boundaries, stable comparison semantics and operation-count definition; original benchmark inputs/environment for timing reproduction. Omissions: universal runtime superiority and original timing reruns. Rights: publisher article CC BY 3.0; arXiv distribution terms are a separate source-version record. Already prepared in Paperplay; development only.

### C3 — Attention (development; computational and empirical)

**Attention Is All You Need** — Ashish Vaswani; Noam Shazeer; Niki Parmar; Jakob Uszkoreit; Llion Jones; Aidan N. Gomez; Łukasz Kaiser; Illia Polosukhin (2017). Identifier: pinned [arXiv:1706.03762v7](https://arxiv.org/abs/1706.03762v7), revised 2 August 2023; arXiv DOI `10.48550/arXiv.1706.03762`.

Locator: [§3.2.1, equation (1), Figure 2](https://arxiv.org/html/1706.03762v7). Concept: scaled dot-product attention. Proposed scope: tiny explicitly synthetic Q/K/V matrix computation and explanation of masking/normalization. Requirements: declared tensor shapes, softmax axis, finite values; trained weights/tokenization/data and GPU training configuration for translation claims. Omissions: translation quality, full training and learned semantic interpretations. Rights: arXiv perpetual non-exclusive license; source additionally permits attributed figure/table reproduction in journalistic or scholarly works; this is not an unrestricted general content license. Existing Paperplay widget/reference source; development only.

### C4 — Raft (held out; systems algorithm and empirical study)

**In Search of an Understandable Consensus Algorithm** — Diego Ongaro; John Ousterhout (2014). [Official USENIX conference record](https://www.usenix.org/conference/atc14/technical-sessions/presentation/ongaro), [conference PDF](https://www.usenix.org/system/files/conference/atc14/atc14-paper-ongaro.pdf), ATC 2014, pp. 305–319. Canonical identifier: official conference URL, ISBN `978-1-931971-10-2`; the official citation supplies no DOI/arXiv identifier, so those fields must remain unknown rather than invented. Pin this conference edition, not the [separate extended version](https://ongardie.net/pubs/).

Locator: §5, Raft algorithm; conference Abstract separates election, replication and safety. Proposed scope: bounded replicated-log state trace with explicit failures/messages. Requirements: finite nodes, message delivery schedule, terms, logs, randomized-timeout seed, crash/recovery assumptions and safety checks. Omissions: production network behavior, formal proof replay and reproducing the paper's original user study. Rights: USENIX states papers are freely available; broader redistribution license unknown from this record. Repository search found no Raft/Ongaro source in data/lib/docs/shared before this brief; it is a candidate for a genuinely new project case.

## Proposed split and assessment

| Split | IDs | Purpose |
| --- | --- | --- |
| Development (8) | B1, B2, B4, P1, P2, C1, C2, C3 | Exercise dimensional ODE/circuit reasoning, spatial fields, expensive learned pipelines, chaos, assumptions/proofs, graph traces, sorting and tensor shapes. Existing project examples stay here. |
| Held out (4) | B3, P3, P4, C4 | One biology, two physics and one CS case test transfer to inferred biological order, experimental observations, corrected theoretical claims and distributed state. |

Held out means excluded from Paperplay fixtures, templates and prompt development after this split is frozen; it does not mean unseen in model pretraining. Metadata-only intake is not a completed evaluation. A source-admission audit on 28 October 2026 found no prior B3/P3/P4/C4 names, distinctive titles or identifiers in project data, libraries, shared contracts, components, tests, server, scripts or the existing demo corpus; a wider repository text search likewise found none outside this new source brief. Searches included Trapnell/Cacchiarelli/Monocle/nbt.2859/pseudotemporal, Anderson–Ensher/Bose–Einstein/5221.198, Calabrese/Cardy/0405152/P06002 and Ongaro/Raft. This supports project independence at intake, not independence from pretraining. Record source edition/access/hash or explicit absence of stored bytes before evaluation; replace a case if later prior-use evidence appears. Keep paper membership fixed; do not tune prompts on held-out failures and continue calling the same cases untouched.

### Source-admission evidence

These flags describe the locator actually inspected, not a claim to have read every page. `body-locator-inspected` means the cited body passage or figure/caption was available in original article text/scan; `abstract-inspected` means only the original abstract/landing-page text anchors the concept; `metadata-only` means the citation and conceptual topic are verified but the proposed passage still needs admission; `institutional-locator-only` means a first-party institutional record identifies the original locator without our inspection of it. All are metadata/links only in this repository: no paper bytes or source content hashes are stored by this brief.

| ID | Locator admission flag | Evidence and remaining admission limit |
| --- | --- | --- |
| B1 | body-locator-inspected | Original published scan inspected at Figure 1 and printed p. 501; page 500 contains its introduction, not the diagram. |
| B2 | body-locator-inspected | Original paper scan inspected at printed pp. 37–38. Publisher endpoint challenged access; Cambridge hosts the inspected scan. |
| B3 | metadata-only | Publisher-indexed citation/supplement listing and NLM bibliographic record establish identity and pseudotime topic. Proposed Abstract locator still needs direct passage inspection; full article body/figure not inspected. |
| B4 | body-locator-inspected | Publisher-indexed original Methods excerpt, “Inference regimen,” inspected; a subsequent direct publisher request challenged access. Full-paper extraction and figure admission remain unchecked. |
| P1 | abstract-inspected | Original publisher abstract inspected; body equations and figure coordinates are not admitted yet. |
| P2 | body-locator-inspected | Original article text at §II, equations (1)–(3), inspected through an [original scan hosted by UC Davis](https://csiflabs.cs.ucdavis.edu/~gusfield/Bell-paper.pdf); publisher verifies DOI, metadata and copyright. |
| P3 | institutional-locator-only | NIST bibliography note 10 identifies original Figure 2; author institution verifies citation/roster. Original Science Figure 2, data and caption were not directly inspected. |
| P4 | abstract-inspected | Pinned arXiv v3 abstract and correction comments inspected; no body derivation/figure anchor admitted. Primary revision history explicitly confirms 2 October 2008. |
| C1 | abstract-inspected | Official publisher abstract and metadata inspected; its publication-date field explicitly confirms 5 September 2019. No body anchor admitted in this brief. |
| C2 | abstract-inspected | Official publisher and pinned arXiv v1 abstract inspected; no body/benchmark anchor admitted in this brief. |
| C3 | body-locator-inspected | Pinned arXiv v7 HTML §3.2.1, equation (1) and Figure 2 caption inspected. |
| C4 | body-locator-inspected | Official conference PDF §5/§5.1 and Figure 2 summary text inspected; conference edition kept distinct from extended report. |

Exact C1 publication and P4 revision days are retained because the linked primary records explicitly supply them. Admission flags permit scoped explanations now; quantitative reproduction still requires source inputs, permissions and independent checks described above.

Actual assessment needs: stable source anchors; expert-reviewed expected concepts, assumptions and omissions; independent numerical/algorithmic references where execution is claimed; explicit supported/partial/unsupported outcomes; source-faithfulness and rights checks. Report explanation usefulness separately from scientific reproduction, and automated conformance separately from future human judgment. No assessor recruitment, study results or success rates are claimed here. Access challenges for Nature, Royal Society and Science mean full-text anchor admission may require later authorized retrieval; the metadata and stated verification limits must survive into the manifest.

## Deliberately incomplete scenarios

These are input restrictions chosen for evaluation, not claims that the authors failed to release resources.

| Scenario | Deliberately omitted | Required honest outcome |
| --- | --- | --- |
| S1 — B4 AlphaFold | Trained weights, sequence databases and accelerator execution | Explain inference stages and resource gaps; no predicted structure or benchmark success claimed. |
| S2 — B3 single-cell | Expression matrix and cell metadata | Explain pseudotime with a source-linked conceptual view; any toy cells explicitly synthetic; no recovered original trajectory. |
| S3 — P3 condensation | Raw absorption measurements and apparatus/calibration protocol | Explain the reported observation, link original figure, state missing replication inputs; no laboratory reproduction claim. |
| S4 — C3 Attention | Training corpus, trained parameters and training hardware | Compute only tiny synthetic attention examples; no translation/BLEU reproduction claim. |

Cross-domain case: B2 tests whether a biology explanation can reuse dimensional quantities, coordinate axes, a spatial field and a bounded physics-style diffusion adapter while keeping the biological evidence claim separate. B4 independently tests whether the biology/CS boundary exposes compute and input gaps without forcing simulation.
