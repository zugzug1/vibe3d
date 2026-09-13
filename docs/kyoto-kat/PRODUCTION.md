# Café-kit completion ledger

Continue the existing `feat/kyoto-kat-kit` worktree and personal fork. Do not restart approved models.

## Review states

Source written, technical checks passing, rendered/reimported, and Miguel-approved are distinct states. A passing geometry test does not imply visual approval. Never mark phone performance passing without a named physical device and recorded measurement.

Baseline at `2f0726c`: 22 model sources. Appearance approved: 001–006, 008, 011–012, 016–017, 032–034, 040. Repaired and presented, explicit approval pending: 007, 009–010, 013–015, 018. Remaining 28 are queued below.

## Batch order and ownership

At most two builders; each owns explicitly assigned asset directories. Coordinator owns shared helpers, integration and commits. Serialize GPU/browser renders. Reuse existing palette, material ownership, preview and export tooling.

1. Controls checkpoint: shared owned-wood tint/roughness/reset; entrance opening, chair bow and trolley handle dimensions. Preserve default appearance.
2. Timber utility: 020 shoe cubby, 021 wall cat walkway, 024 litter enclosure, 027 waste cabinet.
3. Guest services: 025 adoption cabinet, 026 register counter, 028 coat stand, 030 menu stand.
4. Ceramic/cat care: 019 umbrella stand, 022 scratching column, 023 sleeping basket, 029 planter.
5. Tea and coffee: 031 whisk/holder, 035 wagashi plate, 036 bean jar, 037 grinder.
6. Service and memory: 038 kettle, 039 tray, 041 adoption ledger, 042 photo display.
7. Atmosphere: 043 radio, 044 wind bell, 045 maple vase, 049 map frame.
8. Care and craft: 046 toy basket, 047 grooming box, 048 stamp kit, 050 mending basket.

Each batch: inspect references and original dimensions → early silhouette → finish → affected tests and coplanarity coverage → source and gameplay previews → one bounded critique/correction pass → GLB export/reimport → versioned review package → explicit-path commit. Recurring defects pause expansion until their common cause is repaired. Unresolved visual issues remain visible in the repair queue.

## Review package

Use the existing preview pipeline and `scripts/archive-cafe-pilots.ts`. Each batch gets a unique directory under `/Volumes/zug1/kyoto-kat-kit/pilot-review/`, with README, close/gameplay previews, reimport previews, source helpers, topology and checksums. Local drive paths are not remote download links. Present the batch with asset IDs and unresolved findings; record Miguel's approval separately.

## Final integration

Full tests/typechecks with pre-existing failures distinguished; 50-asset review scene plus furnished café with correct support/mount heights; 50 source models, topology sidecars, GLBs and previews; resolving manifest links; verified archive; update fork issue #6 and feature PR #8. Mobile measurement and redistribution approval remain explicit gates. No automatic merge, release or live deployment.
