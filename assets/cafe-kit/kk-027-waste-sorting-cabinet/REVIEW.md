# Ready for main capture and critique

Reference inspected: `/Volumes/zug1/kyoto-kat-kit/v1/images/kk-027.png`.
Manifest preserved: furnishing, 0.70 × 0.40 × 0.75 m, 6000-triangle budget.
Default after paw correction: 1428 triangles, 14 meshes. No renderer, browser,
export, or capture used by this worker.

## Paw correction pass — ready for main recapture

Inspected main's `.asset-forge/previews/kk-027-waste-sorting-cabinet/latest.png`
and the original reference. The reported 73-point critique identified real tearing:
toe holes crossed the descending cheek contour and invalidated cap triangulation.
Moved the complete paw pattern 0.11 m rearward into the taller cheek section.
The outer profile, cabinet extents, palette, materials and lighting are unchanged.

`paw-cutouts.test.ts` verifies every sampled hole vertex lies inside the exact
profile used for extrusion, with >6 mm edge clearance and no crossing hole edges.
It inspects actual generated cap triangles on both faces: centroids lie in wood,
edges do not cross contour/hole boundaries, and summed area equals outer profile
minus all five holes. Boundary comparisons allow 1e-7 m Float32 rounding tolerance.
Bidirectional rays pass through every hole and hit retained wood above each one.
All seven 027 tests and its local model typecheck pass after this correction.

Source is frozen for main. Existing `.vtopo` predates this correction and must be
recompiled by main before registry build/capture. No new visual score is claimed.

Primary forms: swept side cheeks with actual paw perforations, curved cat-cut
crest, sorting counter, open paired bays and tapered hollow moss/indigo bins.
Bin handles and mouths are geometry openings with recessed floors and inner walls.
`leftBin` and `rightBin` independently remove bin geometry from stable anchors.
Overrides remain consumer-owned; shared owned cedar supports main's global finish.

Validation: targeted Bun tests and local TypeScript config. Tests check dimensions,
finite non-degenerate triangles, budget, counter/divider clearance, shelf seating,
mouth and handle ray paths, interior/exterior winding, crest cutout, configuration,
attachments, and geometry/material/texture disposal.

Coplanar CLI exits 1: two 0.109 m² **bounding-box** warnings pair each separate front
with its three-wall shell at z.max = 0.153. The shell has no front-facing sheet:
that bound comes from the front edges of its side walls. Ray tests pass through
the handle to the recessed back. Front ends are mitered into side walls to avoid
overlaid exterior end caps. The shared checker and its thresholds are unchanged;
its nonzero result is retained.

## Completed front/shell join investigation

`bun test assets/cafe-kit/kk-027-waste-sorting-cabinet/joins.test.ts`
compares the actual world-space triangle pairs using plane/normal tests followed
by convex polygon clipping (plane tolerance 1e-7 m, area cutoff 1e-10 m²).
For **each bin**:

- Zero triangles from either mesh lie wholly on the flagged z = 0.153 m plane.
  Their common z maximum is an edge bound, not a shared front sheet.
- Same-facing coplanar overlap on exposed front/side/back walls: **0 m²**.
- Two triangle-pair overlaps total **0.001200001 m²**, all on the horizontal
  underside at y = 0.105 m. They are against the support shelf, not exposed walls;
  downward-offset vertices are checked inside the shelf, past its edge bevel.
- All four outer front edge endpoints match the shell endpoints within 1e-7 m.
  Both joins are straight segments between those endpoints, so they make continuous
  contact rather than floating. Front end faces are mitered into the sidewalls.

This establishes disjoint exposed coplanar surfaces for the **specific flagged
front/shell pairs**, within stated tolerances. It is not a whole-model manifold,
intersection, or visual certification. No geometry changed during this investigation.

Approximations pending visual critique: bin corners/rims are square rather than
fully rounded; side cheeks use a simple extrusion, and the low apron is straight.
No scratches, fake cel shadows, labels, or hidden mechanism detail were added.
No visual acceptance score or topology/GLB artifact is claimed.
