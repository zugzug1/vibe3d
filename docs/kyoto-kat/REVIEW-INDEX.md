# Café-kit review index

Branch: `feat/kyoto-kat-kit` in `zugzug1/vibe3d` only. This is an in-progress collection, not an OSS release or a claim of phone performance.

## Saved batches

- Service and memory: `/Volumes/zug1/kyoto-kat-kit/pilot-review/storytelling-first-five-2026-09-13-v1/README.md` — 031, 035, 039, 041, 042. 57 checksum-verified files, source and GLB reimport views. Appearance approval pending. The ledger gameplay reimport and photo-display source close capture wrote valid decoded PNGs before Dawn teardown SIGSEGV; these are not clean process exits.

- Earlier approved-source reimports: `/Volumes/zug1/kyoto-kat-kit/pilot-review/approved-reimports-2026-09-13-v1/README.md` — 001, 002, 004, 006, 008, 011, 032, 033, 034, 040. 84 checksum-verified copied files; fresh GLBs and reimport previews close previous handoff gaps. Existing source appearance approvals are retained; the archive's conservative generic pending label does not revoke them.

- Ceramic/cat care: `/Volumes/zug1/kyoto-kat-kit/pilot-review/ceramic-cat-care-2026-09-13-v1/README.md` — 019, 022, 023, 029. 47 checksum-verified copied files. One critique/correction pass, plus a tested cushion-containment fix discovered during final reimport inspection. Appearance approval pending.
- Guest services: `/Volumes/zug1/kyoto-kat-kit/pilot-review/guest-services-2026-09-13-v1/README.md` — 026, 028, 030. 37 checksum-verified copied files. Corrected crank, foot hub and roof joints. Appearance approval pending.

- Five utility/adoption models: `/Volumes/zug1/kyoto-kat-kit/pilot-review/timber-utility-2026-09-13-v1/README.md` — 020 shoe cubby, 021 wall walkway, 024 litter enclosure, 025 adoption cabinet, 027 waste cabinet. 56 copied files verified against source checksums; GLBs reimported with Three. Compare the optional GLB contrast-lighting images with legacy views. Appearance approval pending.
- Shape controls: `/Volumes/zug1/kyoto-kat-kit/pilot-review/shape-controls-2026-09-13-v2/README.md` — 010 entrance, 012 chair, 015 trolley. 39 copied files verified, including default/min/max shape views. Version v1 is incomplete and explicitly marked; use v2. One chair gameplay capture wrote a valid decoded PNG but its renderer process crashed during teardown; not a clean process result.
- Seven earlier repairs: `/Volumes/zug1/kyoto-kat-kit/pilot-review/seven-repairs-2026-09-13-v1/README.md` — 007, 009, 010, 013, 014, 015, 018. Appearance approval pending.

These paths require the mounted drive on this Mac; they are **not remotely downloadable links**. A remote reviewer needs a separately authorized upload before using them.

## How to review

Start the existing docs app (`bun run --cwd apps/docs dev`) and open `/#/kits/cafe-kit` to browse the live registry. Individual models use `/#/models/<full-asset-id>`. Inspect the silhouette at café-camera size first, then joints, openings and material separation. Wood controls and supported shape controls sit beneath the viewer.

Record feedback by asset ID and physical location; keep approvals separate from technical checks. Use the archive's GLB, close and gameplay images to check that export preserves the editable source. Contrast captures use a review-only shadow light; default model materials and geometry are unchanged.

## Completion gates

`node --import tsx scripts/kk-inventory.ts --complete --write docs/kyoto-kat/inventory.md` rejects missing deliverables, partial model selections and budget breaches. Artifact paths in inventory.json are relative to the repository. Passing this gate does not establish visual approval, source/GLB identity after later edits, licensing, or sustained phone frame rate; those require the recorded review and target-device measurements.
