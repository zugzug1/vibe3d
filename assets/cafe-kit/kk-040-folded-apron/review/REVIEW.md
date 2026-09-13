# kk-040 Folded apron

reference: images/kk-040.png · manifest target 0.35 × 0.30 × 0.05 m · built 0.329 × 0.272 × 0.079 m
iterations: inherited pilot baseline plus one bounded cloth-read pass; no new visual approval claimed

## reads correctly

- Folded indigo apron bundle with layered cloth, bib, paired patch pockets, standing neck loop, waist ties,
  and optional brass slider.
- The neck loop intentionally carries the silhouette above the folded bundle instead of collapsing into a
  short towel-like block.
- Reduced pocket proud depth and made the existing cloth swell less regular and more asymmetric; no vertices,
  triangles, or outer silhouette budget were added.

## dimensional investigation

- The 0.079 m height is intentional, not an accidental measurement drift. The 0.05 m manifest target leaves
  only roughly a 2 cm loop stub and loses the defining standing-loop read; the source therefore keeps a
  sagged loop and a 0.079 m overall envelope.
- Width 0.329 m and depth 0.272 m remain within the manifest target's ±20% envelope. Height is the only
  warned dimension and is an accepted, source-documented silhouette override; do not reduce it without a
  fresh reference comparison.

## approximations and open visual status

- Topstitching is omitted as drawn detail; pocket steps carry the pocket read within the storytelling budget.
- Underside, back of bib, and hidden tie routing are plausible reconstructions from the single reference.
- Existing `review/qa-sheet.png` is retained as evidence; this pass does not claim fresh visual approval.

## materials and budget

- `cloth` uses vertex-coloured faded indigo; `hardware` uses brass.
- 1296 triangles / 2000 storytelling budget; inventory passes with no breach.

## gates

- Inventory: pass.
- Topology sidecar: present and inherited from the pilot baseline.
- Coplanar checker: 11 real component bounds inspected, all clean; heuristic only, not a proof.
- Visual QA: pending coordinator review.
- Latest review finding addressed: the stacked layers now use shallower, less mechanically even folds and
  thinner pocket edges; a fresh render is still required to verify the cloth read.

## open

- Preserve the 0.079 m height override unless a new visual review demonstrates that the reference's loop is
  materially shorter.
- The coplanar result does not replace a visual inspection or detailed geometric review.
