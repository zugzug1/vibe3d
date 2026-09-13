# kk-036-coffee-bean-jar — bounded correction handoff

Status: source frozen after the follow-up cylinder acceptance-blocker repair; coordinator owns final capture/acceptance.
Initial Luna score: 76/100 (pre-correction, not a new acceptance score).

Reference: /Volumes/zug1/kyoto-kat-kit/v1/images/kk-036.png.
Inspected initial contrast capture: .asset-forge/previews/kk-036-coffee-bean-jar-contrast/latest.png.
Original W × D × H: 0.14 × 0.14 × 0.24 m. Storytelling ceiling: 2,000 triangles; current runtime: 1900.

## Correction

Recessed lid plug/shoulder positively seats over the neck gasket. The recaptured 34-bean version failed visually: the recessed cylinder remained exposed. Removed that cylinder entirely. Contents are now 84 elliptical beans sharing one closed 16-triangle geometry, each with two raised lobes flanking a recessed centre seam. No bulk/fill mesh remains. Vessel/lid radial tessellation reduced to fund the extra beans.

## Physical evidence

At four actual shoulder radii, gasket top is 210 mm and lid underside is 209 mm (1 mm seated overlap); plug reaches 205 mm. Eighty radial rays hit beans; every bean vertex stays inside the glass envelope. Eight bottom beans meet the floor. The complete contents group contains exactly 84 meshes and one unique geometry; no cylinder. Local surface rays measure a 4.5 mm ridge-to-seam recess. Dimensions per bean: 20 × 32 × 11 mm.

## Checks

- Three local tests pass: dimensions/nondegenerate triangles, configuration/resource ownership, actual cavity/contact checks.
- Nine scoped shared runtime contract tests pass, including caller material ownership and active slot substitution.
- Per-model TypeScript check passes.
- Scoped topology gate passes; on-disk .vtopo bytes decode and validate without errors.
- Compiled topology reports manifold=true, declared-open boundaries, one LOD, collision indices, and no AABB hull fallback. This is not a claim of a single watertight union.
- Shared coplanar checker reports clean at its default 0.02 m² threshold; it is a bounds heuristic, not exact proof of every small surface.
- No shared changes, commits, GPU renders, browser captures, or exports performed by this worker.

## Remaining approximations

The low-poly beans form a staggered shell and top cluster, not a physically simulated volumetric packing. Glass is one double-sided transparent skin. Reference lid artwork omitted. Runtime has 1,900 triangles; compiled topology has 1,868 after compiler processing, explicitly not identical triangle counts. Final visual acceptance remains unverified by this worker.

Final post-correction visual confirmation remains with main. No baked shadows or lighting added.
