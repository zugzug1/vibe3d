# kk-026 Cash-register counter

Status: source frozen after one coordinator-authorized correction pass; corrected capture and acceptance belong to coordinator.

## Reference and datum

- Original: /Volumes/zug1/kyoto-kat-kit/v1/images/kk-026.png.
- Manifest: 0.60 W × 0.50 D × 1.05 H metres; bottom-centre, Y-up, front +Z; budget 6,000 triangles.
- Final default source: 3,064 triangles. Counter height 0.60–0.78 m (default 0.68); drawer extension 0–1 (default closed). Non-default height/extension changes the operational envelope.

## Critique and correction

Coordinator reported fresh Luna resemblance score **72/100** on the first contrast capture. Feedback: crank/pull appeared under-supported; improve casing landmark. No corrected score is claimed.

Actual crank seating was verified by ray probes through the housing, boss, flange and axle, and the pull connection by intersecting component bounds. Added a cast enamel mounting boss, brass bearing flange and drawer escutcheon; replaced square display shoulders with a rounded extruded casing. Palette and existing grain were retained. Keys remain physically seated on the sloped deck. The cubby is open storage.

## Checks and ownership

- 45 scoped batch tests pass, including structural extremes, finite/nondegenerate/outward geometry, exact default dimensions, atomic validation, stable root/attachments, material overrides, owned cedar-finish compatibility, contacts and exactly-once disposal.
- Focused strict TypeScript check passes with --ignoreConfig; coplanar checker clean at its 0.02 m² threshold (bounds heuristic).
- Refreshed local .vtopo: 1,140 hull triangles, 250 collision triangles; manifold, closed, no AABB fallback, no largest-island pruning.
- No GPU rendering, GLB export, shared edits or commits by this worker.

## Approximations / remaining review

Readout tiles are blank; mechanical internals are represented by the closed housing. Loose cat/books from the reference are omitted roster dressing. The cast casing uses the shared moss glaze material as enamel, without adding a private palette. Initial contrast image predates the correction; coordinator must capture the frozen source and assess the joins visually.

