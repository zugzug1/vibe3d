# kk-045-maple-branch-vase — final bounded handoff

Status: source frozen after the requested correction pass. Main recaptured the corrected contrast image and reported no further visual requests. Ready for coordinator export; no new critic score is claimed.

Initial Luna score: 63/100. Original reference: /Volumes/zug1/kyoto-kat-kit/v1/images/kk-045.png.
Coordinator capture: .asset-forge/previews/kk-045-maple-branch-vase-contrast/latest.png.

Original W × D × H: 0.25 × 0.25 × 0.55 m; storytelling ceiling: 2,000 triangles.
Runtime triangles: 1592; compiled triangles: 1592.

## Correction and physical evidence

Replaced radial star outlines with 28-point asymmetric lobed maple silhouettes, shallow folding and varied orientations. Replaced the invalid concave triangle fan with ear-clipped polygon triangulation. Retained attached petioles and the tapered vessel.

Vase ray reaches the 12 mm internal floor; branch base is seated there. Every leaf base meets a branch endpoint within 0.01 mm. Every actual upper leaf triangle has consistent projected winding; finite/nondegenerate tests cover both skins and the edges. Canonical width/depth deviations are below 0.03 mm.

## Runtime anatomy

branch: remove/reinstate the entire branch and leaf arrangement, exposing the hollow vessel.

Typed createModel/configure/getConfig/setMaterial and createPreview/createCafePreview exports are present. Root and named anchors survive rebuilding. Only active material slots are advertised; default materials/maps and geometry are model-owned, while consumer materials remain unmodified and undisposed. Disposal is idempotent. Default owned cedar retains shared wood-finish registration.

## Validation

- Local geometry, dimensions, UVs, configuration, resources and contact tests pass.
- Nine scoped shared runtime contract tests pass for this ID.
- Per-model TypeScript check passes.
- Scoped topology test passes; emitted .vtopo bytes decode and validate without errors.
- Compiled manifold=true, boundaryMode=closed, one LOD and nonempty collision geometry; no AABB hull fallback. Declared-open boundaries are not a claim of a fully watertight union.
- Coplanar checker clean at the unchanged default 0.02 m² threshold; that checker is a bounds heuristic, not proof of every small contact.
- No shared file edits, commits, GPU renders, browser captures or exports by this worker.

## Remaining approximations

Six broad low-poly leaves omit microscopic serrations and vein geometry. Vase glazing simplifies the reference brushwork to a dark foot and ivory vessel. The compiled closed-boundary claim does not imply one boolean-unioned solid.

Files: model.ts, model.test.ts, tsconfig.json, catalog.ts, kk-045-maple-branch-vase.vtopo, and this review record.

