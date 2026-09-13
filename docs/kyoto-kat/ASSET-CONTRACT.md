# Kyoto Kat — the asset contract every worker follows

One page. If something here contradicts a habit from another kit, this page wins. The brief is
[`HANDOFF.md`](HANDOFF.md); the roster and per-item dimensions are [`manifest.json`](manifest.json);
the references are `/Volumes/zug1/kyoto-kat-kit/v1/images/kk-0NN.png` (view them over ivory — some
masters keep a transparent backdrop).

## Ownership

- A worker owns exactly its `assets/kyoto-kat/kk-0NN-<slug>/` directories. Nothing else.
- Coordinator-owned, never edited by a worker: `assets/kyoto-kat/kk-core/`, `assets/kyoto-kat/kk-scene/`,
  `assets/kyoto-kat/*.test.ts`, `registries/kyoto-kat/`, `docs/kyoto-kat/manifest.json`, every root
  config and script. If the core is missing something you need, say so in your report with the exact
  helper you want; do not fork a private copy.
- One commit per finished asset, `feat(kyoto-kat): kk-0NN <slug>`, touching only that directory.
  Never push. Never merge. Never rebase.

## Directory

```
assets/kyoto-kat/kk-0NN-<slug>/
  model.ts               # the asset (see contract below)
  catalog.ts             # optional: export const entry = shell('kk-0NN-<slug>', ['hull-mesh-name'], …)
  kk-0NN-<slug>.vtopo    # compiled sidecar, committed: bun run kk:compile-topology -- --only=kk-0NN-<slug>
  review/REVIEW.md       # the record (template below)
  review/*.png           # accepted close-up, café-cam, 8-view sheet, comparison sheet
```
`<slug>` is the manifest name in kebab case, shortened if long (`kk-004-cedar-cat-tower`,
`kk-034-repaired-cup`). The directory name is the model id everywhere.

## model.ts contract

- Line 1 is a `//` header block: `// kk-0NN-<slug> — <one sentence>.` then the datum (manifest
  dimensions, what you changed and why), axes/origin (`Y-up, metres, ground y=0, bottom-centre origin,
  front = +Z`; hanging/wall items: the attachment pivot and `root.userData.attachment = 'ceiling'|'wall'`),
  the semantic parts and any movable part with its pivot, the collider recommendation, and what the
  single reference could not show (hidden sides are your plausible reconstruction — say so).
- Imports: `three/webgpu` only, and `../kk-core/index.ts`. **No hex literal** — colours come from
  `TOKEN`/`DERIVED`/`shade`/`mixToken`. **No `Math.random`** — index-cycled or closed-form variation.
- `createModel(options)` returns `{ root, parts, materials, getConfig, configure, setMaterial, update,
  dispose }` exactly as `assets/f1-prototypes/f1-garage-box/model.ts` does. Materials come from
  `acquireKkMaterials({ overrides: options.materials })`; geometry is freed and the bundle disposed
  through `finishModel(root, bundle, { name: id, geometries })`. Every mesh name starts with the id
  (`finishModel` prefixes for you). Semantic `parts` are Groups that survive `configure()`; a movable
  part sets `part.userData.movable = true` and sits on its real pivot (a door on its jamb, a drawer at
  its face).
- `createPreview({ aspect })` = `createKkPreview(createModel(), { aspect })` (close-up, auto-framed).
  `createCafePreview({ aspect })` = `createKkPreview(createModel(), { aspect, framing: 'cafe' })`
  (gameplay camera: 35°, 4.5 m). Both exported; preview scenery never enters the model root.
- Materials: plain PBR from the bundle. Vertex colours (`geometry.setAttribute('color', …)` +
  `material.vertexColors`) for crevice darkening and wear, in the palette. Textures only from
  `kk-core/textures.ts`, ≤ 1024 (storytelling ≤ 512), and only when a flat colour visibly fails (washi
  fibre, tatami weave, shibori, wood grain). `glass` only where the reference shows glazing, single
  layer. No lights, no emissive, no post-processing, no baked directional shading.
- Budgets (hard, tested): signature ≤ 15 000 triangles, furnishing ≤ 6 000, storytelling ≤ 2 000.
  Guideline: ≤ 3 materials for signature/furnishing, ≤ 2 for storytelling — each material is a draw
  call. Merge static parts per material with `mergeParts`; keep movables separate.
- Reference images are art direction, not construction drawings: correct impossible construction,
  omit contextual cats, make unrelated dressing a separate optional part or leave it out. Note every
  such decision in `REVIEW.md`.

## The loop (vibe-model skill — read `.agents/skills/vibe-model/SKILL.md`, then
`references/fast-loop.md` and `references/modeling-rules.md`, completely, before the first model)

1. Blockout the primary silhouette and major masses from the manifest dimensions. Capture at once:
   ```
   bun run vibe:model preview --module assets/kyoto-kat/kk-0NN-<slug>/model.ts --export createPreview --asset kk-0NN-<slug> --reference /Volumes/zug1/kyoto-kat-kit/v1/images/kk-0NN.png
   ```
2. Before every critique: `node --import tsx scripts/coplanar-check.ts kk-0NN-<slug>` (exit 0, and it
   must not say FAILED TO LOAD).
3. Critique: give a fresh critic (a subagent with no memory of your edits, or your own vision on the
   side-by-side of reference and `beauty.png`) the brief line from the manifest, the reference, and the
   render. Ask for a resemblance score 0–100, what reads correctly, ≤ 3 prioritised fixes, and a
   separate list of modelling errors with locations (floating parts, wrong plane, coincident faces,
   stale extents). Score order: silhouette/proportions → masses and negative space → landmarks →
   material/value read → detail plausibility.
4. Apply the highest-impact fix, recapture, repeat. Stop at ≥ 85, after two plateauing scores, or at
   10 iterations (storytelling: 6). A plateau means change the representation, not grind.
5. Then the kit gates, all green:
   ```
   bun test assets/kyoto-kat -t kk-0NN
   bun run kk:compile-topology -- --only=kk-0NN-<slug>
   bun test assets/kyoto-kat/kyoto-kat.topology.test.ts -t kk-0NN
   node --import tsx scripts/kk-inventory.ts --only kk-0NN-<slug> --check
   bun run vibe:model preview --module … --export createCafePreview --asset kk-0NN-<slug>-cafe
   node scripts/qa-sheet.mjs kk-0NN-<slug> assets/kyoto-kat/kk-0NN-<slug>/review/qa-sheet.png
   ```
   Copy the accepted `beauty.png` (close) and the café capture into `review/`. Look at the 8-view sheet
   yourself: a part floating off its mount or a seam that never closed hides at the hero angle.
6. Write `review/REVIEW.md`, commit the directory.

## REVIEW.md template

```
# kk-0NN <name>
reference: images/kk-0NN.png · manifest target W×D×H · built W×D×H (why, if different)
iterations: N · accepted score: NN · critic: <who/what>
reads correctly: …
approximations / hidden-side assumptions: …
art-direction corrections (impossible construction, omitted cats/dressing): …
parts: <name> (movable? pivot?) …      collider: box | capsule | compound(…) | none (decorative)
materials: cedar, glaze, …             textures: none | tatamiWeave 256 …
triangles: N / budget                  meshes: N
gates: test ✓ topology ✓ coplanar ✓ inventory ✓ qa-sheet ✓
open: anything unresolved
```

## Order of work

Pilots first, then STOP and report (the coordinator puts the five pilots in front of Miguel before
anyone batches): Agent 1 → kk-001, kk-004, kk-008. Agent 2 → kk-011, kk-012. Agent 3 → kk-034, kk-040.
After the go-ahead, the rest of your range in roster order, one finished asset at a time.
