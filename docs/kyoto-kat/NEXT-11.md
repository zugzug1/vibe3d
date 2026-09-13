# Next eleven café-kit models

Authorized after Miguel approved the existing eleven models on 2026-09-12.
Use two Luna-medium builders and one temporary Luna-medium critic per batch.
No additional Astra assignment. Coordinator owns shared edits and rendering.

## Scope and batches

- Batch A: 003 wagashi cabinet, 017 pantry; 005 window bench, 016 cup shelf.
- Batch B: 009 engawa platform, 013 low tea table; 007 lantern, 014 zabuton.
- Batch C: 010 entrance, 015 trolley; 018 washbasin.

Each builder owns only its assigned asset directories. Read the actual reference
before construction; inspect early silhouettes before finishing. One critic pass
and one correction per batch. Repeated defects halt expansion; unresolved assets
remain drafts. Do not overwrite earlier approval archives.

Preserve runtime contracts, palette, physical scale and category triangle caps.
Do not use sorted revolve profiles for returning ceramic interiors; validate
custom winding. Avoid angular per-face material patches intended as glaze wear.
Use narrow timber bevels and real fabric silhouettes, not inflated boxes.

All eleven requested assets begin unstarted. Source, technical validation,
render review, export and user visual acceptance are separate milestones.

## Batch A review

One fresh Luna-medium critic reviewed references and close iteration 002:
003=55/100, 005=38/100, 016=50/100, 017=64/100. Coordinator verified the major
silhouette mismatches. The critic's blanket claim that all materials are absent
is not adopted: shared palette materials and glass are present, though contrast
and transparency reads need improvement. Cats/ivy are not required additions.

One correction pass assigned: glazed showcase side panels and denser pastries;
continuous elevated shoji alcove with usable bench clearance; stepped cup-shelf
silhouette; pantry tracks and visibly recessed open interior. Expansion pauses
until repeated seating/join/silhouette defects are addressed. Tests passing does
not waive these visual requirements.

## Post-correction checkpoint: expansion halted

Coordinator viewed all four corrected close iteration 003 images. The single
correction pass is consumed. These remain drafts, not new visual acceptances:

- 003: glass sides and tray contrast improved; proportions and frame joins remain
  simplified, pastries sparse, and large gaps/occlusion remain near the top tier.
- 005: usable seating restored, but the shoji lattice is hidden behind the paper,
  drawer fronts do not fill their bays, and cushions remain rigid-looking.
- 016: stepped silhouette restored, but crate tops/backs remain incomplete-looking
  and visible overlapping surfaces persist at joins.
- 017: still reads as a solid/ribbed upper panel rather than open slats into a
  visible dark stocked interior; handles remain block-like.

Do not spend more on unrequested model escalation or repeat the same faults in
Batch B/C. Seven of the requested next eleven remain unstarted. Overall count:
11 previously approved, four new drafts, 35 not started. No additional Astra used.

Sources, topology sidecars, GLBs, and close/gameplay previews checkpointed at:
`/Volumes/zug1/kyoto-kat-kit/pilot-review/next-11-batch-a-drafts-2026-09-12-v1/README.md`.
Local archive is not remotely accessible. Passing technical checks do not prove
visual quality; default topology hull selection is not full collision coverage.
Target-viewer reimport and mobile validation remain pending.

## Authorized bench/shelf repair and surface detail

Miguel approved the proposed focused repair: one Astra-low builder for 005/016,
construction first, then reusable exportable material detail. No additional
assets or automatic escalation. The shared surface helper is opt-in for these
two models; approved models retain their material appearance.

Coordinator added a Three GLTFLoader reimport preview path. Its Node adapter
decodes embedded image bytes with sharp, retaining standard glTF geometry,
materials, samplers and texture transforms. External image/buffer requests are
rejected. Regression tests verify actual exported texture pixels and geometry
survive reimport. This is not proof of another engine's rendering or phone fps.

## Bench/shelf repair checkpoint

One Astra-low builder completed the bounded repair. Coordinator inspected final
source close/gameplay captures and exported/reimported close captures. Construction
defects above are addressed; these remain pending Miguel's visual approval.
The retained kit palette is lighter than the reference, with no painted motifs,
reference edge wear, cats or plants. This is not a reference-fidelity signoff.

- 005: 7,048 triangles; GLB 618,864 bytes; 1.61 x 0.56 x 1.42 m envelope.
  Height remains above the original manifest's 0.85 m target, as documented in review.
- 016: 4,716 triangles; GLB 403,440 bytes; 1.00 x 0.25 x 1.20 m envelope.
- Opt-in 128-square color/roughness/normal maps preserve other approved models.
- 176 affected tests pass, registry builds, both topology sidecars regenerate,
  and coplanar bounds checks inspect 76/36 parts. These checks are not full
  collision coverage or exact surface-intersection proofs.
- Export adapter now supports the installed exporter's RGBA channel packing;
  existing tangent preparation also handles MeshStandardMaterial. Tests verify
  real model exports and actual embedded PBR pixels without mutating source geometry.
- Node typecheck has only the five existing F1/render-headless errors.
- Phone performance and other engine viewers remain unverified. No deployment.

Review package (local-only):
`/Volumes/zug1/kyoto-kat-kit/pilot-review/bench-shelf-textured-2026-09-12-v1/README.md`.
Includes source and GLB close/gameplay captures, GLBs, per-asset sources/reviews,
topology sidecars and verified copy checksums. Sources require this repo's shared
modules; the package is not a standalone source distribution.

## User approval and original bench dimensions

Miguel explicitly approved 005 and 016 on 2026-09-12: "approved both. we should
use the original target." Record their repaired appearance as approved at
8968f85; retain that immutable archive. 005 subsequently returns to the original
1.60 x 0.55 x 0.85 m target without changing the manifest or uniformly shrinking
the upholstery. A new lower-frame preview accompanies this requested revision.
016 receives no geometry or material changes.

Original-target bench source and exported/reimported close/gameplay previews were
inspected and archived with 10 verified copies at
`/Volumes/zug1/kyoto-kat-kit/pilot-review/bench-original-target-2026-09-12-v1/README.md`.
The 7,048-triangle GLB is 618,988 bytes. Regression tests assert exact width,
depth and height for all cushion counts, grounded pivot and unit root scale.

Miguel also authorized a bounded Astra-low repair of 003 wagashi cabinet and
017 pantry. Reuse the existing worker and opt-in surface helper; no additional
agents, global palette change or broad production. Coordinator handles the bench,
shared documentation, checks and serialized exports/renders. New cabinet repairs
remain pending visual approval. Overall: 13 appearance approvals, two cabinet
drafts and 35 unstarted models; seven of the requested next eleven stay paused.

## Cabinet repairs ready for user review

One Astra-low worker, two cabinet assets, one refinement pass. 003 has complete
glazed framing, nine seated trays and 36 sweets; 017 has real open slats, stocked
interiors and charcoal-lined recessed pulls. Reused approved surface maps without
changing shared materials or any other approved geometry. Both retain original
manifest envelopes and existing runtime interfaces. Door configurations remain
static visibility controls, not animated sliding mechanisms.

Coordinator inspected exported/reimported close and gameplay captures. Technical
results: 185 affected tests pass, registry build passes, exact dimensions checked
across configurations, coplanar bounds checks pass with 153/70 inspected parts,
and regenerated topology sidecars pass current tests. Node typecheck retains the
five existing unrelated F1/render-headless errors. Default topology selection
does not establish full collision coverage; phone performance remains pending.

- 003: 13,220/15,000 triangles; GLB 904,916 bytes; source close iteration 005.
- 017: 4,320/6,000 triangles; GLB 538,156 bytes; source close iteration 005.
- Both GLBs use embedded standard PBR textures, verified through Three reimport.
- No painted motifs, elaborate pastry wrappers or ink outlines are claimed.

Combined local review archive (005 original target, 003 and 017 repairs):
`/Volumes/zug1/kyoto-kat-kit/pilot-review/cabinet-repairs-original-bench-2026-09-12-v1/README.md`.
Sources require repository shared modules. Local paths are not remote downloads.
New cabinet visuals await Miguel's approval; no new batch starts automatically.

## Approved cabinets and next-seven authorization — 2026-09-13

Miguel approved 003/017 and requested continuation. Fifteen models are now
appearance-approved. Original-height 005 follows his explicit dimensional request.
Next seven proceed as one integration checkpoint, not an automatic merge/release.

- Luna-medium A owns 009 engawa, 013 low table, 015 trolley.
- Luna-medium B owns 007 lantern, 010 entrance, 014 zabuton, 018 basin.
- Existing approved references: 005 for soft fabric and cedar, 016/017 for hollow
  ceramics and material ownership, 003 for stable configuration and fitted parts.
- Each worker reads only its references, manifest entries, required vibe-model
  instructions and suitable approved examples. No copying earlier rejected sources.
- Exact original dimensions, stable anchors, positive geometry, proper outward
  normals, grounded pivots (ceiling mount for lantern), shared portable maps and
  category triangle caps are non-negotiable. Decorative context is not extra assets.
- Coordinator serializes early renders, exports/reimports, runs measurable checks
  and integrates disjoint directories. One temporary Luna critic per completed
  batch, one correction pass; unresolved defects stop expansion and enter repair.
- No Astra/Sol escalation, repeated reviews, new framework or standing validator.
  No promise of first-pass visual acceptance. Model budgets are not phone FPS.

### First timber checkpoint

Coordinator captured 009/013/015 iteration 001. Fresh Luna critic scores were
74/63/55; scores are not acceptance. The coordinator rejected the critic's claim
that the platform step was already rounded: it was still rectangular. One
correction pass targets a rounded step/tatami binding, true end-trestle table
construction, vertical solid caster wheels and forks, and removal of the trolley's
floating cloth block. Original envelopes and approved pale materials remain fixed.

Coordinator also identified transform resets and public-anchor clearing during
rebuild. Shared regression tests now protect consumer placement/attachments for
all seven, and strict dimension assertions replace warning-only drift for this
batch. Registry packaging excludes test/spec sources with a regression test.

### Post-correction timber review and second batch correction

Coordinator inspected corrected source and exported/reimported close previews:
009 now has a rounded step and bound tatami panels; 013 now has two trestle ends
and pegs. Both remain simplified and await Miguel's visual approval. 015 has
vertical wheels but visible gaps at tray/upright and lower wheel-post connections;
it enters the repair queue after its one correction pass. Do not promote it on
the basis of passing geometry or bounds-based coplanar checks.

One fresh Luna critic reviewed 007/010/014/018; scores 60/50/40/60 are not
acceptance. The coordinator rejected the critic's demand for 1254 px captures:
1024 px previews are intentional and image resolution is not the meter envelope.
The single correction pass targets fitted lantern ribs and ceiling hardware,
seated entrance roof, cushion tuft/ties, and connected basin/faucet/towel. No
Astra or Sol assignment was made. Repeated physical-connection failures mean no
expansion beyond these seven until the repair gate is resolved.

### Seven-draft integration checkpoint — 2026-09-13

Both builders have stopped. Final source and GLB close views inspected. 009 and
013 are available for user review, with simplified construction/material detail.
007/010/014/015/018 remain in the repair queue: floating lantern ribs, unsupported
noren rod, hidden cushion details, disconnected trolley supports, and flat-looking
basin interior/towel respectively. See individual REVIEW.md files for evidence.
No new visual approvals are implied: **15 approved, seven new drafts, 28 unstarted**.

Coordinator integration fixes preserve exact envelopes (including submillimeter
lantern/roof corrections), root placement, public attachments and consumer brass
texture maps. 277 affected tests pass; registry builds 24 items from 22 models.
All seven bounds-based coplanar checks pass, which demonstrably does not prove
connected assemblies. Topology sidecars and embedded-texture GLBs regenerate;
default largest-island topology is not full collision coverage. Node typecheck
retains five existing F1/render-headless errors; registry typecheck retains two
existing TS-extension import errors. No claim of clean full-project typechecking.

Source and reimported close/gameplay captures are included. Some earlier timber
capture processes crashed during renderer shutdown after writing PNGs; archive
validation decodes the actual saved pixels. Four later asset capture sequences
completed without those shutdown errors. No phone FPS measurement or other-engine
acceptance; furnished-scene placement still needs integration.

Local review archive:
`/Volumes/zug1/kyoto-kat-kit/pilot-review/next-seven-drafts-2026-09-13-v1/README.md`.
Sources import repository shared modules; this is not a standalone source kit or
a remotely downloadable path. Do not merge, publish, deploy or expand production
while these recurring construction defects remain unresolved.

### All-seven focused repair authorized — 2026-09-13

Miguel rejected the quality of the draft batch and explicitly included 009/013
in renewed repair scope. Neither of those two is accepted. Preserve the immutable
draft archive and all 15 prior approvals; no expansion to the remaining 28.

One Astra-low worker owns 007/010/014/015/018. The coordinator owns the separate
009/013 repair group and integration, without duplicating the worker's work.
No new framework, standing critic, score-chasing loop or automatic escalation.
Renderer ownership is handed off explicitly to keep source captures serial.

Repair priorities are construction and readable material/silhouette, not hidden
detail counts. New 009 tests raycast mat supports and exposed cloth borders; 013
tests check both top-to-trestle contacts and stretcher engagement. Original metric
targets remain authoritative, including the very low 0.30 m total platform height.
All new repaired previews will still require Miguel's visual approval.

### Seven repairs ready for approval

One Astra-low builder completed the five structural repairs; coordinator rebuilt
009/013, with one short Luna-low independent check of that pair. No other model
assignments or repeated scoring loops. Both agents stopped. The independent pair
scores (80/85) are advisory; the step-support concern resulted in an overlapping
riser and more visible feet, not an acceptance claim.

Coordinator inspected all seven final source and reimported GLB close captures.
Lantern ribs/retainers follow the shade; entrance roof, rod and loops are supported;
cushion tuft/seams/ties are exposed; trolley posts/trays/casters are connected;
basin cavity, tap and towel are rebuilt. Platform/table construction is slimmer
and seated. A separate high-angle GLB inspection confirms the basin cavity/drain.
Source iterations: 004 for all except 013 (003). Shared pale palette retained.
Reference artwork, ink contours and fine weathering remain simplified or omitted.

- 277 affected tests pass, including stronger contact and visible-surface checks.
- `bunx tsc -p assets/cafe-kit/tsconfig.repairs.json` directly checks all seven
  sources and passes. Root Node typecheck does not directly include these models;
  its five existing unrelated errors remain. Full-project typecheck is not green.
- Existing registry builds 24 items from 22 models; no new runtime framework.
- Seven fresh topology sidecars and embedded-texture GLBs exported; all seven
  coplanar bounds checks pass. Largest-island topology is not full collision coverage.
- All final close/gameplay source and GLB captures completed without renderer
  shutdown errors. Other-engine compatibility and named-phone FPS remain pending.
- Archive includes local runtime helpers such as cloth.ts, and the extra basin
  inspection image. Shared repository modules are still required for editable source.

GLB bytes by ID: 007 454940; 009 217960; 010 530784; 013 187616;
014 221120; 015 411584; 018 345496.

New local-only package:
`/Volumes/zug1/kyoto-kat-kit/pilot-review/seven-repairs-2026-09-13-v1/README.md`.
Prior rejected archive remains unchanged. Overall status: 15 approved, seven
repaired awaiting approval, 28 unstarted. No merge, release, main push or deployment.
