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
