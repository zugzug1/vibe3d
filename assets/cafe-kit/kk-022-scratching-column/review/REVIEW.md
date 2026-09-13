# Technical handoff — one correction pass complete

Reference inspected: `/Volumes/zug1/kyoto-kat-kit/v1/images/kk-022.png`.
Coordinator's first contrast capture inspected at `.asset-forge/previews/kk-022-scratching-column-contrast/latest.png`.
Initial coordinator-provided Luna score: 74. No second critique or acceptance score is claimed.

Manifest: furnishing; 0.45 W × 0.45 D × 0.80 H; 6000-triangle ceiling.
Final triangles: 5688. Dimensions remain within 0.3 mm of the original target.
The source exports typed createModel/configure/getConfig/setMaterial, stable root and
semantic anchors, idempotent disposal, createPreview and createCafePreview.

## Correction
Heavy timber base and seated collars support a tapered core. One continuous helix has 32 turns, a six-sided rope section and warm ivory/cedar-derived sisal color. Pitch is 21.22 mm versus 19.4 mm rope diameter. Both rope end sections are entirely seated inside the timber collars. Toy ball/cord can be removed together. Owned cedar still responds to the shared wood finish helper.

Only active semantic material slots are exposed. Previously the entire acquired kit
bundle exposed unused slots; the central rule-17 test selected an unused slot and found
no mesh. The local slot mapping fixes that mismatch without changing the shared test.
Consumer materials are neither decorated nor disposed; owned maps/materials are freed once.

## Checks and sidecar
- Local dimensions, nondegenerate/finite geometry, budget, configuration, attachments,
  resource lifecycle and relevant opening/contact regressions pass.
- Scoped shared runtime contract gate: 36/36 across these four models.
- Scoped shared topology gate: 4/4; all four sidecar files decode and validate.
- Local model TypeScript check passes.
- Existing coplanar CLI passes at its default 0.02 m² threshold. It remains a bounds
  heuristic, not an exact whole-surface proof.
- Refreshed `kk-022-scratching-column.vtopo`: compiler reports manifold=true, boundaryMode=declared-open,
  no AABB fallback. Assembly catalog overrides retain disconnected components where needed.

## Remaining approximations
Fine twisted fibre strands, loose hairs and the reference tassel remain simplified/omitted. Sisal detail comes from portable surface maps, not thousands of strand meshes. The swept rope has open end rings, buried inside collars; the compiled assembly correctly declares open boundaries.

No worker GPU/browser/capture, shared-file edits, commits, baked shadows or added framework.
Coordinator owns corrected captures and final visual acceptance.

