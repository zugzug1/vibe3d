# kk-030 Exterior menu stand

Status: source frozen after one coordinator-authorized correction pass; corrected capture and acceptance belong to coordinator.

## Reference and datum

- Original: /Volumes/zug1/kyoto-kat-kit/v1/images/kk-030.png.
- Manifest: 0.55 W × 0.50 D × 1.00 H metres; bottom-centre, Y-up, writing face +Z; budget 6,000 triangles.
- Final default source: 1,412 triangles. Panel width 0.32–0.44 m (default 0.40), height 0.50–0.68 m (default 0.60), foot depth 0.36–0.60 m (default 0.50). Frame, roof, rails, panel, clips and support placement rebuild from these dimensions; non-default settings change the envelope.

## Critique and correction

Coordinator reported fresh Luna resemblance score **69/100** on the first contrast capture. Actionable feedback: abrupt roof/post terminations. Coordinator noted grain and charms already visible, so those were retained. No corrected score is claimed.

Replaced protruding block finials with housed post capitals, added a shaped ridge bearing that enters the roof underside without piercing its weather face, and terminated the roof with a continuous seated ridge cap. Existing rafter positions and the exact default top datum are retained. Contacts are tested at every structural corner. The panel stays blank, recessed and clipped; the two ceramic charms remain physically suspended.

## Checks and ownership

- 45 scoped batch tests pass: finite/nondegenerate/outward geometry, defaults, bounded configuration, exact-once ownership, cedar-finish compatibility, supported joints and world-matrix-updated writing-surface ray probes.
- Focused strict TypeScript check passes with --ignoreConfig; coplanar checker clean at its 0.02 m² threshold (bounds heuristic).
- Refreshed local .vtopo: 608 hull triangles, 133 collision triangles; manifold, closed, no AABB fallback, no largest-island pruning. Clips, charms and thin paper excluded as detail; backing remains structural.
- No GPU rendering, GLB export, shared edits or commits by this worker.

## Approximations / remaining review

Roof is one closed pitched weather shell with seated end rafters, not separate overlapping shingles. Charms use plain shared ceramic and metal rings, without the reference's painted blossoms or cord tassels. Writing panel is a replaceable blank surface. Initial contrast capture predates the joint pass; corrected visual acceptance remains with coordinator.

