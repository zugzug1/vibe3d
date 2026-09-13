import type { CatalogModel } from './catalog.ts'

export function kitSlug(model: Pick<CatalogModel, 'kind'>): 'scifi-kit' | 'f1-kit' | 'cafe-kit' {
  return model.kind === 'cafe-kit' ? 'cafe-kit' : model.kind === 'f1' ? 'f1-kit' : 'scifi-kit'
}
export function registryScope(model: Pick<CatalogModel, 'kind'>): '@scifi-kit' | '@f1-kit' | '@cafe-kit' {
  return `@${kitSlug(model)}`
}
export function installedImport(model: Pick<CatalogModel, 'kind' | 'id'>): string {
  return `@/models/${kitSlug(model)}/${model.id}/model`
}
