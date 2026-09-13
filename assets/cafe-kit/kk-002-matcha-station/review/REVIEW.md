# kk-002 Matcha preparation station — reference rebuild

Reference viewed: `/Volumes/zug1/kyoto-kat-kit/v1/images/kk-002.png`.
Rejected preview viewed before editing: `.asset-forge/previews/kk-002-matcha-station/latest.png`.
Worktree checkpoint: `eb39867`, branch `feat/kyoto-kat-kit`.

## Visual diagnosis

The rejected asset substituted a tall wooden rack and sparse bulb-shaped whisk for the reference's seated ceramic holder and dense split-bamboo chasen. Its shallow bowl, widely spaced mat bars, oversized rails and straight tubular utensil lost the preparation tray's fitted construction. Two caddies crowded the layout; the reference shows one behind the holder.

## Rebuild

- Thin cedar boards, four feet, fitted divider and narrow front compartment; visible corner keys and small vermilion cat inlay.
- Deep thrown bowl with modestly irregular lip, continuous returning interior, solid dished floor and integrated foot seated at the mat's 0.104 m top. Tea extends into the interior wall to close the meniscus.
- Forty outer bamboo strips with inward-curled tips and twenty gathered inner strips. All are capped rectangular sections; a short grip sits inside a closed ceramic holder beneath the split fibres and binding.
- One ceramic caddy with a separate lid and seam, a folded indigo cloth, and a flat bamboo scoop with a curved working end.
- Twenty-seven mat slats and four thin woven bindings.
- Bowl, caddy and lid use coherent ivory ceramic; holder and tea use moss. The failed face-wise glaze mask has been removed. No overlay shells or baked directional shading. Bamboo retains the existing palette colour with dielectric, dry material response instead of metallic brass.

## Runtime and validation

Viewed the coordinator's close and gameplay renders at `.asset-forge/previews/kk-002-matcha-station/latest.png` and `.asset-forge/previews/kk-002-matcha-station-gameplay/latest.png` against the actual reference. The compact whisk/holder silhouette, seated bowl, fitted tray and compartment arrangement read more plausibly than the rejected model. No additional clear floating parts, open shells or assembly breaks are visible in these views. The whisk remains finer and paler than the reference; the caddy and scoop are more occluded in the close camera. At gameplay distance the main assembly reads, while fine bindings and decoration largely disappear.

The close render exposes conspicuous angular ivory/moss triangles and rectangles on the bowl and caddy. This is a failed material treatment, not acceptable ceramic wear. Removed the mask and its material-group machinery, assigning coherent ivory to bowl/caddy/lid while preserving all geometry and the moss holder/tea. **Coordinator rerender required** for both views; the inspected images precede this correction. No render job launched by this worker and no user acceptance or visual approval is claimed.

Measured default: **11,192 / 15,000 triangles**, 15 mesh batches; approximately **0.800 W × 0.553 D × 0.448 H m**. The deliberate height override is documented in the source: forcing the manifest's 0.90 m height would recreate the rejected stretched whisk. Metre scale and bottom-centre datum remain intact.

`bun test assets/cafe-kit -t kk-002`: **12 pass, 0 fail**, rerun after the material correction. Includes existing runtime ownership/configuration and compiled topology tests plus asset-local checks for finite nondegenerate triangles, closed consistently oriented edges, positive signed volume, budget, coherent ceramic/material replacement through all configuration combinations, and consumer-material ownership.

`node --import tsx scripts/coplanar-check.ts kk-002-matcha-station`: **121 inspected parts, clean**, rerun after the material correction at the default 0.02 m² threshold. This remains a bounding-box heuristic, not an exact intersection proof.

`git diff --check -- assets/cafe-kit/kk-002-matcha-station`: clean.

Stable root, tray/bowl/cradle/caddies semantic anchors, configuration names, existing mesh IDs, preview exports and four material slots preserved. Disposal is now guarded against repeated calls; consumer material overrides are never freed. No shared helpers, registry files, commits or other assets changed by this worker. The existing `.vtopo` sidecar was not regenerated; the topology test compiles current source in memory.

## Honest approximations

The reference's mottled ceramic texture and floral painting are omitted in favour of coherent ivory ceramic. Cedar grain, cloth wave print, caddy flowers, tiny foam bubbles, and the full cat/cloud cutout are omitted; the cat is a small enamel inlay. Bamboo strips approximate split fibres without submillimetre fraying. The scene is uniformly oversized relative to household tea utensils to preserve the kit's requested tray footprint; no tall stand is used to satisfy the obsolete height target. Consumer-owned cel/ink styling and the coordinator's lighting/camera remain responsible for the final presentation.
