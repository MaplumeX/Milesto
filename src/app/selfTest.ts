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

function findSearchResultButtons(token: string): HTMLButtonElement[] {
  const all = Array.from(
    document.querySelectorAll<HTMLButtonElement>('.task-title-button[data-task-id]')
  )

  return all.filter((b) => (b.textContent ?? '').includes(token))
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

    // Create two tasks so we can test Arrow navigation + open semantics.
    const aRes = await window.api.task.create({ title: `${token} A`, base_list: 'inbox' })
    const bRes = await window.api.task.create({ title: `${token} B`, base_list: 'inbox' })
    if (!aRes.ok) throw new Error(`task.create A failed: ${aRes.error.code}: ${aRes.error.message}`)
    if (!bRes.ok) throw new Error(`task.create B failed: ${bRes.error.code}: ${bRes.error.message}`)

    // Navigate to search and query our token.
    window.location.hash = '/search'
    const searchInput = await waitFor(
      'search input',
      () => document.querySelector<HTMLInputElement>('input[placeholder="Search title + notes…"]')
    )

    setNativeInputValue(searchInput, token)

    const listbox = await waitFor(
      'search results listbox',
      () => document.querySelector<HTMLElement>('div[role="listbox"][aria-label="Search results"]')
    )

    const buttons = await waitFor('search results', () => {
      const found = findSearchResultButtons(token)
      return found.length >= 2 ? found : null
    })

    const first = buttons[0]!
    const second = buttons[1]!

    // 9.2 Mouse flow: single-click selects, double-click opens, scrim click does not close.
    first.click()
    await waitFor('first row selected', () => {
      const row = first.closest('.task-row')
      return row && row.classList.contains('is-selected') ? row : null
    })

    dispatchDblClick(first)

    await waitFor('overlay mount', () => document.querySelector<HTMLElement>('.overlay-paper-overlay'))
    const titleInput = await waitFor(
      'title input',
      () => document.querySelector<HTMLInputElement>('#task-title')
    )
    await waitFor('title focused', () => (document.activeElement === titleInput ? titleInput : null))

    const scrim = await waitFor(
      'overlay scrim',
      () => document.querySelector<HTMLElement>('.overlay-paper-scrim')
    )
    scrim.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))

    // Should remain open.
    if (!document.querySelector('.overlay-paper-overlay')) {
      throw new Error('Overlay closed unexpectedly after scrim click.')
    }

    dispatchKey(titleInput, 'Escape')
    await waitFor('overlay close', () => (!document.querySelector('.overlay-paper-overlay') ? document.body : null))
    await waitFor('focus restored to row', () => (document.activeElement === first ? first : null))

    // 9.1 Keyboard flow: Arrow selects, Return opens, Esc closes and restores focus.
    listbox.focus()
    dispatchKey(listbox, 'ArrowDown')
    await waitFor('second row selected', () => {
      const row = second.closest('.task-row')
      return row && row.classList.contains('is-selected') ? row : null
    })

    dispatchKey(listbox, 'Enter')
    await waitFor('overlay mount (keyboard open)', () => document.querySelector<HTMLElement>('.overlay-paper-overlay'))
    const titleInput2 = await waitFor(
      'title input (keyboard open)',
      () => document.querySelector<HTMLInputElement>('#task-title')
    )
    await waitFor('title focused (keyboard open)', () => (document.activeElement === titleInput2 ? titleInput2 : null))

    // 9.3 Save robustness: enforce slow save, type while in-flight, flush with Cmd/Ctrl+Return.
    ;(window as unknown as { __milestoTaskUpdateDelayMs?: number }).__milestoTaskUpdateDelayMs = 800
    const finalTitle = `${token} B FINAL ${Date.now()}`

    setNativeInputValue(titleInput2, `${token} B 1`)
    await sleep(520) // allow debounce (450ms) to kick off first save
    setNativeInputValue(titleInput2, finalTitle)

    dispatchKey(titleInput2, 'Enter', { metaKey: true })
    await waitFor('overlay close (Cmd+Return)', () => (!document.querySelector('.overlay-paper-overlay') ? document.body : null))

    const selectedTaskId = second.getAttribute('data-task-id')
    if (!selectedTaskId) throw new Error('Missing data-task-id on selected result button.')
    const detailRes = await window.api.task.getDetail(selectedTaskId)
    if (!detailRes.ok) throw new Error(`task.getDetail failed: ${detailRes.error.code}: ${detailRes.error.message}`)
    if (detailRes.data.task.title !== finalTitle) {
      throw new Error(`Saved title mismatch: expected "${finalTitle}" got "${detailRes.data.task.title}"`)
    }

    // Simulated save failure preserves draft and blocks close.
    listbox.focus()
    dispatchKey(listbox, 'ArrowUp')
    await waitFor('first row re-selected', () => {
      const row = first.closest('.task-row')
      return row && row.classList.contains('is-selected') ? row : null
    })

    dispatchKey(listbox, 'Enter')
    await waitFor('overlay mount (failure test)', () => document.querySelector<HTMLElement>('.overlay-paper-overlay'))
    const titleInput3 = await waitFor(
      'title input (failure test)',
      () => document.querySelector<HTMLInputElement>('#task-title')
    )
    await waitFor('title focused (failure test)', () => (document.activeElement === titleInput3 ? titleInput3 : null))

    ;(window as unknown as { __milestoForceTaskUpdateError?: boolean }).__milestoForceTaskUpdateError = true
    setNativeInputValue(titleInput3, `${token} A FAIL ${Date.now()}`)
    await sleep(520)

    dispatchKey(titleInput3, 'Escape')
    // Should remain open due to failed flush.
    await sleep(200)
    if (!document.querySelector('.overlay-paper-overlay')) {
      throw new Error('Overlay closed even though save is failing (flush should block close).')
    }

    ;(window as unknown as { __milestoForceTaskUpdateError?: boolean }).__milestoForceTaskUpdateError = false
    const retryButton = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.overlay-paper-header .button')
    ).find((b) => (b.textContent ?? '').trim() === 'Retry')
    if (!retryButton) {
      throw new Error('Retry button not found after forced save error.')
    }
    retryButton.click()

    // Wait for success then close.
    await sleep(300)
    dispatchKey(titleInput3, 'Escape')
    await waitFor('overlay close (after retry)', () => (!document.querySelector('.overlay-paper-overlay') ? document.body : null))
  } catch (e) {
    failures.push(e instanceof Error ? e.message : String(e))
  } finally {
    ;(window as unknown as { __milestoForceTaskUpdateError?: boolean }).__milestoForceTaskUpdateError = prevForceError
    ;(window as unknown as { __milestoTaskUpdateDelayMs?: number }).__milestoTaskUpdateDelayMs = prevDelay
  }

  return { ok: failures.length === 0, failures }
}

export function registerSelfTest() {
  ;(window as unknown as { __milestoRunSelfTest?: () => Promise<SelfTestResult> }).__milestoRunSelfTest =
    runSelfTest
}
