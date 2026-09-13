# kk-017 Sliding-door pantry

Reference: `/Volumes/zug1/kyoto-kat-kit/v1/images/kk-017.png`. Exact authored envelope: 0.85 × 0.45 × 1.80 m (width/depth/height), bottom-centre origin, Y-up.

Status: final source iteration 005 and exported/reimported close/gameplay previews are generated. Coordinator inspected final GLB close/gameplay pixels: open slats, stocked interior and dark recessed pulls read clearly, with restrained vessel tint variations. No user acceptance is claimed.

Construction: closed sides and recessed dark back, four feet, seated crown/base, two offset static sliding-door frames and narrow tracks. Sixteen 10 mm slats have 27 mm open gaps with no backing slab or glass. Three shelves carry 12 hollow cups and four nested bowls. Upper storage occupies two visible levels. Each pull has a real cut opening, approximately 10 mm pocket depth and an annular lip; raycasts reach the bottom through the opening and hit the rim beside it.

Runtime: carcass, doors, shelves and hardware anchors plus anchor-pantry remain stable across configuration rebuilds; consumer attachments and root transforms stay intact. Disabling shelves removes both shelves and stock; disabling doors removes door-mounted pulls while retaining cabinet tracks. Constructor and setMaterial overrides cover all original slots, including every ceramic tint variant. Owned resources dispose exactly once and borrowed resources remain untouched.

Materials: approved opt-in surface-detail maps on cedar and ceramics. Two owned ceramic clones blend 30 percent toward existing kit moss/deep-glaze colors; no new interface slots. Owned ink is darkened for the liner/rim and recessed interior. Consumer ink/ceramic overrides bypass these adjustments. The global palette and shared helper are unchanged.

Approximations: 12-sided vessel profiles, simplified nested bowls and straight feet; no cat figurine, decorative pottery motifs, finger joints, individual panel planks or painted wear. Hardware uses an oval pocket instead of the reference's rounded-rectangle outline. Doors have static visibility configuration, not animated sliding. Interior arrangement is inferred; material contrast follows the current approved kit rather than the darker painted concept.

Technical checkpoint: 4,320 / 6,000 triangles, four public slots with two additional owned ceramic variants. Focused tests enforce exact dimensions within 1 micrometre in all configurations, finite nondegenerate closed solids, hollow vessel floors, open-slat sightlines, real pull recess depth, stable attachments, overrides and exact-once resource ownership. Passing tests do not establish visual acceptance or mobile performance. No renderer, export or commit was run by this builder.
