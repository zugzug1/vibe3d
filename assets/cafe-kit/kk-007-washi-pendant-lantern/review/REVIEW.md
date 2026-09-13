# kk-007 Washi pendant lantern — bounded repair
Status: repaired source, final preview inspected; user acceptance pending.
Coordinator subsequently exported/reimported the GLB (454940 bytes), inspected
the close view, and captured source/GLB gameplay views. Shared 277-test gate and
direct seven-model TypeScript check pass. User acceptance remains pending.

Exact meter envelope: 0.60 W × 0.60 D × 0.50 H. Public mount/shade/ribs anchors and root placement remain stable.
Paper and ribs share a truncated ellipsoid with the required sqrt(1-t*t) cross-section. Rolled collars lap the paper cut edges; a socket bridge supports the cord above the open shade. The repair seam follows the same surface.

Captured and viewed the actual reference, rejected render, early source iteration 003, and final iteration 004 (createPreview, existing kit rig). No score loop, topology build, GLB export or commit.
Final preview: .asset-forge/previews/kk-007-washi-pendant-lantern/iteration-004/beauty.png

Validation: ray probes compare all rib radii and seam samples with the actual triangulated paper at rib counts 8/12/18; exact bounds and the 15k budget are asserted. Shared ownership, placement, override and dispose tests pass. Coplanar heuristic passes.
Approximation: no floral ink, rivets, interior bulb or electrical simulation. The open collar/bridge is deliberately simpler than the reference's covered upper fitting.
