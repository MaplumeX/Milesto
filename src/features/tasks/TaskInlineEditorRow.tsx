import { useCallback, useEffect, useRef } from 'react'

import { TaskEditorPaper, type TaskEditorPaperHandle } from './TaskEditorPaper'
import { useTaskSelection } from './TaskSelectionContext'

export function TaskInlineEditorRow({ taskId }: { taskId: string }) {
  const { closeTask, registerOpenEditor } = useTaskSelection()
  const editorRef = useRef<TaskEditorPaperHandle | null>(null)
  const isClosingRef = useRef(false)

  const attemptClose = useCallback(async () => {
    if (isClosingRef.current) return
    isClosingRef.current = true
    try {
      const ok = (await editorRef.current?.flushPendingChanges()) ?? true
      if (!ok) {
        editorRef.current?.focusLastErrorTarget()
        return
      }
      closeTask()
    } finally {
      isClosingRef.current = false
    }
  }, [closeTask])

  useEffect(() => {
    registerOpenEditor({
      taskId,
      flushPendingChanges: () => editorRef.current?.flushPendingChanges() ?? Promise.resolve(true),
      focusTitle: () => editorRef.current?.focusTitle(),
      focusLastErrorTarget: () => editorRef.current?.focusLastErrorTarget(),
    })

    return () => registerOpenEditor(null)
  }, [registerOpenEditor, taskId])

  return (
    <section
      className="task-inline-editor"
      aria-label="Task editor"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          void attemptClose()
          return
        }

        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          e.stopPropagation()
          void attemptClose()
          return
        }

        // Prevent list-level handlers (listbox navigation / toggle) from stealing editor keystrokes.
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
          e.stopPropagation()
        }
      }}
    >
      <TaskEditorPaper
        ref={editorRef}
        taskId={taskId}
        variant="inline"
        onRequestClose={() => void attemptClose()}
      />
    </section>
  )
}
