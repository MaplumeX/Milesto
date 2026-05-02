# feat(area): add tag metadata display on AreaPage

## Goal

在 Area 页面上添加标签芯片的行内展示，与 Project 页面的 `ProjectMetaRow` 保持一致的 UX。当前 Area 页面只通过 AreaMenu 弹窗的 TagPicker 编辑标签，但标签在页面上不可见，用户无法直观地看到区域关联了哪些标签。

## What I already know

- Area 实体本身不含 `tags` 字段，但 `area.getDetail` 返回 `AreaDetail { area, tags }`，AreaPage 已经在 `refresh()` 中获取并存储 `areaTags`
- AreaMenu 已支持 `TagPicker` 进行标签编辑（添加/移除），`area.setTags` API 已可用
- Project 页面有 `ProjectMetaRow` 组件，渲染最多 4 个标签芯片 + "+N" 溢出按钮
- CSS 样式 `project-meta-*` 系列已存在于 `src/index.css:1209-1355`
- Area 没有 `scheduled_at`/`due_at`/`is_someday` 字段，AreaMetaRow 只需展示标签

## Assumptions (temporary)

- AreaMetaRow 只需展示标签芯片，不需要日期元数据（Area 无日期字段）
- 复用现有 `project-meta-*` CSS 类名，不创建 `area-meta-*` 变体（语义虽不完美，但避免 CSS 重复）
- 标签芯片上的 "×" 移除按钮与 Project 页面行为一致：直接调用 `area.setTags` 移除
- "+N" 溢出按钮点击后打开 AreaMenu 的 tags 子视图

## Requirements

1. 在 Area 页面标题区域下方添加 `AreaMetaRow` 组件，展示区域关联的标签芯片
2. 标签芯片显示标签标题，hover 时显示 "×" 移除按钮
3. 超过 4 个标签时，显示 "+N" 溢出按钮
4. "+N" 溢出按钮点击后打开 AreaMenu 并定位到 tags 子视图
5. "×" 移除按钮点击后直接调用 `area.setTags` 移除该标签
6. 无标签时不渲染 AreaMetaRow
7. 标签变更后刷新页面数据

## Acceptance Criteria

- [ ] Area 页面在标题下方显示标签芯片（如有标签）
- [ ] 最多显示 4 个标签，超出部分显示 "+N"
- [ ] 点击标签芯片的 "×" 可移除标签，数据立即更新
- [ ] 点击 "+N" 溢出按钮打开 AreaMenu 的标签子视图
- [ ] 无标签时 AreaMetaRow 不渲染
- [ ] 样式与 Project 页面标签芯片保持一致
- [ ] 现有测试不受影响

## Definition of Done

- Lint / typecheck / CI green
- 现有测试通过
- 手动验证：标签显示、移除、溢出、无标签

## Out of Scope

- 为 Area 添加日期元数据展示（Area 无此字段）
- 创建独立的 `area-meta-*` CSS 类名体系
- 修改 sidebar 中的区域标签显示

## Technical Notes

### 关键文件

- `src/pages/AreaPage.tsx` — 添加 AreaMetaRow 组件，在 JSX 中插入
- `src/index.css` — 已有 `project-meta-*` 样式，直接复用
- `src/pages/ProjectPage.tsx` — 参考实现（`ProjectMetaRow` 组件，L936-1046）

### AreaMetaRow 设计

AreaMetaRow 比 ProjectMetaRow 简单得多：
- 无日期徽章（无 `scheduled_at`/`due_at`）
- 只有标签芯片行
- 需要接收 `areaTags`, `onRemoveTag`, `onManageTags` props

### 溢出按钮与 AreaMenu 联动

ProjectMenu 支持通过 `initialView` 属性直接打开 tags 子视图。AreaMenu 也有 `initialView` 属性（`View = 'root' | 'tags'`）。需要给 AreaMenu 添加类似的 `initialView` 入口，或通过 `setIsMenuOpen` + 新增状态来控制打开时直接跳到 tags 视图。

当前 AreaPage 的菜单状态管理使用 `isMenuOpen` boolean。需要扩展为与 ProjectPage 类似的 `menuState: { anchorEl, initialView } | null` 模式，以支持从标签溢出按钮直接打开 tags 子视图。