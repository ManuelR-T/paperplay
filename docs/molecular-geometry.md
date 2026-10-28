# Source-qualified molecular coordinates (PP-103)

`molecular-coordinates@1.0.0` adds a reviewed `molecular-view` over the existing scientific **geometry** asset. It does not add an unrestricted molecular renderer or execute generated code. Parsing is a separate bounded ingestion operation; checked geometry can subsequently be inspected without a GPU, WebGL or worker. Original atomic identities and coordinate distances share the ordinary source, selection, evidence and portable-study contracts.

## Accepted source and interpretation

The bundled example is the actual 49,491-byte PDB 1CRN coordinate file, SHA-256 `42199a30a0701864a2a5cc76cd7f35cc544cd0e65fbcf63e03c166543249b811`: 327 ATOM sites, 46 residues, chain A, one implicit coordinate set, one TER and three unique source CONECT pairs. Attribution and CC0 archive-data rights accompany [the original file](../public/structures/ATTRIBUTION.md). The current entry cites Teeter's water-structure paper; this exact file has no HETATM water sites and does not reproduce that study. The source card quotes actual coordinate records and labels its logical page as a prepared excerpt, not a publisher page.

The adapter accepts a strict ASCII, fixed-column PDB coordinate subset, including explicit MODEL/ENDMDL sets, alternate sites, TER boundaries and explicit CONECT links. Raw atom serials, atom names, residue sequence/insertion codes, blank chain/alternate labels, source lines and original positions are retained. Full source-digest-qualified entity IDs prevent accidental cross-file selection. Molecular metadata is a versioned specialization of geometry, not a seventh asset kind. Its three physical axes describe the three coordinate components of an `[atom, component]` storage array.

Original positions are in ångströms; normalization to nanometres is explicitly `×0.1`. No proximity bonds, bond orders, missing atoms, occupancy-averaged sites, symmetry/assembly expansion, surfaces, ribbons, docking or dynamics are inferred. CONECT means a supplied connection of unknown type/order, and absent CONECT is not proof that no chemical bond exists. A local-file provenance classification is a declaration. B-factors retain Å² semantics; a pLDDT interpretation requires an explicitly predicted model and an explicit declaration, never a filename or numeric-range heuristic.

mmCIF, hybrid-36 identifiers, ambiguous/global multi-model connections, malformed coordinates and unsupported combinations fail with finite diagnostics. Source serial aliases cannot collapse identities. Alternate labels can describe local disorder: showing shared sites plus label A is a site filter, not proof of a complete physical conformer. This adapter deliberately declines a distance between different nonblank alternate labels.

## Execution and limits

Input is limited to 256 KiB, 10,000 lines, 4,096 characters per line, 512 atom sites, 256 residues, eight chains, four coordinate sets and 1,024 explicit connections. Cardinalities are checked before nested schema expansion. Parsing uses a disposable browser worker, at most two concurrent jobs, an eight-second default timeout and a 30-second ceiling. Cancellation, errors, stale replies and timeouts terminate the worker. An unavailable browser worker does not fall back to main-thread parsing.

The host independently checks the input digest, an optional pinned source digest, exact declarations, geometry structure and asset checksum after transfer. A transported JSON object is not a private integrity receipt. Local files are read as bounded bytes with fatal UTF-8 decoding that preserves a BOM for rejection; the original File remains downloadable on failure. The bundled file is also byte-counted and digest-pinned. Failed imports retain the last accepted structure.

Primary format, scientific meaning, library evaluation and dependency decisions are recorded in [the geometry research](geometry-adapter-research.md). This small source-site subset uses application-owned projection code without a new rendering dependency. A more complete molecular representation needs a separately reviewed adapter.

## Reader interactions and evidence

The orthographic point view supports X/Y/Z rotation, XY/XZ/YZ presets, zoom, depth clipping, bounded selected labels and optional dotted source connections. A paginated coordinate table supplies keyboard selection and a graphics-independent fallback. Atom/residue selections expose actual source records and return focus to the quoted coordinate passage. The distance inspector uses original common-frame 3D positions, not projected screen coordinates. It reports Å and nm, exact identities and source binding; displayed numerical precision is not experimental accuracy.

Camera changes preserve entity identity, selection history and scientific input binding. Source, coordinate model and alternate-site filters remain scientific inputs; incompatible selections are rejected or removed. External asset selections are checked against the resolved asset, not merely a syntactically plausible ID. A portable data study preserves checked geometry, source, model/filter, camera and semantic selection. It reopens through **Files & source → Open figure or study**, independently of the paper being read. Measurements and parsing integrity do not promote this illustration to a verified scientific reproduction.

## Verification

The final TypeScript check, 30 molecular tests and production build pass. The complete suite and native-browser results are recorded in [molecular-browser.json](../data/molecular-browser.json). Independent tests cover the genuine fixture, fixed-column identity, scalar meaning, conversion, source pinning, malformed/oversized/unsupported records, model/site separation, checked-asset admission, independent distance arithmetic, rigid transforms, worker cleanup, projection and portable source/selection binding. No model inference, held-out corpus, human evaluation or release work is part of PP-103.
