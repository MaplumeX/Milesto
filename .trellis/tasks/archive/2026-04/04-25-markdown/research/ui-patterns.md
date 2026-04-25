# Research: UI Patterns for Real-Time Markdown Rendering in Task/Note Apps

- **Query**: Evaluate UI patterns for real-time Markdown rendering in Milesto's notes feature. User selected "实时渲染" (real-time rendering).
- **Scope**: Mixed (internal codebase analysis + external pattern research)
- **Date**: 2026-04-25

## Findings

### Current Codebase Context

#### Notes Editing Locations

| File Path | Description | Current UI |
|---|---|---|
| `src/features/tasks/TaskEditorPaper.tsx:1343-1355` | Task inline editor notes textarea | `<textarea className="task-inline-notes">`, auto-resizing, borderless, placeholder `task.notesPlaceholder` |
| `src/features/tasks/TaskEditorPaper.tsx:1564-1575` | Task detail/overlay notes textarea | `<textarea className="input" rows={8}>`, placeholder `taskEditor.markdownPlaceholder` (already says "Markdown supported") |
| `src/pages/ProjectPage.tsx:585-625` | Project notes textarea via `ProjectNotes` component | `<textarea className="task-inline-notes project-notes-textarea">`, auto-resizing, placeholder `projectPage.notesPlaceholder` |

#### Key UI Characteristics

- **Inline task editor**: Borderless textarea inside `task-inline-paper` card, auto-resizes height based on `scrollHeight` (`index.css:1950-1971`). Content aligned with checkbox column via `padding-left: var(--task-inline-indent)`.
- **Detail/overlay editor**: Standard bordered `input` class textarea with 8 rows, inside modal-like `overlay-paper`.
- **Project notes**: Borderless textarea on project page, auto-resizing via `useLayoutEffect` (`ProjectPage.tsx:948-954`).
- **All notes**: Stored as plain text strings in DB, edited via controlled `<textarea>` with `onChange` debounce (Task: 450ms, Project: 500ms).
- **No markdown library currently installed** in `package.json` dependencies. However, `@milkdown/core@7.20.0` and `@milkdown/preset-commonmark@7.20.0` exist as **extraneous** packages in `node_modules` (not in package.json).

#### Styling System

- Global CSS in `src/index.css` with semantic class names (not utility-first).
- CSS custom properties for theming: `--text`, `--muted`, `--border`, `--bg`, `--panel`, etc.
- Dark mode via `prefers-color-scheme: dark` media query.
- Font stack: `ui-sans-serif, system-ui, -apple-system, ...`

---

### Pattern Evaluation

#### Pattern 1: Split-Pane Preview (Editor + Live Preview Side by Side)

**Description**: Textarea on the left, rendered HTML preview on the right. Both visible simultaneously.

**Examples**: GitHub issue editor (write/preview tabs), VS Code Markdown preview, Obsidian (optional side pane).

| Aspect | Assessment |
|---|---|
| **Complexity** | Medium. Requires a markdown parser library + a preview pane component. Need to sync scroll positions for good UX. |
| **UX for Short Notes** | Poor. Split-pane consumes significant horizontal space. For 1-2 line notes, the preview pane is mostly empty and wasteful. Milesto notes are typically short task/project descriptions. |
| **Fit with Existing UI** | Poor. The inline editor (`task-inline-paper`) is already narrow and constrained. The detail panel (`detail` class) is 420px wide - splitting this leaves ~200px per pane, which is cramped. |
| **Implementation Effort** | Medium: new dependency, new component, layout changes, scroll sync. |

**Verdict**: Not recommended for Milesto. Notes are short; horizontal space is constrained.

---

#### Pattern 2: Inline Preview (Preview Below Editor)

**Description**: Editor textarea at top, rendered preview stacked below it in the same flow.

**Examples**: Some forum post editors, early GitHub comment UI.

| Aspect | Assessment |
|---|---|
| **Complexity** | Low-Medium. Just render parsed markdown below the textarea. No scroll sync needed. |
| **UX for Short Notes** | Poor. Doubles vertical space. For short notes, user sees their text twice. Creates visual noise. |
| **Fit with Existing UI** | Poor. The inline editor already auto-resizes and sits within virtualized task lists. Adding a preview below would push metadata chips and checklist further down, breaking the compact inline layout. |
| **Implementation Effort** | Low: render `<div dangerouslySetInnerHTML>` below textarea. |

**Verdict**: Not recommended. Redundant for short content; breaks compact inline layout.

---

#### Pattern 3: Render-on-Blur (Textarea When Editing, Rendered When Not Focused)

**Description**: Show a `<textarea>` when focused for editing. When blurred, swap to a rendered HTML view. Click the rendered view to re-enter edit mode.

**Examples**: Things 3 notes field, Apple Notes (simplified), many CRM note fields, GitHub issue title/description (indirectly - you see rendered until you click edit).

| Aspect | Assessment |
|---|---|
| **Complexity** | Low. Toggle between `<textarea>` and `<div>` based on `focus`/`blur` state. No heavy editor library needed - just a markdown-to-HTML parser. |
| **UX for Short Notes** | Excellent. When not editing, notes look clean and formatted. No wasted space. When editing, familiar textarea experience. |
| **Fit with Existing UI** | Excellent. Matches the existing "borderless textarea" aesthetic perfectly. The inline editor already has `onBlur` behavior that flushes changes. The project notes already have `onBlur` save logic. Swapping to rendered view on blur is a natural extension. |
| **Implementation Effort** | Low: wrap existing textarea in a conditional, add a markdown parser dependency, render `dangerouslySetInnerHTML` with sanitized output. |

**Key Implementation Considerations**:
- Need to handle the "click to edit" transition smoothly. The rendered `<div>` should look like the textarea (same font, padding, width) so the swap is not jarring.
- For the **inline task editor**, the notes are inside a form-like context where the user may tab through fields. Render-on-blur means when they tab out of notes, they see formatted text.
- For the **detail overlay**, this is even more natural - the user is in a "view" mode until they click into a field.
- For **project notes**, same pattern applies - click to edit, blur to view.

**Verdict**: **Strongly recommended** for Milesto. Minimal complexity, excellent fit with existing patterns, great UX for short notes.

---

#### Pattern 4: True WYSIWYG (Notion-Style Block Editor)

**Description**: ContentEditable-based editor where typing `**bold**` immediately renders as **bold** inline. No separate edit/preview modes.

**Examples**: Notion, Outline, Milkdown, TipTap, Slate, Lexical.

| Aspect | Assessment |
|---|---|
| **Complexity** | Very High. Requires a full contentEditable framework (ProseMirror, Slate, Lexical). Complex cursor/selection management. IME composition handling. Undo/redo integration. Custom schema for markdown serialization. Bundle size impact (~100-500KB+). |
| **UX for Short Notes** | Good when it works, but overkill. The "magic" of instant formatting is nice, but for short notes the cognitive overhead of learning a block editor is not worth it. |
| **Fit with Existing UI** | Poor. Milesto uses simple `<textarea>` and `<input>` elements everywhere. Introducing a contentEditable island breaks the consistent form-like interaction model. The PRD explicitly says WYSIWYG is out of scope. |
| **Implementation Effort** | Very High: heavy dependency, custom schema, serialization/deserialization, extensive testing, potential IME bugs, focus management rewrite. |

**Verdict**: Not recommended. Explicitly out of scope per PRD. Massive complexity for marginal gain on short notes.

---

### Markdown Parser Library Options

Since the chosen pattern (render-on-blur) only needs a **parser** (not an editor), here are suitable lightweight options:

| Library | Size (gzipped) | Pros | Cons | Fit for Milesto |
|---|---|---|---|---|
| **marked** | ~15KB | Fast, widely used, CommonMark + GFM, no React dependency | Requires DOMPurify for XSS safety | Excellent - simple, fast, minimal |
| **react-markdown** | ~25KB + deps | React-native, pluggable, safe by default (no `dangerouslySetInnerHTML`) | Larger bundle, more complex API | Good if wanting React-first approach |
| **micromark** | ~10KB | Unified ecosystem, streaming, spec-compliant | Lower-level API, needs composition | Overkill for simple rendering |
| **@milkdown/core** | ~100KB+ | Already in node_modules (extraneous) | Full WYSIWYG editor, not just parser | Wrong tool for the job |

**Recommendation**: `marked` + `DOMPurify` is the simplest, smallest, and most straightforward for render-on-blur. If the team prefers a React-native solution without `dangerouslySetInnerHTML`, `react-markdown` is a good alternative at a slightly larger bundle cost.

---

### Implementation Sketch for Render-on-Blur

```tsx
// Conceptual component for notes field
function MarkdownNotesField({ value, onChange, placeholder, className }) {
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing) textareaRef.current?.focus();
  }, [isEditing]);

  if (isEditing) {
    return (
      <textarea
        ref={textareaRef}
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setIsEditing(false)}
        placeholder={placeholder}
      />
    );
  }

  // Rendered view
  if (!value?.trim()) {
    return (
      <div className={className} onClick={() => setIsEditing(true)} style={{ color: 'var(--muted)' }}>
        {placeholder}
      </div>
    );
  }

  const html = marked.parse(value, { gfm: true, breaks: true });
  const sanitized = DOMPurify.sanitize(html);

  return (
    <div
      className={`${className} markdown-body`}
      onClick={() => setIsEditing(true)}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
```

**CSS considerations**:
- Add `.markdown-body` styles to `src/index.css` with rules for `h1-h6`, `p`, `ul/ol`, `code`, `pre`, `a`, `strong`, `em`, `blockquote`, `hr`.
- Match existing design tokens: use `var(--text)` for body, `var(--muted)` for secondary, `var(--border)` for code block borders, `var(--wash)` for code block backgrounds.
- Keep font size consistent with textarea (12px inherited from `:root`).

---

### Files to Modify

| File | Change |
|---|---|
| `package.json` | Add `marked` and `@types/marked` (or `react-markdown`), add `dompurify` and `@types/dompurify` |
| `src/index.css` | Add `.markdown-body` styles for rendered markdown |
| `src/features/tasks/TaskEditorPaper.tsx` | Replace inline notes `<textarea>` with render-on-blur component (inline variant) |
| `src/features/tasks/TaskEditorPaper.tsx` | Replace detail notes `<textarea>` with render-on-blur component (overlay variant) |
| `src/pages/ProjectPage.tsx` | Replace `ProjectNotes` textarea with render-on-blur component |
| `src/components/MarkdownNotes.tsx` (new) | Shared render-on-blur markdown notes component |
| `tests/renderer/MarkdownNotes.test.tsx` (new) | Tests for edit/render toggle, parser integration |

---

## External References

- [Marked.js Documentation](https://marked.js.org/) - Fast markdown parser
- [DOMPurify GitHub](https://github.com/cure53/DOMPurify) - XSS sanitizer for rendered HTML
- [React-Markdown Documentation](https://github.com/remarkjs/react-markdown) - React-native markdown renderer
- [Things 3 UI Patterns](https://culturedcode.com/things/) - Reference app with similar inline note editing (borderless, render-on-blur-like behavior)

---

## Related Specs

- `.trellis/spec/frontend/component-guidelines.md` - Component structure and styling patterns
- `.trellis/spec/frontend/state-management.md` - Local state ownership for form drafts
- `.trellis/spec/frontend/directory-structure.md` - Where to place new shared components
- `.trellis/spec/frontend/quality-guidelines.md` - Testing and accessibility requirements
- `.trellis/tasks/04-25-markdown/prd.md` - Product requirements (WYSIWYG explicitly out of scope)

---

## Caveats / Not Found

- **Milkdown is extraneous**: `@milkdown/core` and related packages exist in `node_modules` but are NOT in `package.json`. They were likely installed transiently or removed. Do NOT rely on them - they are not part of the build.
- **No existing markdown tests**: No test coverage exists for markdown rendering. New tests needed.
- **Area notes UI missing**: `AreaPage.tsx` has no notes editing UI per PRD, so Area notes are out of scope.
- **Inline vs overlay variants**: The `TaskEditorPaper` has two distinct visual variants (`inline` and `overlay`). The render-on-blur component must work in both contexts (borderless inline vs bordered overlay).
- **Auto-resize behavior**: Both inline notes (`index.css:1950-1971`) and project notes (`ProjectPage.tsx:948-954`) auto-resize. The rendered view must also adapt its height naturally (block elements flow, so this is automatic).
- **Focus management**: The existing inline editor has complex focus handling (Escape to close, Cmd+Enter to close, pointerdown outside to close). The render-on-blur component must not interfere with these behaviors.
