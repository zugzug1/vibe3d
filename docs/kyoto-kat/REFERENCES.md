# Kyoto Kat reference pack v1

50 reviewed concept PNGs made with built-in ImageGen. These are references for Opus 5 to build
editable Three.js assets and GLBs; no finished 3D assets are included.

- Visual index on the mounted drive: /Volumes/zug1/kyoto-kat-kit/v1/INDEX.md
- [Modeling handoff and art direction](HANDOFF.md)
- [Manifest: prompts, dimensions, provenance, checksums and review notes](manifest.json)
- [Opus production issue](https://github.com/zugzug1/vibe3d/issues/6)
- [Workflow branch](https://github.com/zugzug1/vibe3d/tree/feat/kyoto-kat-asset-workflow/docs/kyoto-kat)

Canonical local location: /Volumes/zug1/kyoto-kat-kit/v1/
The drive must be mounted on the machine running Opus. For remote use, transfer the complete
versioned package; local absolute paths in generation provenance are informational.
Relative image paths remain portable.

Run: python3 docs/kyoto-kat/validate.py /Volumes/zug1/kyoto-kat-kit/v1
The validator verifies 50 distinct IDs, PNG chunk CRCs and decompression, dimensions >=1024px,
unique image hashes, manifest checksums and recorded concept-review status.
SHA256SUMS also supports shasum -a 256 -c SHA256SUMS.

Model dimensions are authored targets, not measurements inferred from pixels. QA covers
concept suitability, not exact orthographic construction, 3D correctness or phone performance.
Some generated masters retain transparent backdrop/shadow pixels; view them over ivory.
Review notes identify contextual cats, optional dressing and construction corrections.
No public OSS art license has been asserted; review rights before redistribution.
