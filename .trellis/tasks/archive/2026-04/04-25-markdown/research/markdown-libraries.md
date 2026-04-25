# Research: Markdown Rendering Libraries

- **Query**: Compare react-markdown, marked+DOMPurify, and micromark for rendering notes fields in an Electron + React 18 + Vite desktop app.
- **Scope**: External
- **Date**: 2026-04-25

## Findings

### Current State of Notes in Milesto

Notes are stored as plain `z.string()` in SQLite and edited via `<textarea>` elements. There is currently no Markdown rendering; notes are displayed as raw text.

| File Path | Notes Usage |
|---|---|
| `src/features/tasks/TaskEditorPaper.tsx:1343-1355` | Task notes textarea (inline variant) |
| `src/features/tasks/TaskEditorPaper.tsx:1564-1575` | Task notes textarea (overlay variant) |
| `src/pages/ProjectPage.tsx:585-625` | Project notes textarea |
| `shared/schemas/task.ts` | `notes: z.string()` |
| `shared/schemas/project.ts` | `notes: z.string()` |
| `shared/schemas/area.ts` | `notes: z.string()` |
| `shared/i18n/messages.ts` | Placeholder text: "Markdown supported (stored as plain text in v0.1)." |

### Library Comparison

#### 1. react-markdown (v10.1.0)

| Attribute | Detail |
|---|---|
| **Approach** | React component that parses Markdown into a virtual DOM (mdast -> hast -> JSX) via the `unified` ecosystem. |
| **Bundle size** | ~52.6 kB unpacked (package itself). With transitive deps (`unified`, `remark-parse`, `remark-rehype`, `hast-util-to-jsx-runtime`, etc.) the total installed footprint is roughly **200-300 kB**. |
| **Peer deps** | `react >=18`, `@types/react >=18` |
| **TypeScript** | Excellent. Ships with `index.d.ts`. |
| **XSS safety** | Safe by default. Does not use `dangerouslySetInnerHTML`; renders to React elements. |
| **Vite compat** | ESM-first (`"exports": "./index.js"`). Works out of the box with Vite. |
| **Electron compat** | Runs entirely in the renderer process. No native modules. |
| **Extensibility** | Rich plugin ecosystem (`remark-gfm` for tables, `rehype-highlight` for syntax highlighting, custom components via `components` prop). |
| **Basic syntax** | Bold, italic, lists, links, code blocks all supported natively. |

**Pros:**
- Native React integration; no `dangerouslySetInnerHTML`.
- XSS-safe by architecture.
- Easy to customize rendering per element type (e.g., style links differently).

**Cons:**
- Largest bundle footprint of the three options.
- Slightly more CPU overhead due to AST pipeline.
- Brings in many small `unified` ecosystem packages.

---

#### 2. marked + DOMPurify (marked v18.0.2, DOMPurify v3.2.5)

| Attribute | Detail |
|---|---|
| **Approach** | `marked` parses Markdown to HTML string; `DOMPurify` sanitizes the HTML string before injecting into DOM. |
| **Bundle size** | `marked` ~448.8 kB unpacked (but tree-shakes well; the ESM build is much smaller at runtime). `DOMPurify` ~806.3 kB unpacked (includes dist files; the minified `purify.es.mjs` is ~50-60 kB). Combined runtime footprint is roughly **60-100 kB** gzipped. |
| **Dependencies** | `marked`: zero runtime deps. `DOMPurify`: zero runtime deps (optional `@types/trusted-types` for TS). |
| **TypeScript** | `marked`: ships with `lib/marked.d.ts`. `DOMPurify`: requires `@types/dompurify` (v3.2.0 available). |
| **XSS safety** | Safe **only if** DOMPurify is applied. `marked` alone is NOT safe (it outputs raw HTML). |
| **Vite compat** | Both are ESM/CJS dual packages. `marked` exposes `lib/marked.esm.js`. `DOMPurify` exposes `dist/purify.es.mjs`. |
| **Electron compat** | Both run in renderer. DOMPurify uses the DOM API (available in Electron renderer). |
| **Extensibility** | `marked` has lexer/renderer hooks. DOMPurify has config hooks for allowed tags/attributes. |
| **Basic syntax** | Full CommonMark + GFM support in `marked`. |

**Pros:**
- Smaller effective runtime size than react-markdown.
- Fast string-to-string conversion.
- `marked` is mature and widely used.

**Cons:**
- Requires two separate libraries and correct integration order (parse -> sanitize -> inject).
- Uses `dangerouslySetInnerHTML` (even when sanitized, this is a code-smell risk).
- Must ensure DOMPurify is always called; forgetting it is a security hole.

---

#### 3. micromark (v4.0.2)

| Attribute | Detail |
|---|---|
| **Approach** | Low-level streaming Markdown parser. Emits HTML tokens/events. It is the engine that powers `remark-parse` (and therefore `react-markdown`). |
| **Bundle size** | ~209.6 kB unpacked. Many sub-packages (`micromark-core-commonmark`, etc.). |
| **Dependencies** | ~15 internal micromark utility packages + `debug`. |
| **TypeScript** | Ships with `index.d.ts`. |
| **XSS safety** | NOT safe by default. It is a parser, not a sanitizer. You would still need DOMPurify or a custom HTML builder. |
| **Vite compat** | ESM-first. Works with Vite. |
| **Electron compat** | Renderer-safe. |
| **Extensibility** | Extremely granular; you can write custom extensions. |
| **Basic syntax** | Supports full CommonMark. |

**Pros:**
- Fast, streaming parser.
- If you need a custom Markdown dialect or highly controlled output, this is the right level.

**Cons:**
- Not a turnkey solution for "render Markdown in React."
- You would essentially rebuild `react-markdown` or `marked` on top of it.
- Higher implementation cost for basic use cases.

---

### Recommendation Matrix

| Criteria | react-markdown | marked + DOMPurify | micromark |
|---|---|---|---|
| **XSS-safe by default** | Yes | Only with DOMPurify | No |
| **React-native rendering** | Yes (no `dangerouslySetInnerHTML`) | No (requires `dangerouslySetInnerHTML`) | No |
| **Bundle size** | Largest (~200-300 kB total) | Medium (~60-100 kB runtime) | Medium (~200 kB) |
| **Implementation effort** | Lowest | Low-Medium | Highest |
| **Customization** | High (components prop) | Medium (renderer hooks) | Very High (custom extensions) |
| **TypeScript** | Excellent | Good (needs `@types/dompurify`) | Good |
| **Vite + Electron** | Works | Works | Works |

### Verdict for Milesto

For a **basic notes rendering** use case (bold, italic, lists, links, code blocks) in an Electron + React 18 + Vite app:

1. **Best fit: `react-markdown`**
   - The app is already React-based; rendering Markdown as React elements is the most idiomatic approach.
   - XSS safety is architectural, not procedural (no risk of forgetting to sanitize).
   - The bundle cost is acceptable for a desktop Electron app where download size is less critical than web.
   - The `components` prop allows easy styling integration with existing CSS classes.

2. **Acceptable alternative: `marked` + `DOMPurify`**
   - Use this if minimizing bundle size is a hard constraint.
   - Requires disciplined use: always sanitize, always use `dangerouslySetInnerHTML`.

3. **Not recommended: `micromark` alone**
   - Too low-level for this use case. It is a building block, not a user-facing renderer.

### Installation Commands (if choosing react-markdown)

```bash
npm install react-markdown
# Optional: for GitHub-Flavored Markdown (tables, strikethrough, task lists)
npm install remark-gfm
```

### Basic Usage Example

```tsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function NotesRenderer({ notes }: { notes: string }) {
  return (
    <div className="markdown-notes">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {notes}
      </ReactMarkdown>
    </div>
  )
}
```

### External References

- [react-markdown docs](https://github.com/remarkjs/react-markdown) — Official repository and README.
- [marked docs](https://marked.js.org) — Official documentation.
- [DOMPurify docs](https://github.com/cure53/DOMPurify) — Sanitization options and configuration.
- [micromark docs](https://github.com/micromark/micromark) — Low-level parser documentation.
- [unified ecosystem](https://unifiedjs.com) — Background on the AST pipeline used by react-markdown.

### Related Specs

- `.trellis/spec/frontend/component-guidelines.md` — Custom component styling conventions.
- `.trellis/spec/frontend/type-safety.md` — TypeScript and cross-layer contract guidelines.

### Caveats / Not Found

- No existing Markdown rendering code in the codebase; this would be a net-new dependency.
- The `notes` field is currently plain text in SQLite; no schema migration is needed to start rendering Markdown.
- If the app later needs to render Markdown in list views (e.g., task list cards), performance should be tested because `react-markdown` has AST overhead. Virtualized lists (`@tanstack/react-virtual`) may need memoization around the Markdown component.
