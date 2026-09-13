# @kyoto-kat/registry

Procedural 1990s Kyoto machiya cat-café furniture and props for Vibe3D and Three.js. Fifty assets in
three tiers — 10 signature pieces, 20 furnishings, 20 storytelling props — built as direct Three.js
source from a reviewed concept reference pack (issue zugzug1/vibe3d#6).

```sh
bunx vibe3d add @kyoto-kat/kk-004-cedar-cat-tower
# or install the complete library
bunx vibe3d add @kyoto-kat
```

## Conventions every model shares

- **Scale and axes.** Metres, Y-up, ground at `y = 0`, bottom-centre origin, the model's front faces
  `+Z`. Hanging and wall-mounted objects document their attachment pivot in the header comment.
- **Palette.** Five tokens (charcoal `#262128`, ivory `#efe4cc`, moss `#788468`, vermilion `#d85645`,
  indigo `#667c9c`) in `kk-core/palette.ts`; every other colour is derived. No hex literals in a model.
- **Materials.** Plain `MeshStandardMaterial` from `acquireKkMaterials()`. No baked directional light, no
  emissive, no per-item lights. The consuming game applies its own cel / ink-outline pass. `glass` is the
  only transparent slot and is single-layer by contract.
- **Budgets.** Signature ≤ 15 000 triangles, furnishing ≤ 6 000, storytelling ≤ 2 000; textures ≤ 1K
  (storytelling ≤ 512), procedural `DataTexture` only. Enforced by `scripts/kk-inventory.ts`.
- **Runtime contract.** `createModel(options)` returns `{ root, parts, materials, getConfig, configure,
  setMaterial, update, dispose }`; `createPreview({ aspect })` is the close-up reference framing and
  `createCafePreview({ aspect })` the gameplay-camera framing. Semantic `parts` are stable across
  `configure`; owned resources are disposed exactly once; consumer-supplied materials never are.
- **Compiled topology.** Every model ships a measured `.vtopo` sidecar (`bun run kk:compile-topology`).

## Provenance

Reference concept images were generated for this project and are not redistributed with the registry;
the registry ships code only (MIT). See `docs/kyoto-kat/PROVENANCE.md`.
