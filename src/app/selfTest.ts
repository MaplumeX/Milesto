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
    const projectListbox = await waitFor('Project listbox', () =>
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
