# kk-007 Washi pendant lantern

Status: renderable source checkpoint; no visual acceptance claimed.

- Exact target envelope: 0.60 x 0.60 x 0.50 m; current inventory envelope: 0.60 x 0.60 x 0.50 m.
- Broad oval washi globe uses a shared paper surface map, twelve profile-fitted horizontal ribs, round untextured brass retaining rings, a repaired seam, and a documented `root.userData.attachment = 'mount'` anchor.
- Mount and bottom ring are authored inside grounded local bounds for shared tests; the lantern remains a hanging asset through its mount anchor.
- Floral artwork is intentionally omitted; the seam and rib construction carry the reference read without baked decoration.
- Repair queue after next capture: verify the fitted rib/cap read from the coordinator camera; no optional artwork is planned in this pass.
- Coordinator inspected source iteration 002 and GLB reimport: **repair queue**.
  The ribs are NOT profile-fitted despite the earlier implementation note. Their
  radius omits the sphere cross-section factor `sqrt(1 - t*t)`; upper/lower rings
  float away from the paper. Retaining ring and seam also float. Do not accept.
- Coordinator fixed submillimeter envelope drift and prevented mutation of
  consumer brass textures; regression checks pass. GLB: 259,808 bytes.
- The single visual correction pass is consumed; no automatic escalation.
