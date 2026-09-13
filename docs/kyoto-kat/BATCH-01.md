# Batch 01 — matcha, feeding, caddy, kyusu

Four models added after Miguel approved the seven pilots. These are production
drafts, not four additional visual acceptances. Do not count them as finished.

One independent Luna-medium review (Maxwell) examined all four references and
close renders. Initial resemblance scores: matcha 2/10, feeder 3/10, caddy 5/10,
kyusu 5/10. The original geometry had clear reference mismatches despite passing
runtime tests. One bounded Luna correction pass was requested; no Astra used.

## Repair/approval queue

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

Runtime tests, compiled topology, and registry/export checks establish technical
properties, not resemblance. GLB export success is not target-viewer reimport or
phone performance validation. The batch must not silently advance from draft to
accepted because its tests are green.
