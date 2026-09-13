# kk-038-gooseneck-kettle — bounded correction handoff

Status: source frozen after one critic correction pass; coordinator owns final capture/acceptance.
Initial Luna score: 77/100 (pre-correction, not a new acceptance score).

Reference: /Volumes/zug1/kyoto-kat-kit/v1/images/kk-038.png.
Inspected initial contrast capture: .asset-forge/previews/kk-038-gooseneck-kettle-contrast/latest.png.
Original W × D × H: 0.26 × 0.15 × 0.22 m. Storytelling ceiling: 2,000 triangles; current runtime: 1488.

## Correction

Modestly brighter owned iron, roughness 0.55 and metalness 0.35 for spout readability. Follow-up repair adds per-triangle UV projection to the custom spout, retaining normals, silhouette and triangle count. All mapped meshes now have finite UV coordinates; spout UV triangles have positive area. No materials removed or caller-owned resources modified.

## Physical evidence

CPU rays pass through the actual spout tip and body socket; handle clearance ray is unobstructed. Two seated mounts bridge timber to the body. Vessel floor is 10 mm; removable lid reveals the cavity.

## Checks

- Three local tests pass: dimensions/nondegenerate triangles, configuration/resource ownership, actual cavity/contact checks.
- Nine scoped shared runtime contract tests pass, including caller material ownership and active slot substitution.
- Per-model TypeScript check passes.
- Scoped topology gate passes; on-disk .vtopo bytes decode and validate without errors.
- Compiled topology reports manifold=true, declared-open boundaries, one LOD, collision indices, and no AABB hull fallback. This is not a claim of a single watertight union.
- Shared coplanar checker reports clean at its default 0.02 m² threshold; it is a bounds heuristic, not exact proof of every small surface.
- No shared changes, commits, GPU renders, browser captures, or exports performed by this worker.

## Remaining approximations

Faceted eight-sided spout and simplified forged timber handle suit the 2,000-triangle ceiling. The wall port is cut through both skins and concealed inside the spout flange, not a boolean-unioned manufacturing mesh.

Final post-correction visual confirmation remains with main. No baked shadows or lighting added.
