# Batch 01 — matcha, feeding, caddy, kyusu

Four models added after Miguel approved the seven pilots. These are production
drafts, not four additional visual acceptances. Do not count them as finished.

One independent Luna-medium review (Maxwell) examined all four references and
close renders. Initial resemblance scores: matcha 2/10, feeder 3/10, caddy 5/10,
kyusu 5/10. The original geometry had clear reference mismatches despite passing
runtime tests. One bounded Luna correction pass was requested; no Astra used.

## Initial repair/approval queue (before the additional Astra-guided pass)

- kk-002-matcha-station: corrected render reviewed. Overhead frame removed and
  divided tray added, but the whisk remains too tall and broom-like; bowl shape
  and interior shading need refinement. Remains a draft.
- kk-006-feeding-station: corrected render reviewed. Open-legged bench now reads
  correctly, but thin funnel-like bowls lack the reference's rounded glazed rims.
  Remains a draft.
- kk-032-tea-caddy: corrected rounded/stepped lid and trim. Surface treatment is
  still simplified; user visual approval pending.
- kk-033-kyusu-teapot: corrected loop to side handle and seated knob. Corrected
  render still exposes a cut-open-looking handle end and faceted silhouette;
  remains in repair queue. 1,952 triangles leaves little headroom under 2,000.

Do not add decorative complexity before fixing visible construction. Do not bake
the requested game's ink/cel effect into material lighting. Shared PBR materials
remain intentional; reference decoration and surface wear remain simplified.

## Validation boundary

After the correction pass: 112 asset tests pass, zero fail. Topology compilation
succeeds for all eleven existing models. Seven prior pilots remain approved;
these four remain drafts, with 39 collection assets not yet started. The batch's
single critic review and single correction allowance are consumed. Pause broad
production until the recurring ceramic-construction problem is resolved.

## Explicitly authorized additional repair

Miguel subsequently authorized one additional Astra-medium read-only review,
followed by Luna-only repairs of these four drafts. This is a specific extension
of the original allowance, not permission for recurring Astra reviews.

Astra inspected all four reference, close, and gameplay views (12 images), plus
the relevant model/helper source. Its construction findings drive this pass:

- `revolve()` sorts points by height; returning inner-wall profiles require an
  ordered local lathe or explicit mesh. Do not change the shared helper globally.
- Matcha: use a radial 16–20-tine chasen with a 0.13–0.16 m head, 0.10–0.13 m
  diameter and 0.035–0.05 m exposed grip. Seat the bowl on the mat (previous base
  0.22 m versus mat top about 0.149 m); round the lower bowl, add a 4–6 mm lip,
  and close the caddy lids. No invented overhead frame or long antenna.
- Feeder: inset 0.05–0.06 m deep bowls into actual deck openings. Preserve centers
  at ±0.115 m and diameter near 0.20 m. Use broad floors and 4–5 mm rolled rims;
  wood must not intersect the interiors. Retain the open-legged bench.
- Kyusu: the existing tube helper is uncapped and constant-radius. Construct a
  complete outer/inner handle lip with a recessed cavity; bury its root 4–6 mm.
  Put handle/spout approximately perpendicular in plan, recess the spout opening,
  and close the knob crown. Reallocate segments to stay under 2,000 triangles.
- Caddy: preserve the body, raise the circular crown to about 0.022 m, thin the
  square shoulder, and use an approximately 0.080 m square thin paper label.

These are modeling targets inferred from reference images, not measured real
objects. Luna owns only the four asset directories; the coordinator handles
serialized renders, shared checks, exports and integration. Visual approval
remains with Miguel, not the reviewer score or passing tests.

## Integration evidence

The additional pass replaces the returning profiles locally, seats the matcha
bowl, adds the radial whisk, cuts real feeder deck holes, completes the kyusu
handle and knob, and thins the caddy label. Close and gameplay previews are
captured serially. All four have nonzero coplanarity-inspection coverage; the
bounds-based check reports clean, not an exact surface proof.

Coordinator inspection caught reversed winding in the newly authored kyusu
spout. Luna corrected it and added a regression checking outward face normals
for both handle configurations. The final close render confirms the cutaway
appearance is gone; a passing runtime suite alone had not detected it.

Final model budgets: matcha 10,148 triangles; feeder 2,372; caddy 1,288; kyusu
1,872. All are within their category caps. Close render iterations are 003,
003, 004 and 005 respectively. Gameplay views were also inspected: the small
props are recognizable silhouettes but fine detailing is intentionally lost at
the shared distant camera. The knob/rim retain visible low-poly facets up close.

Repair-review archive (local, not remotely accessible):
`/Volumes/zug1/kyoto-kat-kit/pilot-review/batch-01-repair-2026-09-12-v1/README.md`.
Contains all four close/gameplay previews, editable model files, topology,
GLBs and checksums. Sources import shared kit modules from this checkout; this
is not yet a standalone source distribution.

Remaining acceptance limits: simplified wear/decoration, no user approval of
this batch yet, no target-viewer GLB reimport, and no named-phone performance
measurement. Full node typecheck still has the pre-existing F1 unused-variable
and render-headless union-type errors. Some Dawn preview processes crash during
shutdown after writing the image; archive validation decodes PNG pixels and
checks dimensions rather than trusting the emitted success JSON alone.

Runtime tests, compiled topology, and registry/export checks establish technical
properties, not resemblance. GLB export success is not target-viewer reimport or
phone performance validation. The batch must not silently advance from draft to
accepted because its tests are green.
