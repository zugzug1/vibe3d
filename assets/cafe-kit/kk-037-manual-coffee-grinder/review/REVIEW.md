# kk-037-manual-coffee-grinder — bounded source review

Initial fresh Luna critic score supplied by coordinator: **78/100**. One bounded correction pass completed. No post-correction score or visual acceptance claimed.

## Reference and state

Original: `/Volumes/zug1/kyoto-kat-kit/v1/images/kk-037.png`.
Inspected coordinator contrast capture: `.asset-forge/previews/kk-037-manual-coffee-grinder-contrast/latest.png` (pre-correction).
Canonical dimensions: 0.14 W × 0.14 D × 0.25 H m. Bottom-centre Y-up datum; stable root and semantic part anchors.
Source frozen for coordinator recapture/critique/export. No GPU runs, GLB exports, commits, shared material edits or shared UI edits performed here.

## Controls and ownership

Crank angle −180…180 degrees; grounds drawer extension 0…1 (45 mm travel). Both bounded, atomic finite validation. The crank is rebuilt around its stable pivot; consumer attachments survive.
Generated geometry is instance-owned and disposed once; supplied materials/maps are never disposed. Rebuilds retain root transforms, material overrides and consumer anchor children. Uses vibe-model construction/resource rules and existing shared surface helpers.

## Single critic pass

Normalized both lathe meshes' endpoint normals after finding Three's last meridian normal retained the profile-edge length. Extended crank reach 5 mm while retaining the canonical footprint even at diagonal angles. Kept the open hopper, real spindle and drawer supports.

CPU diagnosis of the reported inner-rim black patch: every welded shell edge has exactly two oppositely directed incidences, every shading normal is unit-length and agrees with winding, and 480 downward inner-wall rays hit upward faces. No tear, reversed cap, or missing surface found.

### Requested hopper-only shadow follow-up

Inspected main's recapture: the patch persists after normal correction. The closed meridian has no nonadjacent crossings or overlapping cap segments; there is no separate rim cap. The contrast rig uses a 2048 shadow map, near/far 0.1/60, bias -0.00005 (about 3 mm in its orthographic depth span), and no normal bias. That scale is material relative to the thin wall; self-shadow aliasing remains the leading inference, not a GPU-confirmed diagnosis.

Disabled castShadow only on the open flared hopper, retaining receiveShadow and all other casters. Added userData.cafeCastShadow = false per coordinator's explicit shadow-override contract; this survives as export extras. Geometry, materials, dimensions, topology and ownership are unchanged. Tradeoff: the bowl no longer casts onto itself or surrounding parts; the foot/body/crank still cast.

Coordinator will make the contrast rig respect explicit userData.cafeCastShadow === false. Without that shared change, its blanket casting enable overrides the local flag. Shared renderer was not edited here. New CPU regressions verify the single exception through rebuilds and non-self-intersecting meridian. Visual resolution still requires main's capture.

## CPU checks

- 1472 visual triangles (all default and control-corner cases below the 2,000 cap).
- 58 targeted kit/scoped tests pass, including 18 batch-specific tests in `../kk-037-manual-coffee-grinder/model.test.ts`.
- Finite attributes, nondegenerate outward triangles, original dimensions, bottom pivot, unit mesh scales, finite atomic configuration, bounds, contact, overrides and exactly-once disposal checked with updated world matrices.
- Strict source/catalog TypeScript check passes. Bun executes tests; standalone test-file tsc lacks the repository's `bun:test` declarations.
- Coplanar CLI clean; this is a >=0.02 m² visible-bounds heuristic, not proof at paper/rim scale.
- Local topology refreshed: 1464 triangles, 322 collision triangles, 32993 bytes; compiler reports manifold, declared-open, no AABB hull fallback. Open assembly preserves disconnected functional pieces.

## Remaining approximations / risks

Coordinator recapture: the inner-rim dark patch remains when hopper casting is disabled, but is absent in legacy shadow-free lighting. Thus the opt-out did not resolve it; a cast shadow from the crank is another plausible explanation. No geometry tear was established. Contrast-lighting appearance remains flagged for review, not represented as repaired or approved.

Empty hopper; beans intentionally omitted as optional dressing. Simplified box joinery and turned grip; not a working burr mechanism. Owned cedar/cedarDark maps and finish controls remain active.
Final corrected capture and acceptance remain with main; previous batch assets remain frozen and untouched.
