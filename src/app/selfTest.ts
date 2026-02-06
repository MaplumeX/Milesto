type SelfTestResult = {
  ok: boolean
  failures: string[]
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function waitFor<T>(
  label: string,
  get: () => T | null,
  opts?: { timeoutMs?: number; intervalMs?: number }
): Promise<T> {
  const timeoutMs = opts?.timeoutMs ?? 10_000
  const intervalMs = opts?.intervalMs ?? 50

  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const v = get()
    if (v) return v
    await sleep(intervalMs)
  }

  throw new Error(`Timeout waiting for: ${label}`)
}

async function scrollUntil<T>(
  label: string,
  params: {
    scroller: HTMLElement
    get: () => T | null
    stepPx?: number
    timeoutMs?: number
    intervalMs?: number
  }
): Promise<T> {
  const stepPx = params.stepPx ?? 180
  const timeoutMs = params.timeoutMs ?? 10_000
  const intervalMs = params.intervalMs ?? 60
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    const v = params.get()
    if (v) return v
    params.scroller.scrollTop += stepPx
    await sleep(intervalMs)
  }

  throw new Error(`Timeout waiting for: ${label}`)
}

function setNativeInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype
  const desc = Object.getOwnPropertyDescriptor(proto, 'value')
  desc?.set?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

function dispatchKey(
  target: HTMLElement,
  key: string,
  extras?: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean }
) {
  target.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      metaKey: extras?.metaKey ?? false,
      ctrlKey: extras?.ctrlKey ?? false,
      shiftKey: extras?.shiftKey ?? false,
    })
  )
}

function dispatchDblClick(target: HTMLElement) {
  target.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }))
}

function dispatchMouse(
  target: Window | Document | HTMLElement,
  type: 'mousedown' | 'mousemove' | 'mouseup',
  params: {
    clientX: number
    clientY: number
    button: number
    buttons: number
  }
) {
  target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: params.clientX,
      clientY: params.clientY,
      button: params.button,
      buttons: params.buttons,
    })
  )
}

function findDragHandle(taskId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `.task-title-button.is-dnd-activator[data-task-id="${taskId}"]`
  )
}

function findSectionDragHandle(sectionId: string): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(
    `.project-group-header[data-section-id="${sectionId}"] .project-group-left-button`
  )
}

async function dragHandleToPoint(params: {
  label: string
  handle: HTMLElement
  to: { x: number; y: number }
  overlaySelector?: string
}) {
  const { label, handle, to } = params
  const overlaySelector = params.overlaySelector ?? '.task-dnd-overlay'
  const reducedMotion = new URL(window.location.href).searchParams.get('reducedMotion') === '1'

  const startRect = handle.getBoundingClientRect()
  // Use a non-center start point to better test DnD precision and coverage.
  // This helps ensure the drag overlay and drop target logic work correctly even when
  // the user doesn't grab the exact center of the activator.
  const start = {
    x: startRect.left + Math.min(Math.max(startRect.width * 0.25, 8), startRect.width - 8),
    y: startRect.top + Math.min(Math.max(startRect.height * 0.35, 6), startRect.height - 6),
  }

  dispatchMouse(handle, 'mousedown', {
    clientX: start.x,
    clientY: start.y,
    button: 0,
    buttons: 1,
  })

  // Move enough distance to satisfy activationConstraint.
  dispatchMouse(document, 'mousemove', {
    clientX: start.x + 24,
    clientY: start.y + 18,
    button: 0,
    buttons: 1,
  })

  await waitFor(`${label}: drag overlay shown`, () =>
    document.querySelector<HTMLElement>(overlaySelector)
  )

  dispatchMouse(document, 'mousemove', {
    clientX: to.x,
    clientY: to.y,
    button: 0,
    buttons: 1,
  })

  await sleep(50)

  dispatchMouse(document, 'mouseup', {
    clientX: to.x,
    clientY: to.y,
    button: 0,
    buttons: 0,
  })

  const mouseUpAt = Date.now()

  if (!reducedMotion) {
    // If drop animation is enabled, the overlay should remain briefly after mouseup.
    await sleep(80)
    if (!document.querySelector<HTMLElement>(overlaySelector)) {
      throw new Error(`${label}: expected drag overlay to remain briefly after drop (animation enabled)`) 
    }
  }

  await waitFor(
    `${label}: drag overlay hidden`,
    () => (document.querySelector<HTMLElement>(overlaySelector) ? null : true),
    { timeoutMs: 10_000, intervalMs: 10 }
  )

  const hiddenAfterMs = Date.now() - mouseUpAt
  if (reducedMotion) {
    // Reduced motion: no visible drop animation.
    if (hiddenAfterMs > 250) {
      throw new Error(`${label}: expected overlay to hide quickly with reduced motion (ms=${hiddenAfterMs})`)
    }
  } else {
    // Non-reduced motion: keep the drop animation short but perceptible.
    if (hiddenAfterMs < 100) {
      throw new Error(`${label}: expected overlay to stay up for drop animation (ms=${hiddenAfterMs})`)
    }
    if (hiddenAfterMs > 1500) {
      throw new Error(`${label}: expected overlay to hide within a short drop animation window (ms=${hiddenAfterMs})`)
    }
  }
}


function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function findTaskButton(taskId: string): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(`.task-title-button[data-task-id="${taskId}"]`)
}

function getSelectedTaskId(): string | null {
  const selectedRowId = document
    .querySelector<HTMLElement>('.task-row.is-selected[data-task-id]')
    ?.getAttribute('data-task-id')
  if (selectedRowId) return selectedRowId

  return (
    document
      .querySelector<HTMLElement>('.task-row.is-selected .task-title-button[data-task-id]')
      ?.getAttribute('data-task-id') ?? null
  )
}

function findButtonByText(root: ParentNode, text: string): HTMLButtonElement | null {
  const all = Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
  return all.find((b) => (b.textContent ?? '').trim() === text) ?? null
}

function findButtonContainingText(root: ParentNode, text: string): HTMLButtonElement | null {
  const all = Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
  return all.find((b) => (b.textContent ?? '').includes(text)) ?? null
}

function getInlinePaper(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.task-inline-paper')
}

function getContentScroller(): HTMLElement {
  const el = document.querySelector<HTMLElement>('.content-scroll')
  if (!el) throw new Error('Missing .content-scroll')
  return el
}

function assertNoOverlap(listbox: HTMLElement, label: string) {
  const list = listbox.querySelector<HTMLElement>('ul.task-list')
  if (!list) throw new Error(`Missing ul.task-list (${label})`)

  // After migrating to a single main scroller, listbox is no longer the scroll viewport.
  // Use the main content scroller for visibility bounds.
  const boxRect = getContentScroller().getBoundingClientRect()
  const items = Array.from(list.querySelectorAll<HTMLElement>('li'))
    .map((el) => ({ el, rect: el.getBoundingClientRect() }))
    .filter(
      ({ rect }) =>
        rect.height > 0 && rect.bottom >= boxRect.top - 1 && rect.top <= boxRect.bottom + 1
    )
    .sort((a, b) => a.rect.top - b.rect.top)

  for (let i = 0; i < items.length - 1; i++) {
    const a = items[i]!
    const b = items[i + 1]!
    if (a.rect.bottom > b.rect.top + 1) {
      throw new Error(
        `${label}: row overlap detected (${a.el.className || 'li'} over ${b.el.className || 'li'})`
      )
    }
  }
}

function assertEditorInView(_listbox: HTMLElement, paper: HTMLElement, label: string) {
  let el = paper
  if (!el.isConnected) {
    const current = getInlinePaper()
    if (current) el = current
  }
  const boxRect = getContentScroller().getBoundingClientRect()
  const paperRect = el.getBoundingClientRect()
  if (paperRect.bottom < boxRect.top || paperRect.top > boxRect.bottom) {
    throw new Error(`${label}: editor jumped out of view`)
  }
}

function getInlineActionBarRight(paper: HTMLElement): HTMLElement {
  const el = paper.querySelector<HTMLElement>('.task-inline-action-bar-right')
  if (!el) throw new Error('Missing .task-inline-action-bar-right')
  return el
}

async function setScheduleToSomeday(paper: HTMLElement, label: string) {
  const rightBar = getInlineActionBarRight(paper)
  const scheduleBtn = findButtonByText(rightBar, 'Schedule')
  const scheduledChip = Array.from(paper.querySelectorAll<HTMLButtonElement>('.task-inline-chip-main')).find((b) =>
    ((b.textContent ?? '').trim() || '').startsWith('Scheduled:')
  )

  const trigger = scheduleBtn ?? scheduledChip
  if (!trigger) throw new Error(`${label}: missing Schedule trigger`)
  trigger.click()

  const popover = await waitFor(`${label}: schedule popover`, () =>
    document.querySelector<HTMLElement>('.task-inline-popover')
  )
  const somedayBtn = await waitFor(`${label}: schedule Someday button`, () => findButtonByText(popover, 'Someday'))
  somedayBtn.click()

  await waitFor(`${label}: schedule popover closed`, () =>
    document.querySelector<HTMLElement>('.task-inline-popover') ? null : true
  )

  await waitFor(`${label}: Scheduled chip shows Someday`, () => {
    const chip = Array.from(paper.querySelectorAll<HTMLButtonElement>('.task-inline-chip-main')).find((b) =>
      ((b.textContent ?? '').trim() || '').startsWith('Scheduled:')
    )
    if (!chip) return null
    return (chip.textContent ?? '').includes('Someday') ? true : null
  })

  // Wait for persistence (debounced + serialized save).
  await waitFor(`${label}: save status is Saved`, () => {
    const el = paper.querySelector<HTMLElement>('.task-inline-status')
    if (!el) return null
    return (el.textContent ?? '').trim() === 'Saved' ? true : null
  }, { timeoutMs: 15_000 })
}

async function waitForUpcomingHeaderNearTop(params: {
  date: string
  label: string
  contentScroller: HTMLElement
  listbox: HTMLElement
}) {
  const { date, label, contentScroller, listbox } = params
  const start = Date.now()
  let lastDebug = ''

  while (Date.now() - start < 10_000) {
    const header = Array.from(document.querySelectorAll<HTMLElement>('.upcoming-header')).find(
      (h) => (h.textContent ?? '').trim() === date
    )

    if (!header) {
      lastDebug = `header not found (date=${date}) headers=${document.querySelectorAll('.upcoming-header').length} scrollTop=${contentScroller.scrollTop}`
      await sleep(50)
      continue
    }

    const view = contentScroller.getBoundingClientRect()
    const rect = header.getBoundingClientRect()
    const listRect = listbox.getBoundingClientRect()
    const computedMargin = listRect.top - view.top + contentScroller.scrollTop
    const maxScroll = contentScroller.scrollHeight - contentScroller.clientHeight
    lastDebug = `scrollTop=${contentScroller.scrollTop} maxScroll=${maxScroll.toFixed(1)} clientH=${contentScroller.clientHeight} scrollH=${contentScroller.scrollHeight} headerTop=${rect.top.toFixed(1)} viewTop=${view.top.toFixed(1)} listTop=${listRect.top.toFixed(1)} computedMargin=${computedMargin.toFixed(1)}`

    // Prefer aligning headers near the top.
    if (rect.top >= view.top - 6 && rect.top <= view.top + 140) return

    // If the target header is close to the end of the list, scrollToIndex will clamp to
    // max scroll. In that case, "near top" alignment is impossible; just require visibility.
    const nearMax = Math.abs(contentScroller.scrollTop - maxScroll) <= 1
    if (nearMax && rect.bottom >= view.top - 6 && rect.top <= view.bottom + 6) return

    await sleep(50)
  }

  throw new Error(`Timeout waiting for: ${label} (${lastDebug})`)
}

async function openEditorByDoubleClick(params: {
  taskId: string
  button: HTMLButtonElement
  label: string
}) {
  const { taskId, button, label } = params

  button.click()
  await waitFor(`${label}: row selected`, () => {
    const selectedId = getSelectedTaskId()
    return selectedId === taskId ? true : null
  })

  if (getInlinePaper()) {
    throw new Error(`${label}: editor opened on selection (should require Enter/double-click)`)
  }

  dispatchDblClick(button)

  const paper = await waitFor(
    `${label}: inline editor mount`,
    () => document.querySelector<HTMLElement>('.task-inline-paper'),
    { timeoutMs: 15_000 }
  )

  const titleInput = await waitFor(
    `${label}: title input`,
    () => paper.querySelector<HTMLInputElement>('#task-title')
  )
  await waitFor(`${label}: title focused`, () => (document.activeElement === titleInput ? true : null))

  const notesInput = await waitFor(
    `${label}: notes input`,
    () => paper.querySelector<HTMLTextAreaElement>('#task-notes')
  )

  const status = await waitFor(
    `${label}: save status`,
    () => paper.querySelector<HTMLElement>('.task-inline-status')
  )
  if (!(status.textContent ?? '').trim()) {
    throw new Error(`${label}: missing save status text`)
  }

  const bar = getInlineActionBarRight(paper)
  const scheduleBtn = findButtonByText(bar, 'Schedule')
  const scheduledChip = Array.from(
    paper.querySelectorAll<HTMLButtonElement>('.task-inline-chip-main')
  ).find((b) => ((b.textContent ?? '').trim() || '').startsWith('Scheduled:'))
  if (!scheduleBtn && !scheduledChip) {
    throw new Error(`${label}: missing Schedule affordance`)
  }
  if (!findButtonByText(bar, 'Tags')) throw new Error(`${label}: missing Tags button`)
  const dueBtn = findButtonByText(bar, 'Due')
  const dueChip = Array.from(paper.querySelectorAll<HTMLButtonElement>('.task-inline-chip-main')).find((b) =>
    ((b.textContent ?? '').trim() || '').startsWith('Due:')
  )
  if (!dueBtn && !dueChip) {
    throw new Error(`${label}: missing Due affordance`)
  }

  const doneToggle = await waitFor(`${label}: done toggle`, () =>
    paper.querySelector<HTMLInputElement>('.task-inline-header input[type="checkbox"]')
  )

  return { paper, titleInput, notesInput, doneToggle }
}

async function openEditorByEnter(params: {
  listbox: HTMLElement
  taskId: string
  button: HTMLButtonElement
  label: string
}) {
  const { listbox, taskId, button, label } = params

  button.click()
  await waitFor(`${label}: row selected`, () => {
    const selectedId = getSelectedTaskId()
    return selectedId === taskId ? true : null
  })

  listbox.focus()
  dispatchKey(listbox, 'Enter')

  const paper = await waitFor(
    `${label}: inline editor mount`,
    () => document.querySelector<HTMLElement>('.task-inline-paper'),
    { timeoutMs: 15_000 }
  )

  const titleInput = await waitFor(
    `${label}: title input`,
    () => paper.querySelector<HTMLInputElement>('#task-title')
  )
  await waitFor(`${label}: title focused`, () => (document.activeElement === titleInput ? true : null))

  const notesInput = await waitFor(
    `${label}: notes input`,
    () => paper.querySelector<HTMLTextAreaElement>('#task-notes')
  )

  return { paper, titleInput, notesInput }
}

async function assertChecklistEmptyStateBehavior(paper: HTMLElement, label: string) {
  // Empty checklist should show the quick-add button.
  const bar = getInlineActionBarRight(paper)
  const checklistButton = findButtonByText(bar, 'Checklist')
  if (!checklistButton) throw new Error(`${label}: missing Checklist button when empty`)

  checklistButton.click()

  const createInput = await waitFor(
    `${label}: checklist create input`,
    () => paper.querySelector<HTMLInputElement>('input[placeholder="Add checklist item…"]')
  )
  await waitFor(
    `${label}: checklist input focused`,
    () => (document.activeElement === createInput ? true : null)
  )

  setNativeInputValue(createInput, 'First item')
  // Allow React state to catch up before key handler reads `draft`.
  await sleep(50)
  dispatchKey(createInput, 'Enter')

  await waitFor(`${label}: checklist item created`, () => {
    const rows = paper.querySelectorAll('.checklist-row')
    return rows.length >= 1 ? true : null
  })

  await waitFor(`${label}: checklist button hidden when non-empty`, () => {
    const bar = getInlineActionBarRight(paper)
    return findButtonByText(bar, 'Checklist') ? null : true
  })

  const deleteButton = await waitFor(`${label}: delete checklist item`, () => {
    const btns = Array.from(paper.querySelectorAll<HTMLButtonElement>('.checklist-row button'))
    return btns.find((b) => (b.textContent ?? '').trim() === 'Delete') ?? null
  })
  deleteButton.click()

  await waitFor(`${label}: checklist section collapsed`, () => {
    const list = paper.querySelector('.checklist')
    return list ? null : true
  })

  await waitFor(`${label}: checklist button returns when empty`, () => {
    const bar = getInlineActionBarRight(paper)
    return findButtonByText(bar, 'Checklist') ? true : null
  })
}

async function closeEditorWithEscape(taskId: string, label: string) {
  const titleInput = await waitFor(`${label}: title input for close`, () =>
    document.querySelector<HTMLInputElement>('#task-title')
  )
  dispatchKey(titleInput, 'Escape')
  await waitFor(`${label}: inline editor collapse`, () => (getInlinePaper() ? null : true))
  const focusTarget = await waitFor(`${label}: focus target`, () => findTaskButton(taskId))
  await waitFor(`${label}: focus restored`, () => (document.activeElement === focusTarget ? true : null))
}

async function closeEditorWithCmdEnter(taskId: string, label: string) {
  const titleInput = await waitFor(`${label}: title input for close`, () =>
    document.querySelector<HTMLInputElement>('#task-title')
  )
  dispatchKey(titleInput, 'Enter', { metaKey: true })
  await waitFor(`${label}: inline editor collapse`, () => (getInlinePaper() ? null : true), { timeoutMs: 20_000 })
  const focusTarget = await waitFor(`${label}: focus target`, () => findTaskButton(taskId))
  await waitFor(`${label}: focus restored`, () => (document.activeElement === focusTarget ? true : null))
}

async function runSelfTest(): Promise<SelfTestResult> {
  const failures: string[] = []

  // Ensure we don't touch real user data: main process should set a temp userData path.
  // Keep the token FTS-friendly (avoid characters like '-' that have special meaning in FTS5 queries).
  const token = `milestoselftest${Date.now()}`

  const prevForceError = (window as unknown as { __milestoForceTaskUpdateError?: boolean })
    .__milestoForceTaskUpdateError
  const prevDelay = (window as unknown as { __milestoTaskUpdateDelayMs?: number }).__milestoTaskUpdateDelayMs

  try {
    if (!('api' in window)) {
      throw new Error('window.api is missing (preload not available).')
    }

    const contentScroller = await waitFor('Content scroller', () =>
      document.querySelector<HTMLElement>('.content-scroll')
    )

    const today = formatLocalDate(new Date())
    const tomorrow = formatLocalDate(addDays(new Date(), 1))

    const nextWeekStart = (() => {
      const d = new Date()
      const day = d.getDay() // 0=Sun
      let delta = (8 - day) % 7
      if (delta === 0) delta = 7
      d.setDate(d.getDate() + delta)
      d.setHours(0, 0, 0, 0)
      return formatLocalDate(d)
    })()

    const nextMonthStart = (() => {
      const now = new Date()
      return formatLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 1))
    })()

    // Seed tasks for Inbox/Today/Upcoming flows.
    const inboxARes = await window.api.task.create({ title: `${token} Inbox A`, is_inbox: true })
    const inboxBRes = await window.api.task.create({ title: `${token} Inbox B`, is_inbox: true })
    if (!inboxARes.ok) throw new Error(`task.create inboxA failed: ${inboxARes.error.code}: ${inboxARes.error.message}`)
    if (!inboxBRes.ok) throw new Error(`task.create inboxB failed: ${inboxBRes.error.code}: ${inboxBRes.error.message}`)

    // Add enough Inbox tasks to exercise scrolling + virtualization stability.
    for (let i = 0; i < 28; i++) {
      const res = await window.api.task.create({ title: `${token} Inbox filler ${i}`, is_inbox: true })
      if (!res.ok) {
        throw new Error(`task.create inbox filler ${i} failed: ${res.error.code}: ${res.error.message}`)
      }
    }

    const todayARes = await window.api.task.create({
      title: `${token} Today A`,
      scheduled_at: today,
    })
    const todayBRes = await window.api.task.create({
      title: `${token} Today B`,
      scheduled_at: today,
    })
    if (!todayARes.ok) throw new Error(`task.create todayA failed: ${todayARes.error.code}: ${todayARes.error.message}`)
    if (!todayBRes.ok) throw new Error(`task.create todayB failed: ${todayBRes.error.code}: ${todayBRes.error.message}`)

    const upcomingARes = await window.api.task.create({
      title: `${token} Upcoming A`,
      scheduled_at: tomorrow,
    })
    const upcomingBRes = await window.api.task.create({
      title: `${token} Upcoming B`,
      scheduled_at: tomorrow,
    })

    // Ensure Upcoming view is scrollable so jump-button alignment is meaningful.
    for (let i = 0; i < 28; i++) {
      const res = await window.api.task.create({
        title: `${token} Upcoming filler ${i}`,
        scheduled_at: tomorrow,
      })
      if (!res.ok) {
        throw new Error(`task.create upcoming filler ${i} failed: ${res.error.code}: ${res.error.message}`)
      }
    }

    // Add tasks to enable Upcoming jump buttons (Next Week / Next Month).
    const upcomingWeekRes = await window.api.task.create({
      title: `${token} Upcoming Next Week`,
      scheduled_at: nextWeekStart,
    })
    const upcomingMonthRes = await window.api.task.create({
      title: `${token} Upcoming Next Month`,
      scheduled_at: nextMonthStart,
    })
    if (!upcomingARes.ok) throw new Error(`task.create upcomingA failed: ${upcomingARes.error.code}: ${upcomingARes.error.message}`)
    if (!upcomingBRes.ok) throw new Error(`task.create upcomingB failed: ${upcomingBRes.error.code}: ${upcomingBRes.error.message}`)
    if (!upcomingWeekRes.ok) throw new Error(`task.create upcomingWeek failed: ${upcomingWeekRes.error.code}: ${upcomingWeekRes.error.message}`)
    if (!upcomingMonthRes.ok) throw new Error(`task.create upcomingMonth failed: ${upcomingMonthRes.error.code}: ${upcomingMonthRes.error.message}`)

    // Ensure there's enough content AFTER Next Week/Next Month headers so scrollToIndex
    // can align those headers near the top even in a tall window.
    for (let i = 0; i < 28; i++) {
      const res = await window.api.task.create({
        title: `${token} Upcoming next month filler ${i}`,
        scheduled_at: nextMonthStart,
      })
      if (!res.ok) {
        throw new Error(`task.create upcoming next month filler ${i} failed: ${res.error.code}: ${res.error.message}`)
      }
    }

    const inboxAId = inboxARes.data.id
    const inboxBId = inboxBRes.data.id
    const todayAId = todayARes.data.id
    const todayBId = todayBRes.data.id
    const upcomingAId = upcomingARes.data.id
    const upcomingBId = upcomingBRes.data.id

    // Seed tasks for DnD list views (Anytime/Someday/Area).
    const anytimeDndARes = await window.api.task.create({ title: `${token} Anytime DnD A` })
    const anytimeDndBRes = await window.api.task.create({ title: `${token} Anytime DnD B` })
    if (!anytimeDndARes.ok) {
      throw new Error(
        `task.create anytimeDndA failed: ${anytimeDndARes.error.code}: ${anytimeDndARes.error.message}`
      )
    }
    if (!anytimeDndBRes.ok) {
      throw new Error(
        `task.create anytimeDndB failed: ${anytimeDndBRes.error.code}: ${anytimeDndBRes.error.message}`
      )
    }

    const somedayDndARes = await window.api.task.create({ title: `${token} Someday DnD A`, is_someday: true })
    const somedayDndBRes = await window.api.task.create({ title: `${token} Someday DnD B`, is_someday: true })
    if (!somedayDndARes.ok) {
      throw new Error(
        `task.create somedayDndA failed: ${somedayDndARes.error.code}: ${somedayDndARes.error.message}`
      )
    }
    if (!somedayDndBRes.ok) {
      throw new Error(
        `task.create somedayDndB failed: ${somedayDndBRes.error.code}: ${somedayDndBRes.error.message}`
      )
    }

    const areaRes = await window.api.area.create({ title: `${token} Area DnD A` })
    if (!areaRes.ok) {
      throw new Error(`area.create failed: ${areaRes.error.code}: ${areaRes.error.message}`)
    }
    const areaId = areaRes.data.id

    const areaTaskARes = await window.api.task.create({ title: `${token} Area Task A`, area_id: areaId })
    const areaTaskBRes = await window.api.task.create({ title: `${token} Area Task B`, area_id: areaId })
    if (!areaTaskARes.ok) {
      throw new Error(`task.create areaTaskA failed: ${areaTaskARes.error.code}: ${areaTaskARes.error.message}`)
    }
    if (!areaTaskBRes.ok) {
      throw new Error(`task.create areaTaskB failed: ${areaTaskBRes.error.code}: ${areaTaskBRes.error.message}`)
    }

    const anytimeDndAId = anytimeDndARes.data.id
    const anytimeDndBId = anytimeDndBRes.data.id
    const somedayDndAId = somedayDndARes.data.id
    const somedayDndBId = somedayDndBRes.data.id
    const areaTaskAId = areaTaskARes.data.id
    const areaTaskBId = areaTaskBRes.data.id

    // Seed a project for Project page flows (completed toggle + project completion).
    const projectRes = await window.api.project.create({ title: `${token} Project A` })
    if (!projectRes.ok) {
      throw new Error(
        `project.create failed: ${projectRes.error.code}: ${projectRes.error.message}`
      )
    }
    const projectId = projectRes.data.id
    const sectionARes = await window.api.project.createSection(projectId, `${token} Section A`)
    if (!sectionARes.ok) {
      throw new Error(
        `project.createSection failed: ${sectionARes.error.code}: ${sectionARes.error.message}`
      )
    }

    const sectionBRes = await window.api.project.createSection(projectId, `${token} Section B`)
    if (!sectionBRes.ok) {
      throw new Error(
        `project.createSection (B) failed: ${sectionBRes.error.code}: ${sectionBRes.error.message}`
      )
    }

    const projectOpenNoneRes = await window.api.task.create({
      title: `${token} Project Open None`,
      project_id: projectId,
    })
    if (!projectOpenNoneRes.ok) {
      throw new Error(
        `task.create projectOpenNone failed: ${projectOpenNoneRes.error.code}: ${projectOpenNoneRes.error.message}`
      )
    }

    const projectOpenSectionRes = await window.api.task.create({
      title: `${token} Project Open Section`,
      project_id: projectId,
      section_id: sectionARes.data.id,
    })
    if (!projectOpenSectionRes.ok) {
      throw new Error(
        `task.create projectOpenSection failed: ${projectOpenSectionRes.error.code}: ${projectOpenSectionRes.error.message}`
      )
    }

    const projectOpenSection2Res = await window.api.task.create({
      title: `${token} Project Open Section 2`,
      project_id: projectId,
      section_id: sectionARes.data.id,
    })
    if (!projectOpenSection2Res.ok) {
      throw new Error(
        `task.create projectOpenSection2 failed: ${projectOpenSection2Res.error.code}: ${projectOpenSection2Res.error.message}`
      )
    }

    const projectDoneRes = await window.api.task.create({
      title: `${token} Project Done`,
      project_id: projectId,
      section_id: sectionARes.data.id,
    })
    if (!projectDoneRes.ok) {
      throw new Error(
        `task.create projectDone failed: ${projectDoneRes.error.code}: ${projectDoneRes.error.message}`
      )
    }
    const projectDoneToggleRes = await window.api.task.toggleDone(projectDoneRes.data.id, true)
    if (!projectDoneToggleRes.ok) {
      throw new Error(
        `task.toggleDone projectDone failed: ${projectDoneToggleRes.error.code}: ${projectDoneToggleRes.error.message}`
      )
    }

    // Inbox (virtualized TaskList)
    window.location.hash = '/inbox'
    const inboxListbox = await waitFor('Inbox listbox', () =>
      document.querySelector<HTMLElement>('div.task-scroll[role="listbox"][aria-label="Tasks"]')
    )
    const inboxAButton = await waitFor('Inbox A row button', () => findTaskButton(inboxAId))
    const inboxBButton = await waitFor('Inbox B row button', () => findTaskButton(inboxBId))

    // Open via mouse and validate inline editor basics.
    const openedA = await openEditorByDoubleClick({
      taskId: inboxAId,
      button: inboxAButton,
      label: 'Inbox A (dblclick)',
    })

    // Done toggle exists in the editor header and does not collapse the editor.
    openedA.doneToggle.click()
    await sleep(200)
    if (!getInlinePaper()) {
      throw new Error('Inbox A: done toggle collapsed editor (should remain open)')
    }
    const doneToggleAgain = await waitFor('Inbox A: done toggle (again)', () => {
      const paper = getInlinePaper()
      return paper?.querySelector<HTMLInputElement>('.task-inline-header input[type="checkbox"]') ?? null
    })
    doneToggleAgain.click()
    await sleep(200)
    if (!getInlinePaper()) {
      throw new Error('Inbox A: done toggle collapsed editor on second toggle')
    }

    // Checklist empty-state button behavior.
    await assertChecklistEmptyStateBehavior(openedA.paper, 'Inbox A')
    assertNoOverlap(inboxListbox, 'Inbox A: after checklist add/remove')

    // Notes growth should not overlap other rows.
    const scrollBeforeNotes = contentScroller.scrollTop
    openedA.notesInput.focus()
    setNativeInputValue(
      openedA.notesInput,
      Array.from({ length: 18 })
        .map((_, i) => `note line ${i + 1}`)
        .join('\n')
    )
    await sleep(700)
    assertNoOverlap(inboxListbox, 'Inbox A: after notes growth')
    assertEditorInView(inboxListbox, openedA.paper, 'Inbox A')
    if (Math.abs(contentScroller.scrollTop - scrollBeforeNotes) > 320) {
      throw new Error('Inbox A: scroll jumped too much while editing notes')
    }

    // Editor keyboard events should not trigger list-level navigation or toggles.
    openedA.notesInput.focus()
    dispatchKey(openedA.notesInput, 'ArrowDown')
    await sleep(50)
    if (getSelectedTaskId() !== inboxAId) {
      throw new Error('Inbox A: ArrowDown inside editor changed list selection')
    }
    dispatchKey(openedA.notesInput, ' ')
    await sleep(200)
    const inboxADetailAfterSpace = await window.api.task.getDetail(inboxAId)
    if (!inboxADetailAfterSpace.ok) {
      throw new Error(
        `Inbox A getDetail after Space failed: ${inboxADetailAfterSpace.error.code}: ${inboxADetailAfterSpace.error.message}`
      )
    }
    if (inboxADetailAfterSpace.data.task.status === 'done') {
      throw new Error('Inbox A: Space inside editor toggled done')
    }

    // Switching tasks should flush current draft before opening next.
    ;(window as unknown as { __milestoTaskUpdateDelayMs?: number }).__milestoTaskUpdateDelayMs = 800
    const finalInboxATitle = `${token} Inbox A FINAL ${Date.now()}`
    setNativeInputValue(openedA.titleInput, `${token} Inbox A 1`)
    await sleep(520)
    await waitFor('Inbox A shows Saving…', () => {
      const status = openedA.paper.querySelector<HTMLElement>('.task-inline-status')
      return (status?.textContent ?? '').includes('Saving') ? true : null
    })
    setNativeInputValue(openedA.titleInput, finalInboxATitle)

    dispatchDblClick(inboxBButton)
    const inboxBTitleInput = await waitFor(
      'Inbox B title input after switch',
      () => {
        const paper = getInlinePaper()
        if (!paper) return null
        const input = paper.querySelector<HTMLInputElement>('#task-title')
        if (!input) return null
        return input.value.includes('Inbox B') ? input : null
      },
      { timeoutMs: 25_000 }
    )

    const inboxADetailAfterSwitch = await window.api.task.getDetail(inboxAId)
    if (!inboxADetailAfterSwitch.ok) {
      throw new Error(
        `Inbox A getDetail failed: ${inboxADetailAfterSwitch.error.code}: ${inboxADetailAfterSwitch.error.message}`
      )
    }
    if (inboxADetailAfterSwitch.data.task.title !== finalInboxATitle) {
      throw new Error(
        `Inbox A title mismatch after switch: expected "${finalInboxATitle}" got "${inboxADetailAfterSwitch.data.task.title}"`
      )
    }

    // Flush with Cmd+Enter on Inbox B.
    const finalInboxBTitle = `${token} Inbox B FINAL ${Date.now()}`
    setNativeInputValue(inboxBTitleInput, finalInboxBTitle)
    await sleep(520)
    await closeEditorWithCmdEnter(inboxBId, 'Inbox B')

    const inboxBDetail = await window.api.task.getDetail(inboxBId)
    if (!inboxBDetail.ok) {
      throw new Error(`Inbox B getDetail failed: ${inboxBDetail.error.code}: ${inboxBDetail.error.message}`)
    }
    if (inboxBDetail.data.task.title !== finalInboxBTitle) {
      throw new Error(`Inbox B title mismatch: expected "${finalInboxBTitle}" got "${inboxBDetail.data.task.title}"`)
    }

    // Scroll stability check: open an editor while scrolled.
    ;(window as unknown as { __milestoTaskUpdateDelayMs?: number }).__milestoTaskUpdateDelayMs = 0

    const inboxListboxNow = await waitFor('Inbox listbox (scroll test)', () =>
      document.querySelector<HTMLElement>('div.task-scroll[role="listbox"][aria-label="Tasks"]')
    )

    await waitFor('Inbox rows rendered (pre-scroll)', () => {
      const btns = inboxListboxNow.querySelectorAll('.task-title-button[data-task-id]')
      return btns.length > 0 ? true : null
    })

    contentScroller.scrollTop = Math.floor(contentScroller.scrollHeight / 2)
    const visibleButtons = await waitFor('Inbox visible rows after scroll', () => {
      const btns = Array.from(
        inboxListboxNow.querySelectorAll<HTMLButtonElement>('.task-title-button[data-task-id]')
      )
      return btns.length > 0 ? btns : null
    })
    const midButton = visibleButtons[Math.floor(visibleButtons.length / 2)]
    if (!midButton) throw new Error('Inbox scroll test: no visible task rows after scrolling')
    const midTaskId = midButton.getAttribute('data-task-id')
    if (!midTaskId) throw new Error('Inbox scroll test: missing data-task-id')

    const beforeScroll = contentScroller.scrollTop
    const openedMid = await openEditorByDoubleClick({
      taskId: midTaskId,
      button: midButton,
      label: 'Inbox mid (dblclick)',
    })
    setNativeInputValue(openedMid.notesInput, `scroll test\n${'x'.repeat(200)}\n${'y'.repeat(200)}\nend`)
    await sleep(700)
    assertNoOverlap(inboxListboxNow, 'Inbox mid: after notes growth')
    assertEditorInView(inboxListboxNow, openedMid.paper, 'Inbox mid')
    const midDelta = Math.abs(contentScroller.scrollTop - beforeScroll)
    if (midDelta > 360) {
      throw new Error(`Inbox mid: scroll jumped too much while editing notes (delta=${midDelta})`)
    }
    await closeEditorWithEscape(midTaskId, 'Inbox mid')

    // Scroll back to the top so Inbox A is rendered again (virtualization).
    contentScroller.scrollTop = 0
    await sleep(150)
    const inboxAButtonTop = await waitFor('Inbox A row button (post-scroll)', () => findTaskButton(inboxAId))

    // Failed flush blocks close, Retry allows close.
    const openedA2 = await openEditorByEnter({
      listbox: inboxListboxNow,
      taskId: inboxAId,
      button: inboxAButtonTop,
      label: 'Inbox A (enter)',
    })
    ;(window as unknown as { __milestoForceTaskUpdateError?: boolean }).__milestoForceTaskUpdateError = true
    setNativeInputValue(openedA2.titleInput, `${token} Inbox A FAIL ${Date.now()}`)
    await sleep(520)

    dispatchKey(openedA2.titleInput, 'Escape')
    await sleep(200)
    if (!getInlinePaper()) {
      throw new Error('Inbox A: editor collapsed even though save is failing (flush should block close).')
    }

    ;(window as unknown as { __milestoForceTaskUpdateError?: boolean }).__milestoForceTaskUpdateError = false
    const retryButton = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.task-inline-header .button')
    ).find((b) => (b.textContent ?? '').trim() === 'Retry')
    if (!retryButton) throw new Error('Inbox A: Retry button not found after forced save error.')
    retryButton.click()
    await sleep(300)
    await closeEditorWithEscape(inboxAId, 'Inbox A (after retry)')

    // Today (virtualized TaskList)
    window.location.hash = '/today'
    await waitFor('Today listbox', () =>
      document.querySelector<HTMLElement>('div.task-scroll[role="listbox"][aria-label="Tasks"]')
    )
    const todayAButton = await waitFor('Today A row button', () => findTaskButton(todayAId))
    await waitFor('Today B row button', () => findTaskButton(todayBId))

    const openedTodayA = await openEditorByDoubleClick({
      taskId: todayAId,
      button: todayAButton,
      label: 'Today A (dblclick)',
    })
    await assertChecklistEmptyStateBehavior(openedTodayA.paper, 'Today A')
    openedTodayA.notesInput.focus()
    setNativeInputValue(openedTodayA.notesInput, 'today notes\nline 2\nline 3\nline 4')
    await sleep(900)

    const todayListboxNow = await waitFor('Today listbox (post-edit)', () =>
      document.querySelector<HTMLElement>('div.task-scroll[role="listbox"][aria-label="Tasks"]')
    )
    assertNoOverlap(todayListboxNow, 'Today A: after notes + checklist')
    assertEditorInView(todayListboxNow, openedTodayA.paper, 'Today A')
    await closeEditorWithEscape(todayAId, 'Today A')

    // Keyboard navigation should still work with headers/editor rows out of the way.
    todayListboxNow.focus()
    dispatchKey(todayListboxNow, 'ArrowDown')
    await waitFor('Today selects B after ArrowDown', () => (getSelectedTaskId() === todayBId ? true : null))

    // Regression: keyboard navigation scrolling should affect the main scroller.
    const navScrollBefore = contentScroller.scrollTop
    for (let i = 0; i < 40; i++) dispatchKey(todayListboxNow, 'ArrowDown')
    await sleep(100)
    const canScroll = contentScroller.scrollHeight > contentScroller.clientHeight + 1
    if (canScroll && contentScroller.scrollTop === navScrollBefore) {
      throw new Error('Today: ArrowDown navigation did not scroll the main content container')
    }

    // Upcoming (virtualized UpcomingGroupedList with headers)
    window.location.hash = '/upcoming'
    const upcomingListbox = await waitFor('Upcoming listbox', () =>
      document.querySelector<HTMLElement>('div.task-scroll[role="listbox"][aria-label="Upcoming tasks"]')
    )
    if (upcomingListbox.querySelector('.task-title-button.is-dnd-activator')) {
      throw new Error('Upcoming: drag-and-drop activator should not be present')
    }
    await waitFor('Upcoming A row button', () => findTaskButton(upcomingAId))
    await waitFor('Upcoming B row button', () => findTaskButton(upcomingBId))

    // Regression: jump buttons should align headers correctly with content above the list.
    const nextWeekBtn = findButtonByText(document, 'Next Week')
    const nextMonthBtn = findButtonByText(document, 'Next Month')
    if (!nextWeekBtn) throw new Error('Upcoming: missing Next Week button')
    if (!nextMonthBtn) throw new Error('Upcoming: missing Next Month button')

    nextWeekBtn.click()
    await sleep(250)
    await waitForUpcomingHeaderNearTop({
      date: nextWeekStart,
      label: 'Upcoming scrolled to next week header',
      contentScroller,
      listbox: upcomingListbox,
    })

    nextMonthBtn.click()
    await sleep(250)
    await waitForUpcomingHeaderNearTop({
      date: nextMonthStart,
      label: 'Upcoming scrolled to next month header',
      contentScroller,
      listbox: upcomingListbox,
    })

    // Jumping may scroll far enough to unmount the early rows. Return to the top so we can
    // interact with Upcoming A/B reliably.
    contentScroller.scrollTop = 0
    await sleep(150)
    const upcomingAButtonNow = await waitFor('Upcoming A row button (post jump)', () => findTaskButton(upcomingAId))

    // Arrow navigation should skip non-task rows.
    upcomingAButtonNow.click()
    await waitFor('Upcoming A selected', () => (getSelectedTaskId() === upcomingAId ? true : null))
    upcomingListbox.focus()
    dispatchKey(upcomingListbox, 'ArrowDown')
    await waitFor('Upcoming B selected via ArrowDown', () => (getSelectedTaskId() === upcomingBId ? true : null))

    dispatchKey(upcomingListbox, 'Enter')
    const openedUpcomingB = await waitFor('Upcoming B editor mount', () => {
      const paper = getInlinePaper()
      const title = paper?.querySelector<HTMLInputElement>('#task-title')
      return paper && title ? { paper, title } : null
    })
    await waitFor('Upcoming B title focused', () =>
      document.activeElement === openedUpcomingB.title ? true : null
    )

    const paper = openedUpcomingB.paper
    const notes = await waitFor('Upcoming B notes', () => paper.querySelector<HTMLTextAreaElement>('#task-notes'))
    await assertChecklistEmptyStateBehavior(paper, 'Upcoming B')
    notes.focus()
    setNativeInputValue(notes, 'upcoming notes\nline 2\nline 3\nline 4\nline 5\nline 6')
    await sleep(900)
    assertNoOverlap(upcomingListbox, 'Upcoming B: after notes + checklist')
    assertEditorInView(upcomingListbox, paper, 'Upcoming B')

    await closeEditorWithEscape(upcomingBId, 'Upcoming B')

    // Project page (grouped list + completed toggle + project completion)
    window.location.hash = `/projects/${projectId}`
    let projectListbox = await waitFor('Project listbox', () =>
      document.querySelector<HTMLElement>('div.task-scroll[role="listbox"][aria-label="Project tasks"]')
    )

    // Section header rows participate in selection and can enter inline title editing.
    projectListbox.focus()
    dispatchKey(projectListbox, 'ArrowDown')
    await sleep(50)
    dispatchKey(projectListbox, 'ArrowDown')
    await waitFor('Project: section header selected', () => {
      const el = document.querySelector<HTMLElement>(
        `.project-group-header.is-selected[data-section-id="${sectionARes.data.id}"]`
      )
      return el ? true : null
    })

    dispatchKey(projectListbox, 'Enter')
    const sectionTitleInput = await waitFor('Project: section title input', () =>
      document.querySelector<HTMLInputElement>('input.project-group-title-input[aria-label="Section title"]')
    )
    await waitFor('Project: section title input focused', () =>
      document.activeElement === sectionTitleInput ? true : null
    )
    dispatchKey(sectionTitleInput, 'Escape')
    await waitFor('Project: section edit exited', () =>
      document.querySelector('input.project-group-title-input[aria-label="Section title"]') ? null : true
    )

    // Safe-close: if a task editor is open, Enter on a selected section should flush+close it first.
    const projectOpenNoneButtonForEditor = await waitFor('Project open none button (for editor)', () =>
      findTaskButton(projectOpenNoneRes.data.id)
    )
    await openEditorByEnter({
      listbox: projectListbox,
      taskId: projectOpenNoneRes.data.id,
      button: projectOpenNoneButtonForEditor,
      label: 'Project open none (enter)',
    })

    projectListbox.focus()
    dispatchKey(projectListbox, 'ArrowDown')
    await waitFor('Project: section header selected (with editor open)', () => {
      const el = document.querySelector<HTMLElement>(
        `.project-group-header.is-selected[data-section-id="${sectionARes.data.id}"]`
      )
      return el ? true : null
    })
    dispatchKey(projectListbox, 'Enter')
    await waitFor('Project: task editor closed before section edit', () => (getInlinePaper() ? null : true), {
      timeoutMs: 20_000,
    })
    const sectionTitleInputAfterClose = await waitFor('Project: section title input (after close)', () =>
      document.querySelector<HTMLInputElement>('input.project-group-title-input[aria-label="Section title"]')
    )
    await waitFor('Project: section title focused (after close)', () =>
      document.activeElement === sectionTitleInputAfterClose ? true : null
    )
    dispatchKey(sectionTitleInputAfterClose, 'Escape')
    await waitFor('Project: section edit exited (after close)', () =>
      document.querySelector('input.project-group-title-input[aria-label="Section title"]') ? null : true
    )

    // Reset scroll position so later Project assertions can find expected rows.
    contentScroller.scrollTop = 0
    await sleep(150)

    // Section DnD: pointer reorder + persistence across navigation/reload-like flow.
    const sectionBHandle = await waitFor('Project: drag handle (section B)', () =>
      findSectionDragHandle(sectionBRes.data.id)
    )
    const sectionAHeaderForSectionMove = await waitFor('Project: section A header (section reorder target)', () =>
      document.querySelector<HTMLElement>(`.project-group-header[data-section-id="${sectionARes.data.id}"]`)
    )
    const sectionATargetRect = sectionAHeaderForSectionMove.getBoundingClientRect()

    await dragHandleToPoint({
      label: 'Project: reorder sections (pointer)',
      handle: sectionBHandle,
      to: {
        x: sectionATargetRect.left + sectionATargetRect.width / 2,
        y: sectionATargetRect.top + sectionATargetRect.height * 0.25,
      },
      overlaySelector: '.project-section-dnd-overlay',
    })
    await sleep(250)

    const sectionsAfterPointerReorder = await window.api.project.listSections(projectId)
    if (!sectionsAfterPointerReorder.ok) {
      throw new Error(
        `Project: listSections after pointer section reorder failed: ${sectionsAfterPointerReorder.error.code}: ${sectionsAfterPointerReorder.error.message}`
      )
    }
    const pointerOrder = sectionsAfterPointerReorder.data.map((section) => section.id)
    const pointerAIndex = pointerOrder.indexOf(sectionARes.data.id)
    const pointerBIndex = pointerOrder.indexOf(sectionBRes.data.id)
    if (pointerAIndex < 0 || pointerBIndex < 0 || pointerBIndex >= pointerAIndex) {
      throw new Error('Project: expected Section B to move before Section A after pointer section reorder')
    }

    window.location.hash = '/today'
    await waitFor('Today listbox (after section reorder)', () =>
      document.querySelector<HTMLElement>('div.task-scroll[role="listbox"][aria-label="Tasks"]')
    )
    window.location.hash = `/projects/${projectId}`
    projectListbox = await waitFor('Project listbox (after section reorder return)', () =>
      document.querySelector<HTMLElement>('div.task-scroll[role="listbox"][aria-label="Project tasks"]')
    )

    await waitFor('Project: section order persisted after navigation', () => {
      const headers = Array.from(document.querySelectorAll<HTMLElement>('.project-group-header[data-section-id]'))
      const ids = headers
        .map((el) => el.getAttribute('data-section-id'))
        .filter((id): id is string => !!id)
      const aIndex = ids.indexOf(sectionARes.data.id)
      const bIndex = ids.indexOf(sectionBRes.data.id)
      if (aIndex < 0 || bIndex < 0) return null
      return bIndex < aIndex ? true : null
    })

    // Keyboard section reorder: move Section B down by one (back to original order).
    const sectionBHandleForKey = await waitFor('Project: section B drag handle (for keyboard)', () =>
      findSectionDragHandle(sectionBRes.data.id)
    )
    sectionBHandleForKey.click()
    await waitFor('Project: section B selected (for keyboard reorder)', () => {
      const el = document.querySelector<HTMLElement>(
        `.project-group-header.is-selected[data-section-id="${sectionBRes.data.id}"]`
      )
      return el ? true : null
    })
    dispatchKey(sectionBHandleForKey, 'ArrowDown', { metaKey: true, ctrlKey: true, shiftKey: true })
    await sleep(250)

    const sectionsAfterKeyboardReorder = await window.api.project.listSections(projectId)
    if (!sectionsAfterKeyboardReorder.ok) {
      throw new Error(
        `Project: listSections after keyboard section reorder failed: ${sectionsAfterKeyboardReorder.error.code}: ${sectionsAfterKeyboardReorder.error.message}`
      )
    }
    const keyboardOrder = sectionsAfterKeyboardReorder.data.map((section) => section.id)
    const keyboardAIndex = keyboardOrder.indexOf(sectionARes.data.id)
    const keyboardBIndex = keyboardOrder.indexOf(sectionBRes.data.id)
    if (keyboardAIndex < 0 || keyboardBIndex < 0 || keyboardAIndex >= keyboardBIndex) {
      throw new Error('Project: expected keyboard section reorder to move Section B after Section A')
    }

    // DnD smoke: reorder within Section A and move into empty Section B.
    const projectOpenSectionId = projectOpenSectionRes.data.id
    const projectOpenSection2Id = projectOpenSection2Res.data.id
    const sectionBId = sectionBRes.data.id

    await waitFor('Project: open section task 1 visible', () => findTaskButton(projectOpenSectionId))
    await waitFor('Project: open section task 2 visible', () => findTaskButton(projectOpenSection2Id))

    const handleProject2 = await waitFor('Project: drag handle (task 2)', () => findDragHandle(projectOpenSection2Id))
    const targetRowProject1 = await waitFor('Project: task 1 row element', () =>
      document.querySelector<HTMLElement>(`.task-row[data-task-id="${projectOpenSectionId}"]`)
    )
    const r1 = targetRowProject1.getBoundingClientRect()
    await dragHandleToPoint({
      label: 'Project: reorder within section',
      handle: handleProject2,
      to: { x: r1.left + r1.width / 2, y: r1.top + r1.height * 0.25 },
    })
    await sleep(250)

    const projectAfterReorder = await window.api.task.listProject(projectId)
    if (!projectAfterReorder.ok) {
      throw new Error(
        `Project: listProject after reorder failed: ${projectAfterReorder.error.code}: ${projectAfterReorder.error.message}`
      )
    }
    const p1 = projectAfterReorder.data.find((t) => t.id === projectOpenSectionId)
    const p2 = projectAfterReorder.data.find((t) => t.id === projectOpenSection2Id)
    if (!p1 || !p2) throw new Error('Project: missing reordered tasks in listProject')
    if (p1.rank == null || p2.rank == null) {
      throw new Error('Project: expected rank to be set after reorderBatch')
    }
    if (p2.rank >= p1.rank) {
      throw new Error('Project: expected task 2 to be ranked before task 1 after reorder')
    }

    // Keyboard reorder within the selected task's current section.
    const projectTask2ButtonForKey = await waitFor('Project: task 2 button (for keyboard)', () =>
      findTaskButton(projectOpenSection2Id)
    )
    projectTask2ButtonForKey.click()
    await waitFor('Project: task 2 selected (for keyboard)', () =>
      getSelectedTaskId() === projectOpenSection2Id ? true : null
    )
    // Dispatch from the focused row button so the event bubbles to the listbox handler.
    dispatchKey(projectTask2ButtonForKey, 'ArrowDown', { metaKey: true, ctrlKey: true, shiftKey: true })
    await sleep(250)

    const projectAfterKeyboard = await window.api.task.listProject(projectId)
    if (!projectAfterKeyboard.ok) {
      throw new Error(
        `Project: listProject after keyboard reorder failed: ${projectAfterKeyboard.error.code}: ${projectAfterKeyboard.error.message}`
      )
    }
    const pk1 = projectAfterKeyboard.data.find((t) => t.id === projectOpenSectionId)
    const pk2 = projectAfterKeyboard.data.find((t) => t.id === projectOpenSection2Id)
    if (!pk1 || !pk2) throw new Error('Project: missing tasks after keyboard reorder')
    if (pk1.rank == null || pk2.rank == null) {
      throw new Error('Project: expected rank to be set after keyboard reorder')
    }
    if (pk1.rank >= pk2.rank) {
      throw new Error('Project: expected task 2 to move down after Ctrl+Shift+ArrowDown')
    }

    await scrollUntil('Project: Section B header visible', {
      scroller: contentScroller,
      get: () =>
        document.querySelector<HTMLElement>(`.project-group-header[data-section-id="${sectionBId}"]`),
      stepPx: 120,
      timeoutMs: 10_000,
      intervalMs: 60,
    })
    const handleProject2ForMove = await waitFor('Project: drag handle (task 2, move)', () =>
      findDragHandle(projectOpenSection2Id)
    )

    // Inline drag so we can assert destination reflow/placeholder behavior.
    {
      const startRect = handleProject2ForMove.getBoundingClientRect()
      // Use the same non-center start point formula as dragHandleToPoint.
      const start = {
        x: startRect.left + Math.min(Math.max(startRect.width * 0.25, 8), startRect.width - 8),
        y: startRect.top + Math.min(Math.max(startRect.height * 0.35, 6), startRect.height - 6),
      }

      dispatchMouse(handleProject2ForMove, 'mousedown', {
        clientX: start.x,
        clientY: start.y,
        button: 0,
        buttons: 1,
      })
      dispatchMouse(document, 'mousemove', {
        clientX: start.x + 24,
        clientY: start.y + 18,
        button: 0,
        buttons: 1,
      })
      await waitFor('Project: move across sections overlay shown', () =>
        document.querySelector<HTMLElement>('.task-dnd-overlay')
      )

      // Re-query header to account for list reflow after drag starts.
      const liveHeaderB = document.querySelector<HTMLElement>(
        `.project-group-header[data-section-id="${sectionBId}"]`
      )
      if (!liveHeaderB) throw new Error('Project: Section B header disappeared after drag start')
      const hbLiveInitial = liveHeaderB.getBoundingClientRect()
      const to = {
        x: hbLiveInitial.left + hbLiveInitial.width / 2,
        y: hbLiveInitial.top + hbLiveInitial.height / 2,
      }

      dispatchMouse(document, 'mousemove', {
        clientX: to.x,
        clientY: to.y,
        button: 0,
        buttons: 1,
      })

      // During drag, the destination section should show insertion feedback by reflow/placeholder
      // (i.e., the dragged task appears to occupy a slot near the destination header).
      // Use polling to wait for the placeholder to move below the header, as layout shifts
      // may take a few frames to stabilize.
      await waitFor(
        'Project: reflow placeholder shown in Section B',
        () => {
          const header = document.querySelector<HTMLElement>(
            `.project-group-header[data-section-id="${sectionBId}"]`
          )
          const row = document.querySelector<HTMLElement>(
            `.task-row[data-task-id="${projectOpenSection2Id}"]`
          )
          if (!header || !row) return null
          const hr = header.getBoundingClientRect()
          const dr = row.getBoundingClientRect()
          // If row top is at or below header top (with a small margin), it means 
          // the placeholder has reflowed into the destination section.
          return dr.top >= hr.top - 4 ? true : null
        },
        { timeoutMs: 3000 }
      )

      dispatchMouse(document, 'mouseup', {
        clientX: to.x,
        clientY: to.y,
        button: 0,
        buttons: 0,
      })
      await waitFor('Project: move across sections overlay hidden', () =>
        document.querySelector<HTMLElement>('.task-dnd-overlay') ? null : true
      )
    }

    await sleep(250)

    const movedDetail = await window.api.task.getDetail(projectOpenSection2Id)
    if (!movedDetail.ok) {
      throw new Error(
        `Project: getDetail after move failed: ${movedDetail.error.code}: ${movedDetail.error.message}`
      )
    }
    if (movedDetail.data.task.section_id !== sectionBId) {
      throw new Error('Project: expected task.section_id to update after cross-section drop')
    }

    const projectAfterMove = await window.api.task.listProject(projectId)
    if (!projectAfterMove.ok) {
      throw new Error(
        `Project: listProject after move failed: ${projectAfterMove.error.code}: ${projectAfterMove.error.message}`
      )
    }
    const openInSectionB = projectAfterMove.data.filter((t) => t.status === 'open' && t.section_id === sectionBId)
    if (openInSectionB.length === 0) {
      throw new Error('Project: expected Section B to have open tasks after cross-section drop')
    }
    if (openInSectionB[0]?.id !== projectOpenSection2Id) {
      throw new Error('Project: expected moved task to be first in Section B after cross-section drop')
    }
    if (openInSectionB[0]?.rank == null) {
      throw new Error('Project: expected rank to be set after cross-section drop')
    }

    // Tail dropzone move: move task 1 to the end of Section B (using the tail dropzone on task 2).
    const handleProject1ForTail = await waitFor('Project: drag handle (task 1, tail move)', () =>
      findDragHandle(projectOpenSectionId)
    )
    const rowProject2InSectionB = await waitFor('Project: task 2 row in Section B', () =>
      document.querySelector<HTMLElement>(`.task-row[data-task-id="${projectOpenSection2Id}"]`)
    )
    const tailDropzone = await waitFor('Project: Section B tail dropzone', () =>
      rowProject2InSectionB.querySelector<HTMLElement>('.project-section-tail-dropzone')
    )
    const tr = tailDropzone.getBoundingClientRect()
    await dragHandleToPoint({
      label: 'Project: move to tail of section',
      handle: handleProject1ForTail,
      to: { x: tr.left + tr.width / 2, y: tr.top + tr.height / 2 },
    })
    await sleep(250)

    const projectAfterTailMove = await window.api.task.listProject(projectId)
    if (!projectAfterTailMove.ok) {
      throw new Error(
        `Project: listProject after tail move failed: ${projectAfterTailMove.error.code}: ${projectAfterTailMove.error.message}`
      )
    }
    const openInBAfterTail = projectAfterTailMove.data
      .filter((t) => t.status === 'open' && t.section_id === sectionBId)
      .sort((a, b) => ((a.rank ?? '') < (b.rank ?? '') ? -1 : 1))

    if (openInBAfterTail.length !== 2) {
      throw new Error(`Project: expected 2 tasks in Section B, got ${openInBAfterTail.length}`)
    }
    if (openInBAfterTail[1].id !== projectOpenSectionId) {
      throw new Error('Project: expected task 1 to be at the end of Section B')
    }

    // No-section drop: ensure a task can be dropped into the no-section container even when empty.
    const projectOpenNoneId = projectOpenNoneRes.data.id
    {
      contentScroller.scrollTop = 0
      await sleep(150)

      const sectionAHeader = await waitFor('Project: Section A header (for no-section test)', () =>
        document.querySelector<HTMLElement>(`.project-group-header[data-section-id="${sectionARes.data.id}"]`)
      )
      const ha = sectionAHeader.getBoundingClientRect()

      const handleNoSection = await waitFor('Project: drag handle (no-section task)', () =>
        findDragHandle(projectOpenNoneId)
      )
      await dragHandleToPoint({
        label: 'Project: move no-section task into Section A',
        handle: handleNoSection,
        to: { x: ha.left + ha.width / 2, y: ha.top + ha.height / 2 },
      })
      await sleep(250)

      const noneMoved = await window.api.task.getDetail(projectOpenNoneId)
      if (!noneMoved.ok) {
        throw new Error(
          `Project: getDetail no-section after move failed: ${noneMoved.error.code}: ${noneMoved.error.message}`
        )
      }
      if (noneMoved.data.task.section_id !== sectionARes.data.id) {
        throw new Error('Project: expected no-section task to move into Section A')
      }

      // No-section group should not show a visible header row, but should remain droppable.
      if (document.querySelector('.project-group-header[data-section-id="none"]')) {
        throw new Error('Project: no-section header should not be rendered')
      }

      const noSectionDropZone = await waitFor('Project: no-section drop zone visible', () =>
        document.querySelector<HTMLElement>('.project-no-section-dropzone')
      )
      const hn = noSectionDropZone.getBoundingClientRect()

      const handleSectionTask = await waitFor('Project: drag handle (section task -> no section)', () =>
        findDragHandle(projectOpenSectionId)
      )
      await dragHandleToPoint({
        label: 'Project: move section task into no-section',
        handle: handleSectionTask,
        to: { x: hn.left + hn.width / 2, y: hn.top + hn.height / 2 },
      })
      await sleep(250)

      const movedToNone = await window.api.task.getDetail(projectOpenSectionId)
      if (!movedToNone.ok) {
        throw new Error(
          `Project: getDetail after move to no-section failed: ${movedToNone.error.code}: ${movedToNone.error.message}`
        )
      }
      if (movedToNone.data.task.section_id !== null) {
        throw new Error('Project: expected task.section_id=null after dropping into no-section')
      }
    }

    // Keep later Project assertions stable.
    contentScroller.scrollTop = 0
    await sleep(150)

    const completedToggle = await waitFor('Project completed toggle', () =>
      findButtonContainingText(document, 'Completed')
    )

    // Completed tasks are collapsed by default.
    if (findTaskButton(projectDoneRes.data.id)) {
      throw new Error('Project: completed tasks visible by default (should be collapsed)')
    }

    completedToggle.click()
    await waitFor('Project done task visible after expand', () =>
      findTaskButton(projectDoneRes.data.id)
    )
    assertNoOverlap(projectListbox, 'Project: after expand')

    completedToggle.click()
    await waitFor('Project done task hidden after collapse', () =>
      findTaskButton(projectDoneRes.data.id) ? null : true
    )

    // Project completion requires confirmation; auto-accept during self-test.
    const prevConfirm = window.confirm
    ;(window as unknown as { confirm: (message?: string) => boolean }).confirm = () => true
    try {
      const projectDoneCheckbox = await waitFor('Project done checkbox', () =>
        document.querySelector<HTMLInputElement>('.page-header input[type="checkbox"]')
      )

      projectDoneCheckbox.click()

      await waitFor('Project checkbox checked + disabled', () => {
        const cb = document.querySelector<HTMLInputElement>('.page-header input[type="checkbox"]')
        return cb && cb.checked && cb.disabled ? cb : null
      })

      // Open tasks should disappear (they were completed).
      await waitFor('Project open tasks hidden', () =>
        findTaskButton(projectOpenNoneRes.data.id) ? null : true
      )
      await waitFor('Project open section tasks hidden', () =>
        findTaskButton(projectOpenSectionRes.data.id) ? null : true
      )
      await waitFor('Project open section tasks hidden (second)', () =>
        findTaskButton(projectOpenSection2Res.data.id) ? null : true
      )

      // Expand to see completed tasks (including previously-open tasks).
      const completedToggleAfterComplete = await waitFor('Project completed toggle (post complete)', () =>
        findButtonContainingText(document, 'Completed')
      )
      completedToggleAfterComplete.click()

      // Ensure top-of-list rows are rendered before asserting visibility in a virtualized list.
      contentScroller.scrollTop = 0
      await sleep(150)

      await waitFor('Project done task visible (post complete)', () =>
        findTaskButton(projectDoneRes.data.id)
      )

      try {
        await waitFor(
          'Project former open task visible (post complete)',
          () => findTaskButton(projectOpenNoneRes.data.id),
          { timeoutMs: 2000 }
        )
      } catch {
        // If list ordering/scroll differs (virtualized), scroll to the end and retry.
        contentScroller.scrollTop = contentScroller.scrollHeight
        await sleep(150)
        await waitFor('Project former open task visible (post complete)', () =>
          findTaskButton(projectOpenNoneRes.data.id)
        )
      }
      await waitFor('Project former open section task visible (post complete)', () =>
        findTaskButton(projectOpenSectionRes.data.id)
      )
      await waitFor('Project former open section task visible (post complete, second)', () =>
        findTaskButton(projectOpenSection2Res.data.id)
      )

      // Reopen via overflow menu (project status only; tasks remain done).
      const menuButton = await waitFor('Project overflow menu button', () =>
        findButtonByText(document, '...')
      )
      menuButton.click()

      const reopenButton = await waitFor('Project reopen button', () =>
        findButtonByText(document, 'Reopen')
      )
      reopenButton.click()

      await waitFor('Project checkbox unchecked + enabled after reopen', () => {
        const cb = document.querySelector<HTMLInputElement>('.page-header input[type="checkbox"]')
        return cb && !cb.checked && !cb.disabled ? cb : null
      })

      // Reopening changes the project status only; tasks should remain done.
      const openAfterReopen = await window.api.task.listProject(projectId)
      if (!openAfterReopen.ok) {
        throw new Error(
          `Project: listProject after reopen failed: ${openAfterReopen.error.code}: ${openAfterReopen.error.message}`
        )
      }
      if (openAfterReopen.data.length !== 0) {
        throw new Error('Project: reopening restored tasks unexpectedly')
      }

      // Completed toggle state is not persisted across navigation.
      window.location.hash = '/today'
      await waitFor('Today listbox (post project)', () =>
        document.querySelector<HTMLElement>('div.task-scroll[role="listbox"][aria-label="Tasks"]')
      )
      window.location.hash = `/projects/${projectId}`
      await waitFor('Project listbox (return)', () =>
        document.querySelector<HTMLElement>('div.task-scroll[role="listbox"][aria-label="Project tasks"]')
      )
      await waitFor('Project completed task remains collapsed after navigation', () =>
        findTaskButton(projectDoneRes.data.id) ? null : true
      )

      // Anytime/Someday bucket rules.
      const anytimeRes = await window.api.task.create({ title: `${token} Anytime A` })
      if (!anytimeRes.ok) {
        throw new Error(
          `task.create anytime failed: ${anytimeRes.error.code}: ${anytimeRes.error.message}`
        )
      }
      const anytimeId = anytimeRes.data.id

      window.location.hash = '/anytime'
      await waitFor('Anytime listbox', () =>
        document.querySelector<HTMLElement>('div.task-scroll[role="listbox"][aria-label="Tasks"]')
      )
      const anytimeButton = await waitFor('Anytime A row button', () => findTaskButton(anytimeId))
      const openedAnytime = await openEditorByDoubleClick({
        taskId: anytimeId,
        button: anytimeButton,
        label: 'Anytime A (dblclick)',
      })

      await setScheduleToSomeday(openedAnytime.paper, 'Anytime A')

      const anytimeDetailAfter = await window.api.task.getDetail(anytimeId)
      if (!anytimeDetailAfter.ok) {
        throw new Error(
          `task.getDetail anytime failed: ${anytimeDetailAfter.error.code}: ${anytimeDetailAfter.error.message}`
        )
      }
      if (!anytimeDetailAfter.data.task.is_someday) {
        throw new Error('Anytime A: expected is_someday=true after setting Someday')
      }
      if (anytimeDetailAfter.data.task.scheduled_at !== null) {
        throw new Error('Anytime A: expected scheduled_at=null after setting Someday')
      }

      const somedayListRes = await window.api.task.listSomeday()
      if (!somedayListRes.ok) {
        throw new Error(
          `task.listSomeday failed: ${somedayListRes.error.code}: ${somedayListRes.error.message}`
        )
      }
      if (!somedayListRes.data.some((t) => t.id === anytimeId)) {
        throw new Error('Someday list: missing task after setting Someday')
      }

      const anytimeListRes = await window.api.task.listAnytime()
      if (!anytimeListRes.ok) {
        throw new Error(
          `task.listAnytime failed: ${anytimeListRes.error.code}: ${anytimeListRes.error.message}`
        )
      }
      if (anytimeListRes.data.some((t) => t.id === anytimeId)) {
        throw new Error('Anytime list: Someday task should not appear')
      }

      // Drag-and-drop + keyboard reorder smoke tests.
      // TaskList views with DnD enabled: Inbox / Today / Anytime / Someday / Area

      // Inbox: drag reorder shows overlay and persists in DB ordering.
      window.location.hash = '/inbox'
      await waitFor('Inbox listbox (DnD)', () =>
        document.querySelector<HTMLElement>('div.task-scroll[role="listbox"][aria-label="Tasks"]')
      )
      const inboxHandleA = await waitFor('Inbox A drag handle', () => findDragHandle(inboxAId))
      const inboxRowB = await waitFor('Inbox B row (DnD target)', () =>
        document.querySelector<HTMLElement>(`.task-row[data-task-id="${inboxBId}"]`)
      )
      const inboxBRect = inboxRowB.getBoundingClientRect()
      await dragHandleToPoint({
        label: 'Inbox: drag reorder',
        handle: inboxHandleA,
        to: { x: inboxBRect.left + inboxBRect.width / 2, y: inboxBRect.top + inboxBRect.height / 2 },
      })
      await sleep(250)

      const inboxAfter = await window.api.task.listInbox()
      if (!inboxAfter.ok) {
        throw new Error(`Inbox: listInbox failed: ${inboxAfter.error.code}: ${inboxAfter.error.message}`)
      }
      const inboxFirstTwo = inboxAfter.data.slice(0, 2).map((t) => t.id)
      if (inboxFirstTwo[0] !== inboxBId || inboxFirstTwo[1] !== inboxAId) {
        throw new Error('Inbox: reorder did not persist (expected B then A at top)')
      }

      // Today: drag reorder + keyboard reorder chord.
      window.location.hash = '/today'
      await waitFor('Today listbox (DnD)', () =>
        document.querySelector<HTMLElement>('div.task-scroll[role="listbox"][aria-label="Tasks"]')
      )
      const todayHandleA = await waitFor('Today A drag handle', () => findDragHandle(todayAId))
      const todayRowB = await waitFor('Today B row (DnD target)', () =>
        document.querySelector<HTMLElement>(`.task-row[data-task-id="${todayBId}"]`)
      )
      const todayBRect = todayRowB.getBoundingClientRect()
      await dragHandleToPoint({
        label: 'Today: drag reorder',
        handle: todayHandleA,
        to: { x: todayBRect.left + todayBRect.width / 2, y: todayBRect.top + todayBRect.height / 2 },
      })
      await sleep(250)

      const todayAfter = await window.api.task.listToday(today)
      if (!todayAfter.ok) {
        throw new Error(`Today: listToday failed: ${todayAfter.error.code}: ${todayAfter.error.message}`)
      }
      const todayFirstTwo = todayAfter.data.slice(0, 2).map((t) => t.id)
      if (todayFirstTwo[0] !== todayBId || todayFirstTwo[1] !== todayAId) {
        throw new Error('Today: reorder did not persist (expected B then A)')
      }

      // Keyboard reorder: move selected task up by one.
      const todayAButtonAfter = await waitFor('Today A row button (post DnD)', () => findTaskButton(todayAId))
      todayAButtonAfter.click()
      await waitFor('Today A selected (for keyboard reorder)', () =>
        getSelectedTaskId() === todayAId ? true : null
      )
      await waitFor('Today A still selected (before keyboard reorder)', () =>
        getSelectedTaskId() === todayAId ? true : null
      )

      // Dispatch from the focused row button so the event bubbles to the listbox handler.
      dispatchKey(todayAButtonAfter, 'ArrowUp', { metaKey: true, ctrlKey: true, shiftKey: true })

      let todayKeyOk = false
      let todayKeyObserved: { ids: string[]; ranks: Array<number | null | undefined> } | null = null
      for (let i = 0; i < 30; i++) {
        const res = await window.api.task.listToday(today)
        if (!res.ok) {
          throw new Error(`Today: listToday after key failed: ${res.error.code}: ${res.error.message}`)
        }
        const firstTwo = res.data.slice(0, 2).map((t) => t.id)
        todayKeyObserved = { ids: firstTwo, ranks: res.data.slice(0, 2).map((t) => t.rank) }
        if (firstTwo[0] === todayAId && firstTwo[1] === todayBId) {
          todayKeyOk = true
          break
        }
        await sleep(100)
      }
      if (!todayKeyOk) {
        throw new Error(
          `Today: keyboard reorder did not persist (expected A then B), observed=${JSON.stringify(todayKeyObserved)}`
        )
      }

      // Anytime: drag reorder.
      window.location.hash = '/anytime'
      await waitFor('Anytime listbox (DnD)', () =>
        document.querySelector<HTMLElement>('div.task-scroll[role="listbox"][aria-label="Tasks"]')
      )
      const anytimeHandleA = await waitFor('Anytime DnD A drag handle', () => findDragHandle(anytimeDndAId))
      const anytimeRowB = await waitFor('Anytime DnD B row (DnD target)', () =>
        document.querySelector<HTMLElement>(`.task-row[data-task-id="${anytimeDndBId}"]`)
      )
      const anytimeBRect = anytimeRowB.getBoundingClientRect()
      await dragHandleToPoint({
        label: 'Anytime: drag reorder',
        handle: anytimeHandleA,
        to: { x: anytimeBRect.left + anytimeBRect.width / 2, y: anytimeBRect.top + anytimeBRect.height / 2 },
      })
      await sleep(250)

      const anytimeAfter = await window.api.task.listAnytime()
      if (!anytimeAfter.ok) {
        throw new Error(`Anytime: listAnytime failed: ${anytimeAfter.error.code}: ${anytimeAfter.error.message}`)
      }
      const anytimeFirstTwo = anytimeAfter.data.slice(0, 2).map((t) => t.id)
      if (anytimeFirstTwo[0] !== anytimeDndBId || anytimeFirstTwo[1] !== anytimeDndAId) {
        throw new Error('Anytime: reorder did not persist (expected DnD B then DnD A)')
      }

      // Someday: drag reorder.
      window.location.hash = '/someday'
      await waitFor('Someday listbox (DnD)', () =>
        document.querySelector<HTMLElement>('div.task-scroll[role="listbox"][aria-label="Tasks"]')
      )
      const somedayHandleA = await waitFor('Someday DnD A drag handle', () => findDragHandle(somedayDndAId))
      const somedayRowB = await waitFor('Someday DnD B row (DnD target)', () =>
        document.querySelector<HTMLElement>(`.task-row[data-task-id="${somedayDndBId}"]`)
      )
      const somedayBRect = somedayRowB.getBoundingClientRect()
      await dragHandleToPoint({
        label: 'Someday: drag reorder',
        handle: somedayHandleA,
        to: { x: somedayBRect.left + somedayBRect.width / 2, y: somedayBRect.top + somedayBRect.height / 2 },
      })
      await sleep(250)

      const somedayAfter = await window.api.task.listSomeday()
      if (!somedayAfter.ok) {
        throw new Error(`Someday: listSomeday failed: ${somedayAfter.error.code}: ${somedayAfter.error.message}`)
      }
      const somedayFirstTwo = somedayAfter.data.slice(0, 2).map((t) => t.id)
      if (somedayFirstTwo[0] !== somedayDndBId || somedayFirstTwo[1] !== somedayDndAId) {
        throw new Error('Someday: reorder did not persist (expected DnD B then DnD A)')
      }

      // Area: drag reorder.
      window.location.hash = `/areas/${areaId}`
      await waitFor('Area listbox (DnD)', () =>
        document.querySelector<HTMLElement>('div.task-scroll[role="listbox"][aria-label="Tasks"]')
      )
      const areaHandleA = await waitFor('Area task A drag handle', () => findDragHandle(areaTaskAId))
      const areaRowB = await waitFor('Area task B row (DnD target)', () =>
        document.querySelector<HTMLElement>(`.task-row[data-task-id="${areaTaskBId}"]`)
      )
      const areaBRect = areaRowB.getBoundingClientRect()
      await dragHandleToPoint({
        label: 'Area: drag reorder',
        handle: areaHandleA,
        to: { x: areaBRect.left + areaBRect.width / 2, y: areaBRect.top + areaBRect.height / 2 },
      })
      await sleep(250)

      const areaAfter = await window.api.task.listArea(areaId)
      if (!areaAfter.ok) {
        throw new Error(`Area: listArea failed: ${areaAfter.error.code}: ${areaAfter.error.message}`)
      }
      const areaFirstTwo = areaAfter.data.slice(0, 2).map((t) => t.id)
      if (areaFirstTwo[0] !== areaTaskBId || areaFirstTwo[1] !== areaTaskAId) {
        throw new Error('Area: reorder did not persist (expected Task B then Task A)')
      }

      // Views where manual ordering is NOT supported: Logbook / Search.
      window.location.hash = '/logbook'
      await waitFor('Logbook title', () => {
        const h = document.querySelector<HTMLElement>('h1.page-title')
        return h && (h.textContent ?? '').trim() === 'Logbook' ? true : null
      })
      const logbookListbox = await waitFor('Logbook listbox', () =>
        document.querySelector<HTMLElement>('div.task-scroll[role="listbox"][aria-label="Tasks"]')
      )
      if (logbookListbox.querySelector('.task-title-button.is-dnd-activator')) {
        throw new Error('Logbook: drag-and-drop activator should not be present')
      }

      window.location.hash = '/search'
      await waitFor('Search title', () => {
        const h = document.querySelector<HTMLElement>('h1.page-title')
        return h && (h.textContent ?? '').trim() === 'Search' ? true : null
      })
      const searchListbox = await waitFor('Search listbox', () =>
        document.querySelector<HTMLElement>('div[role="listbox"][aria-label="Search results"]')
      )
      if (
        searchListbox.querySelector('.task-title-button.is-dnd-activator') ||
        document.querySelector('.task-title-button.is-dnd-activator')
      ) {
        throw new Error('Search: drag-and-drop activator should not be present')
      }
    } finally {
      ;(window as unknown as { confirm: (message?: string) => boolean }).confirm = prevConfirm
    }
  } catch (e) {
    failures.push(e instanceof Error ? e.message : String(e))
  } finally {
    ;(window as unknown as { __milestoForceTaskUpdateError?: boolean }).__milestoForceTaskUpdateError =
      prevForceError
    ;(window as unknown as { __milestoTaskUpdateDelayMs?: number }).__milestoTaskUpdateDelayMs = prevDelay
  }

  return { ok: failures.length === 0, failures }
}

export function registerSelfTest() {
  ;(window as unknown as { __milestoRunSelfTest?: () => Promise<SelfTestResult> }).__milestoRunSelfTest =
    runSelfTest
}
