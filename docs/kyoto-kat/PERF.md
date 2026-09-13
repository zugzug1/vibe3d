# Café-kit performance status

Phone acceptance: **pending**. No named physical midrange phone has been tested. Neither triangle budgets nor a desktop capture establish sustained 30 fps.

## Desktop observations, 2026-09-13

- Frozen 50-source checkpoint `be0cd34`: review 79 draws / 167,941 rendered triangles; furnished café 80 draws / 172,393 triangles at 1280×720. Both are below the engineering caps. The measurement process returned exit 1 after writing both PNGs and counters, so this is not a clean process pass or an fps measurement. Source geometry inventory is 167,722 triangles; rendered totals also include scene furniture, cards and rendering passes.

- Before static scene batching: 27 assets, café capture 779 draws / 118,899 rendered triangles.
- During production, after batching and adding room/support furniture: 34 sources present, café capture 60 draws / 145,107 rendered triangles; review 59 draws / 140,655 triangles. Sources were still undergoing repairs, so this is a provisional measurement, not the final frozen collection or a like-for-like benchmark.
- Renderer: headless Dawn, Apple M4 / Metal on macOS 26.4.1; 1280×720. Scene target: at most 120 draws and 310,000 triangles. This is a local engineering target, not a hardware guarantee.
- Some capture processes returned exit 1 during native teardown after writing images and counters. Those outputs are not reported as clean process passes. Final measurements must record this separately from geometry/budget results.

## Static snapshot contract

The scene snapshot batches compatible opaque geometry and exact-equivalent stock PBR materials, including matching CPU texture bytes and sampler settings. Source model geometry, material ownership and editable anchors are untouched. Transparency remains independently sortable. The snapshot is deliberately static: recreate it after changes; do not use it as the animated/editable model API. Larger batches reduce per-object culling granularity.

## Required phone record

Record device model, OS, browser/version, renderer backend, viewport/device-pixel ratio, scene commit, all active effects, shadow configuration and asset count. Warm up, then measure at least three minutes of representative camera motion and interaction; report sustained fps and frame-time distribution, not a single best frame. Confirm textures, memory stability, pivots and interactions in the actual target viewer. Keep acceptance pending if hardware is unavailable.
