# kk-046-cat-toy-basket — final bounded handoff

Status: source frozen after the requested correction pass. Main recaptured the corrected contrast image and reported no further visual requests. Ready for coordinator export; no new critic score is claimed.

Initial Luna score: 44/100. Original reference: /Volumes/zug1/kyoto-kat-kit/v1/images/kk-046.png.
Coordinator capture: .asset-forge/previews/kk-046-cat-toy-basket-contrast/latest.png.

Original W × D × H: 0.30 × 0.25 × 0.35 m; storytelling ceiling: 2,000 triangles.
Runtime triangles: 1958; compiled triangles: 1958.

## Correction and physical evidence

Changed owned wicker cedar to the existing woven surface maps, with darker exposed broad stakes. Thickened curved handles and added rounded attachment bindings. Corrected liner winding so its inner moss cloth is visible. Enlarged the formed mouse/ball, added a second mouse ear and sewn tail, and seated the shaped feathers in a ferrule.

Six interior rays reach the liner before the wood wall. Mouse, fish and ball bottoms meet the 13 mm lined floor. Each feather base lies inside the attachment ferrule. Resource tests cover reused ear geometry, caller materials and stable anchors.

## Runtime anatomy

toys and wand independently remove/reinstate their contents; basket, fitted liner and handle anchors remain.

Typed createModel/configure/getConfig/setMaterial and createPreview/createCafePreview exports are present. Root and named anchors survive rebuilding. Only active material slots are advertised; default materials/maps and geometry are model-owned, while consumer materials remain unmodified and undisposed. Disposal is idempotent. Default owned cedar retains shared wood-finish registration.

## Validation

- Local geometry, dimensions, UVs, configuration, resources and contact tests pass.
- Nine scoped shared runtime contract tests pass for this ID.
- Per-model TypeScript check passes.
- Scoped topology test passes; emitted .vtopo bytes decode and validate without errors.
- Compiled manifold=true, boundaryMode=declared-open, one LOD and nonempty collision geometry; no AABB hull fallback. Declared-open boundaries are not a claim of a fully watertight union.
- Coplanar checker clean at the unchanged default 0.02 m² threshold; that checker is a bounds heuristic, not proof of every small contact.
- No shared file edits, commits, GPU renders, browser captures or exports by this worker.

## Remaining approximations

Wicker is a continuous shallow ribbed shell with bindings and woven maps, not individually interlaced open strips. Cloth toys omit embroidered reference patterns. Feathers are folded closed silhouettes without individual barbs. No simulation or baked shading.

Files: model.ts, model.test.ts, tsconfig.json, catalog.ts, kk-046-cat-toy-basket.vtopo, and this review record.

