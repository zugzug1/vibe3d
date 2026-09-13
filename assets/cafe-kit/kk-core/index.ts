export { DERIVED, TOKEN, mixToken, shade } from './palette.ts'
export type { Token } from './palette.ts'
export { acquireKkMaterials, disposeKkMaterials, setCafeWoodFinish } from './materials.ts'
export type { CafeWoodFinish } from './materials.ts'
export type { KkMaterialBundle, KkMaterialOptions, KkMaterials } from './materials.ts'
export {
  AXIS_X,
  AXIS_Y,
  AXIS_Z,
  FACE_CLEARANCE,
  LAYER_CLEARANCE,
  bolt,
  boltRun,
  castor,
  facetRadius,
  groundPad,
  hexagon,
  layer,
  member,
  socket,
  tubeSection,
  wrapStrap,
} from './parts.ts'
export type { Vec3 } from './parts.ts'
export { arcBand, bevelBlade, bevelBox, bevelDisc, bevelPrism, bevelRing } from './bevel.ts'
export { creased, mergeParts } from './merge.ts'
export { applyPolarCapUVs, loftAlongX, loftRoundedBox, ovalTube, roundedRectRing, uvAlongX } from './primitives.ts'
export { revolve, taperedTube } from './sculpt.ts'
export { ResourceBag, clamp01 } from './resourceBag.ts'
export { finishModel, meshesOf } from './finish.ts'
export type { FinishOptions, FinishedModel } from './finish.ts'
export {
  MAX_TEXTURE_SIZE,
  cedarGrainTexture,
  glazePoolingTexture,
  shiboriTexture,
  tatamiWeaveTexture,
  washiFibreTexture,
} from './textures.ts'
export {
  CAFE_DISTANCE,
  CAFE_FOV,
  CAFE_PITCH,
  DEFAULT_PITCH,
  DEFAULT_YAW,
  createKkPreview,
} from './preview.ts'
export type { KkFraming, KkPreview, KkPreviewModel, KkPreviewOptions } from './preview.ts'
