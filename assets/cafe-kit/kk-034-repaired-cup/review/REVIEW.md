# kk-034 Repaired ceramic cup

reference: images/kk-034.png · manifest target 0.10 × 0.10 × 0.10 m · built 0.088 × 0.088 × 0.104 m
iterations: inherited pilot baseline plus one bounded decoration pass; no new visual approval claimed

## reads correctly

- Yunomi silhouette with a held belly, narrowed rim, recessed foot ring, uneven glaze, and a fine raised
  kintsugi seam from the interior through the rim to the foot.
- The body and seam remain separate semantic parts and the seam can be rotated with `seamAngle` or hidden
  with `repaired: false`.
- Added sparse indigo/vermilion ceramic decoration as vertex-color modulation on existing glaze vertices;
  topology and triangle count are unchanged.

## approximations and accepted overrides

- Diameter is 0.088 m rather than the 0.10 m authored target because the reference is visibly taller than
  wide; height is 0.104 m. Both remain within the kit's ±20% dimensional warning envelope.
- The reference's plum-blossom decoration is omitted as dressing outside the brief and triangle budget.
- Underside geometry is a plausible trimmed yunomi foot, not directly visible reference evidence.

## materials and budget

- `body` uses vertex-coloured ivory glaze/bisque/rim flashing; `seam` uses vertex-coloured brass.
- 1770 triangles / 2000 storytelling budget; inventory reports a warning because the asset is within 15%
  of the tier cap, with no breach.

## gates

- Inventory: pass, with the documented triangle-budget warning.
- Topology sidecar: present and inherited from the pilot baseline.
- Coplanar checker: 2 real component bounds inspected, all clean; heuristic only, not a proof.
- Visual QA: existing `review/qa-sheet.png` is retained as evidence; this pass does not claim fresh visual
  approval. Latest review identified missing ceramic decoration; the bounded vertex-color correction is
  pending a fresh coordinator render.

## open

- Run the coordinator-owned targeted test and render commands below before treating this asset as accepted.
- The coplanar result does not replace a visual inspection or detailed geometric review.
