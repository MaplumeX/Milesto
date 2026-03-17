import { useTranslation } from 'react-i18next'

import type { Area } from '../../../shared/schemas/area'
import type { Project } from '../../../shared/schemas/project'
import type { TaskUpdateInput } from '../../../shared/schemas/task'

export function TaskMovePopoverContent({
  areas,
  openProjects,
  actionError,
  onMove,
}: {
  areas: Area[]
  openProjects: Project[]
  actionError: string | null
  onMove: (patch: Partial<Omit<TaskUpdateInput, 'id'>>) => Promise<void>
}) {
  const { t } = useTranslation()

  return (
    <div style={{ marginTop: 10 }}>
      {actionError ? (
        <div className="error" style={{ margin: '0 0 10px' }}>
          <div className="error-code">{t('taskEditor.actionFailedTitle')}</div>
          <div>{actionError}</div>
        </div>
      ) : null}

      <div className="content-bottom-popover-section">
        <div className="label" style={{ marginBottom: 8 }}>
          {t('shell.areas')}
        </div>
        <div className="content-bottom-popover-list">
          {areas.length === 0 ? <div className="nav-muted">{t('shell.empty')}</div> : null}
          {areas.map((area) => (
            <button
              key={area.id}
              type="button"
              className={`button button-ghost content-bottom-popover-item${area.title.trim() ? '' : ' is-placeholder'}`}
              onClick={() =>
                void onMove({
                  area_id: area.id,
                  project_id: null,
                  section_id: null,
                  is_inbox: false,
                })
              }
            >
              {area.title.trim() ? area.title : t('area.untitled')}
            </button>
          ))}
        </div>
      </div>

      <div className="content-bottom-popover-section" style={{ marginTop: 10 }}>
        <div className="label" style={{ marginBottom: 8 }}>
          {t('nav.projects')}
        </div>
        <div className="content-bottom-popover-list">
          {openProjects.length === 0 ? <div className="nav-muted">{t('shell.empty')}</div> : null}
          {openProjects.map((project) => (
            <button
              key={project.id}
              type="button"
              className={`button button-ghost content-bottom-popover-item${
                project.title.trim() ? '' : ' is-placeholder'
              }`}
              onClick={() =>
                void onMove({
                  project_id: project.id,
                  area_id: null,
                  section_id: null,
                  is_inbox: false,
                })
              }
            >
              {project.title.trim() ? project.title : t('project.untitled')}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
