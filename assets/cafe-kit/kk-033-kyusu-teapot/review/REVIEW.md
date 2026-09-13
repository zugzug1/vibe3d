# kk-033 Kyusu teapot

reference: `/Volumes/zug1/kyoto-kat-kit/v1/images/kk-033.png` · manifest target 0.19 × 0.14 × 0.12 m
status: coordinator beauty and gameplay renders self-checked; no user acceptance claimed

Viewed the actual reference and rejected latest preview before editing. The rejected
shape read as angular plumbing: straight tapers, sparse belly profile, flat lid
transitions and incomplete handle lip. Rebuilt the rounded vessel with an interior,
seated domed lid, waisted knob, curved rising spout, and flared hollow handle with a
continuous returning lip. Ordered local profiles retain inner walls and remove pole
degeneracies. The +X handle / +Z spout arrangement is perpendicular in plan; the handle can be mirrored.
Shared ceramic, moss, brass, and deep-glaze slots separate the major material reads without adding textures
or branding.

Runtime parts are `body`, `lid`, `spout`, and `handle`. `lid` and `handleSide` rebuild in place while keeping
the root and semantic groups stable. Hidden underside and internal tea strainer details are plausible
reconstructions omitted at the storytelling budget.

Measured W × D × H: 0.1661 × 0.1513 × 0.1230 m. Inventory: **1878 / 2000 triangles**,
12 meshes, four existing material slots. No palette changes or baked lighting/ink/cel effects.
Names remain prefixed after configuration rebuilds; disposal is idempotent.

Validation: `bun test assets/cafe-kit/kk-033-kyusu-teapot/axial-spout.test.ts`:
3 pass, 0 fail. Coverage includes updated spout winding for both handle settings,
finite/nondegenerate triangles, budget, stable runtime anchors, names, configuration
and consumer material ownership. `node --import tsx scripts/coplanar-check.ts
kk-033-kyusu-teapot`: 12 inspected parts, clean. Its 0.02 m² threshold and bounds
heuristic are coarse at this scale, not proof for every small surface.

Approximations: regular rotational ceramic profiles, omitted painted blossoms,
landscape and mottling, omitted strainer. Existing brass trim approximates brown
ceramic edges. This rebuild addresses silhouette and construction, not the
reference's illustrated finish. Dimensions remain approximate against the manifest.

Viewed coordinator evidence at `.asset-forge/previews/kk-033-kyusu-teapot/latest.png`
and `.asset-forge/previews/kk-033-kyusu-teapot-gameplay/latest.png` against the actual
reference. Beauty shows a rounded belly, seated lid/waisted knob, rising tapered
spout with dark opening, and continuous flared handle lip. No clear new floating
parts, missing lip sectors or exposed surface holes are visible from this view.
Remaining silhouette gaps: spout root and knob crown are visibly faceted, the
handle cavity reads shallow/light, and the lid is narrower relative to the belly
than the reference. Plain uniform glaze is a substantial likeness limitation.

Gameplay evidence renders the prop only about 45 pixels wide: body, lid and side
attachments remain discernible, but it cannot establish small join/lip quality.
No geometry changes or rerender requested after this bounded self-check. Previous
test results and 1878-triangle budget remain applicable. Coordinator retains
topology sidecar ownership; no render was launched here. This review covers the
supplied views, not unseen surfaces, and is not user acceptance.
