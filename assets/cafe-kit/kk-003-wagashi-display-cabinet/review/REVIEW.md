# kk-003 Wagashi display cabinet

Reference: `/Volumes/zug1/kyoto-kat-kit/v1/images/kk-003.png`. Exact authored envelope: 1.20 × 0.50 × 1.10 m (width/depth/height), bottom-centre origin, Y-up.

Status: final source iteration 005 and exported/reimported close/gameplay previews are generated. Coordinator inspected final GLB close/gameplay pixels: coherent frame, populated tiers, seated trays, lobed pink sweets and readable glazing. No user acceptance is claimed.

Construction: continuous crown, four full-height corner posts, closed cedar back, glazed sides, three seated shelves, nine complete trays and 36 sweets. Sweets alternate rounded forms, lobed pink examples and cut blocks, each with a small centre accent. Door glazing is one surface per panel; opaque washi is restricted to the bottom inset band. All tray and sweet geometry disappears together when trays are disabled.

Runtime: carcass, doors, trays and dressing anchors plus anchor-cabinet remain stable. Rebuilds retain consumer attachments and root transforms. All existing material slots and constructor/setMaterial overrides are preserved. Owned geometry, maps and materials dispose exactly once; borrowed resources are not changed or freed.

Materials: opt-in approved surface-detail helper supplies small deterministic standard PBR maps for cedar, paper and ivory/moss sweets. Owned glass has restrained opacity and double-sided single panes. The current kit palette is retained; no shared files changed.

Approximations: no painted botanical lower panels, pastry leaf wrappers, granular coatings, elaborate flower petals, edge-wear painting or ink outlines. Lobes are geometry, not painted motifs. Door pulls are slim applied bars rather than fully recessed pockets; the doors are static display configurations, not animated sliding mechanisms. Back construction is inferred from one view. Transparency was inspected at the deterministic Three preview cameras, not across all gameplay camera positions or other engines.

Technical checkpoint: 13,220 / 15,000 triangles. Focused tests enforce dimensions within 1 micrometre of the authored values in every configuration, finite nondegenerate closed solids (single glass quads tested separately), tray seating, top-tier clearance, stable attachments, all slot overrides and exact-once ownership. Passing tests are not visual acceptance or phone-performance validation. No renderer, export or commit was run by this builder.
