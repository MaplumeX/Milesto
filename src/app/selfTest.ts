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

function getInlinePaper(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.task-inline-paper')
}

function assertNoOverlap(listbox: HTMLElement, label: string) {
  const list = listbox.querySelector<HTMLElement>('ul.task-list')
  if (!list) throw new Error(`Missing ul.task-list (${label})`)

  const boxRect = listbox.getBoundingClientRect()
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

function assertEditorInView(listbox: HTMLElement, paper: HTMLElement, label: string) {
  let el = paper
  if (!el.isConnected) {
    const current = getInlinePaper()
    if (current) el = current
  }
  const boxRect = listbox.getBoundingClientRect()
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
  if (!findButtonByText(bar, 'Schedule')) throw new Error(`${label}: missing Schedule button`)
  if (!findButtonByText(bar, 'Tags')) throw new Error(`${label}: missing Tags button`)
  if (!findButtonByText(bar, 'Due')) throw new Error(`${label}: missing Due button`)

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

    const today = formatLocalDate(new Date())
    const tomorrow = formatLocalDate(addDays(new Date(), 1))

    // Seed tasks for Inbox/Today/Upcoming flows.
    const inboxARes = await window.api.task.create({ title: `${token} Inbox A`, base_list: 'inbox' })
    const inboxBRes = await window.api.task.create({ title: `${token} Inbox B`, base_list: 'inbox' })
    if (!inboxARes.ok) throw new Error(`task.create inboxA failed: ${inboxARes.error.code}: ${inboxARes.error.message}`)
    if (!inboxBRes.ok) throw new Error(`task.create inboxB failed: ${inboxBRes.error.code}: ${inboxBRes.error.message}`)

    // Add enough Inbox tasks to exercise scrolling + virtualization stability.
    for (let i = 0; i < 28; i++) {
      const res = await window.api.task.create({ title: `${token} Inbox filler ${i}`, base_list: 'inbox' })
      if (!res.ok) {
        throw new Error(`task.create inbox filler ${i} failed: ${res.error.code}: ${res.error.message}`)
      }
    }

    const todayARes = await window.api.task.create({
      title: `${token} Today A`,
      base_list: 'anytime',
      scheduled_at: today,
    })
    const todayBRes = await window.api.task.create({
      title: `${token} Today B`,
      base_list: 'anytime',
      scheduled_at: today,
    })
    if (!todayARes.ok) throw new Error(`task.create todayA failed: ${todayARes.error.code}: ${todayARes.error.message}`)
    if (!todayBRes.ok) throw new Error(`task.create todayB failed: ${todayBRes.error.code}: ${todayBRes.error.message}`)

    const upcomingARes = await window.api.task.create({
      title: `${token} Upcoming A`,
      base_list: 'anytime',
      scheduled_at: tomorrow,
    })
    const upcomingBRes = await window.api.task.create({
      title: `${token} Upcoming B`,
      base_list: 'anytime',
      scheduled_at: tomorrow,
    })
    if (!upcomingARes.ok) throw new Error(`task.create upcomingA failed: ${upcomingARes.error.code}: ${upcomingARes.error.message}`)
    if (!upcomingBRes.ok) throw new Error(`task.create upcomingB failed: ${upcomingBRes.error.code}: ${upcomingBRes.error.message}`)

    const inboxAId = inboxARes.data.id
    const inboxBId = inboxBRes.data.id
    const todayAId = todayARes.data.id
    const todayBId = todayBRes.data.id
    const upcomingAId = upcomingARes.data.id
    const upcomingBId = upcomingBRes.data.id

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
    const scrollBeforeNotes = inboxListbox.scrollTop
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
    if (Math.abs(inboxListbox.scrollTop - scrollBeforeNotes) > 320) {
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

    inboxListboxNow.scrollTop = Math.floor(inboxListboxNow.scrollHeight / 2)
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

    const beforeScroll = inboxListboxNow.scrollTop
    const openedMid = await openEditorByDoubleClick({
      taskId: midTaskId,
      button: midButton,
      label: 'Inbox mid (dblclick)',
    })
    setNativeInputValue(openedMid.notesInput, `scroll test\n${'x'.repeat(200)}\n${'y'.repeat(200)}\nend`)
    await sleep(700)
    assertNoOverlap(inboxListboxNow, 'Inbox mid: after notes growth')
    assertEditorInView(inboxListboxNow, openedMid.paper, 'Inbox mid')
    const midDelta = Math.abs(inboxListboxNow.scrollTop - beforeScroll)
    if (midDelta > 360) {
      throw new Error(`Inbox mid: scroll jumped too much while editing notes (delta=${midDelta})`)
    }
    await closeEditorWithEscape(midTaskId, 'Inbox mid')

    // Scroll back to the top so Inbox A is rendered again (virtualization).
    inboxListboxNow.scrollTop = 0
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

    // Upcoming (virtualized UpcomingGroupedList with headers)
    window.location.hash = '/upcoming'
    const upcomingListbox = await waitFor('Upcoming listbox', () =>
      document.querySelector<HTMLElement>('div.task-scroll[role="listbox"][aria-label="Upcoming tasks"]')
    )
    const upcomingAButton = await waitFor('Upcoming A row button', () => findTaskButton(upcomingAId))
    await waitFor('Upcoming B row button', () => findTaskButton(upcomingBId))

    // Arrow navigation should skip non-task rows.
    upcomingAButton.click()
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
