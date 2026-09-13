# Café-kit finish controls

`setCafeWoodFinish(root, patch)` is exported by `assets/cafe-kit/kk-core/index.ts`.
Pass one model root for an individual finish, or the café root for every currently attached item.

```ts
setCafeWoodFinish(model.root, { tint: '#788468', roughness: 0.65 })
setCafeWoodFinish(model.root, { tint: null, roughness: null }) // original finish
```

Tint accepts six-digit hex. It sets the cedar colour and retains the original darker-wood contrast. Roughness accepts finite values from 0.45 to 0.95; invalid patches throw before changing any material. Omitted fields are unchanged; null resets that field. Empty patches change nothing.

Only wood created by this kit participates. Consumer overrides, nonwood slots, grain maps, normal maps and geometry are untouched. Instances retain independent finishes. The helper returns the number of participating materials (zero for models without owned wood). Reapply after inserting new items or replacing a material. No global mutable theme affects future instances, and no additional GPU resources are allocated.

Shape adjustments are separate from finishes: use supported structural configuration fields rather than scaling an entire model. The manifest describes canonical default dimensions, not user-created larger variants.

## Structural controls

The entrance (010), spindle chair (012), and trolley (015) export `cafeShapeControls` with labels, defaults, bounds and slider steps. Pass `archSpan`, `archRise`, and `archThickness` to `createModel` or `instance.configure`. Values are metres; finite out-of-range values clamp, nonfinite values throw before mutation, and omitted fields retain the current configuration.

The entrance controls its portal opening and timber width; it does not claim a curved arch. The chair changes its bow and attached spindles; the trolley changes its handle. Defaults are geometry-fingerprint tested against `2f0726c`. Consumer attachments and root transforms survive configuration. Existing entrance degenerate triangles are recorded by the tests, not newly introduced or silently called repaired. Existing baseline budget exceptions are not waived by the controls tests.

The docs model viewer exposes these sliders and wood controls on participating models. It exports the currently displayed variant. `scripts/cafe-shape-controls-preview.ts` captures separate default/min/max images; `scripts/cafe-finish-preview.ts` captures a finish variant. Generated images are review artifacts, not runtime registry source.
