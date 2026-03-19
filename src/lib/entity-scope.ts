import type { EntityScope } from '../../shared/schemas/common'

export function getEntityScopeFromSearch(search: string): EntityScope {
  return new URLSearchParams(search).get('scope') === 'trash' ? 'trash' : 'active'
}

export function buildProjectPath(projectId: string, scope: EntityScope): string {
  return scope === 'trash' ? `/projects/${projectId}?scope=trash` : `/projects/${projectId}`
}
