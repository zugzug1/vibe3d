# Café-kit: 50-asset production handoff

All 50 editable model sources, topology sidecars, GLBs and source/reimport previews are delivered on `feat/kyoto-kat-kit` in **zugzug1/vibe3d only**. Source checkpoint: `be0cd34`. No merge, publication, upstream push or live deployment performed.

## Open the package

Combined review: `/Volumes/zug1/kyoto-kat-kit/pilot-review/collection-2026-09-13-v1/README.md`.
Each asset folder contains its GLB, editable local source, topology, close/gameplay views and review notes. The package includes `scenes/review.png`, `scenes/cafe.png`, measured desktop counters and verified checksums. The separate full-checkout source snapshot includes shared dependencies' source and package manifests; install locked dependencies to build it. Per-asset source folders alone are not standalone packages.

Original references remain at `/Volumes/zug1/kyoto-kat-kit/v1/images/`. `delivery-manifest.json` links all 50 stable reference IDs to repository-relative production artifacts and their review status. Local drive paths require this Mac and mounted drive; they are not remote download links. No remote binary release was published.

Live review: start `bun run --cwd apps/docs dev`, then open `/#/kits/cafe-kit`; individual models use `/#/models/<full-id>`. Owned wood tint/roughness/reset and supported structural controls are below the viewer. Use `CONTROLS.md` for the runtime contract.

## Validation

- Frozen affected suite: **700 tests pass, 0 fail** across 54 files, including kit contracts, topology, surface contacts, disposal, wood/shape controls, reimport tooling and registry integration.
- Complete inventory gate passes: exactly **50 models, 167,722 source triangles**, all required artifact paths present and category budgets respected.
- Registry build: **52 items from 50 models**. Docs production build/typecheck passes; focused repair/source typechecks pass. This is not a claim that unrelated repository-wide checks have no pre-existing failures.
- All GLBs reimported through Three's GLTFLoader and captured. Archive checks decode PNG pixels, validate GLB headers, reopen copies and compare SHA-256 checksums.
- Furnished café: **80 draws / 172,393 rendered triangles**; review scene: **79 / 167,941**, at 1280×720 on headless Dawn/Metal. This is not an fps result. The scene-capture process returned exit 1 after writing valid images/counters; several individual captures also reported teardown SIGSEGV after valid PNG writes. These are explicitly not clean renderer process passes.

## Still requires acceptance

15 earlier appearances remain approved (001–006, 008, 011–012, 016–017, 032–034, 040); the other 35 are review-pending. Bounded critique scores and approximations are retained per asset. The grinder's dark inner-rim patch occurs under shadow lighting, with no demonstrated geometry tear; its contrast appearance remains flagged. Inventory warnings retain approved dimension deviations and material-count costs rather than hiding them.

Physical midrange-phone sustained 30 fps, final visual approval and art redistribution/licensing clearance remain pending. Asset budgets and desktop counters do not establish mobile acceptance. Follow PERF.md before release.
