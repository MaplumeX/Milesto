import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface AnimatedTaskSlotProps {
  isOpen: boolean
  rowContent: ReactNode
  editorContent: ReactNode
  onHeightChange: () => void
  prefersReducedMotion: boolean
}

const TWEEN_EXPAND = { duration: 0.2, ease: [0.2, 0, 0, 1] as const }
// Collapse: fast enough to feel instant, eased to avoid jarring snap.
const TWEEN_COLLAPSE = { duration: 0.2, ease: [0.2, 0, 0, 1] as const }
// Editor content entrance: quick opacity fade-in.
const TWEEN_CONTENT_ENTER = { duration: 0.16, ease: 'easeOut' as const }
// Editor content exit: fast tween so it doesn't linger.
const TWEEN_CONTENT_EXIT = { duration: 0.12, ease: 'easeOut' as const }

const TWEEN_ROW_UNDERLAY_EXIT = { duration: 0.12, ease: 'easeIn' as const }
const TWEEN_ROW_UNDERLAY_ENTER = { duration: 0.16, delay: 0.04, ease: 'easeOut' as const }

export function AnimatedTaskSlot({
  isOpen,
  rowContent,
  editorContent,
  onHeightChange,
  prefersReducedMotion,
}: AnimatedTaskSlotProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const rowUnderlayRef = useRef<HTMLDivElement | null>(null)
  const editorContentRef = useRef<HTMLDivElement>(null)
  const onHeightChangeRef = useRef(onHeightChange)
  onHeightChangeRef.current = onHeightChange

  // Track exit animation to keep row hidden until collapse completes.
  const [isEditorExiting, setIsEditorExiting] = useState(false)
  // Track whether the expand animation has settled so we can release
  // overflow: hidden and let box-shadows / popovers paint outside the slot.
  const [isExpanded, setIsExpanded] = useState(false)

  // Track the natural (content-driven) height of the editor wrapper so
  // framer-motion can redirect the spring when async data loads and the
  // content grows.  Using a concrete pixel value instead of 'auto' avoids
  // the two-stage animation glitch.
  const [editorHeight, setEditorHeight] = useState<number | null>(null)

  const showRowInFlow = !isOpen && !isEditorExiting
  const showRowUnderlayClose = !isOpen && isEditorExiting
  const showRowUnderlayOpen = isOpen && !isExpanded

  // Detect open→closed transition synchronously (before paint) so the row
  // doesn't flash for a single frame between state changes.
  const wasOpenRef = useRef(isOpen)
  useLayoutEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      setIsEditorExiting(true)
      setIsExpanded(false)
      setEditorHeight(null)
    }
    wasOpenRef.current = isOpen
  }, [isOpen])

  // Persist the last measured row height so the editor can animate to/from it.
  // Default 44px matches the standard task-row height.
  const measuredRowHeightRef = useRef(44)
  useLayoutEffect(() => {
    if (rowRef.current) {
      measuredRowHeightRef.current = rowRef.current.getBoundingClientRect().height
    }
  })

  // Measure the editor content wrapper's natural height on every resize so
  // the spring target stays in sync with the actual content dimensions.
  // This handles the async data load case where content grows after mount.
  const editorContentRefCallback = useCallback((el: HTMLDivElement | null) => {
    const mutableEditorContentRef = editorContentRef as { current: HTMLDivElement | null }
    mutableEditorContentRef.current = el
    if (el) {
      setEditorHeight(el.getBoundingClientRect().height)
    }
  }, [])

  useEffect(() => {
    const el = editorContentRef.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const ro = new ResizeObserver(() => {
      setEditorHeight(el.getBoundingClientRect().height)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [isOpen])

  // ResizeObserver drives virtualizer re-measurement on every frame of the
  // height animation.  The ref indirection avoids re-creating the observer
  // when the parent-supplied callback changes identity.
  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const ro = new ResizeObserver(() => {
      onHeightChangeRef.current()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useLayoutEffect(() => {
    if (!(showRowUnderlayOpen || showRowUnderlayClose)) return
    const root = rowUnderlayRef.current
    if (!root) return

    root.setAttribute('inert', '')

    const nodes = root.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]')
    nodes.forEach((node) => node.setAttribute('tabindex', '-1'))
  }, [showRowUnderlayClose, showRowUnderlayOpen])

  // Reduced-motion: skip all animation, instant swap.
  if (prefersReducedMotion) {
    return (
      <div ref={containerRef}>
        {isOpen ? editorContent : rowContent}
      </div>
    )
  }

  const animateHeight = editorHeight ?? measuredRowHeightRef.current

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {showRowInFlow ? <div ref={rowRef}>{rowContent}</div> : null}
      {showRowUnderlayOpen ? (
        <motion.div
          key="row-underlay-open"
          ref={rowUnderlayRef}
          aria-hidden={true}
          initial={{ opacity: 1 }}
          animate={{ opacity: 0, transition: TWEEN_ROW_UNDERLAY_EXIT }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'none' as const }}
        >
          <div ref={rowRef}>{rowContent}</div>
        </motion.div>
      ) : null}
      {showRowUnderlayClose ? (
        <motion.div
          key="row-underlay-close"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: TWEEN_ROW_UNDERLAY_ENTER }}
          ref={rowUnderlayRef}
          aria-hidden={true}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'none' as const }}
        >
          <div ref={rowRef}>{rowContent}</div>
        </motion.div>
      ) : null}
      <AnimatePresence
        initial={false}
        onExitComplete={() => setIsEditorExiting(false)}
      >
        {isOpen ? (
          <motion.div
            key="editor"
            initial={{ height: measuredRowHeightRef.current }}
            animate={{ height: animateHeight }}
            exit={{ height: measuredRowHeightRef.current, pointerEvents: 'none' as const, transition: TWEEN_COLLAPSE }}
            transition={TWEEN_EXPAND}
            style={{ overflow: isExpanded ? 'visible' : 'hidden' }}
            onAnimationComplete={() => setIsExpanded(true)}
          >
            <motion.div
              ref={editorContentRefCallback}
              initial={{ opacity: 0 }}
              animate={{
                opacity: 1,
                transition: TWEEN_CONTENT_ENTER,
              }}
              exit={{
                opacity: 0,
                transition: TWEEN_CONTENT_EXIT,
              }}
              style={{ padding: '16px 0' }}
            >
              {editorContent}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
