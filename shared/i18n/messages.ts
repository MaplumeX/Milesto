import type { Locale } from './locale'

// Shared message catalogs used by both Renderer (i18next resources) and Main (native dialogs).
// Keep these small and predictable: no runtime disk reads, no IPC transfer of catalogs.

export type MessageCatalog = Record<string, unknown>

export const messagesEn = {
  common: {
    none: 'None',
    noneOption: '(none)',
    clear: 'Clear',
    close: 'Close',
    retry: 'Retry',
    rename: 'Rename',
    delete: 'Delete',
    search: 'Search',
    schedule: 'Schedule',
    move: 'Move',
    more: 'More',
    addProject: '+ Project',
    addTag: '+ Tag',
    untitled: '(untitled)',
    loading: 'Loading…',
    back: 'Back',
  },
  aria: {
    sidebar: 'Sidebar',
    mainNavigation: 'Main navigation',
    content: 'Content',
    tasks: 'Tasks',
    upcomingTasks: 'Upcoming tasks',
    projectTasks: 'Project tasks',
    taskEditor: 'Task editor',
    sectionTitle: 'Section title',
    projectTitle: 'Project title',
    projectActions: 'Project actions',
    areaActions: 'Area actions',
    markProjectDone: 'Mark project done',
    taskDone: 'Done',
    collapseArea: 'Collapse area {{title}}',
    expandArea: 'Expand area {{title}}',
    removeTag: 'Remove tag {{title}}',
  },
  nav: {
    inbox: 'Inbox',
    today: 'Today',
    upcoming: 'Upcoming',
    anytime: 'Anytime',
    someday: 'Someday',
    logbook: 'Logbook',
    settings: 'Settings',
    projects: 'Projects',
  },
  shell: {
    empty: '(empty)',
    project: 'Project',
    area: 'Area',
    areas: 'Areas',
    projectTitlePlaceholder: 'New project',
    areaTitlePlaceholder: 'New area',
    create: 'Create',
    cancel: 'Cancel',
    new: '+ New',
    task: '+ Task',
    section: '+ Section',
  },
  search: {
    title: 'Search',
    placeholder: 'Search title + notes…',
    includeLogbook: 'Include Logbook',
    resultsAriaLabel: 'Search results',
    noResults: 'No results',
  },
  logbook: {
    completedProjects: 'Completed Projects',
  },
  settings: {
    title: 'Settings',
    language: 'Language',
    languageEnglish: 'English',
    languageChinese: '中文',
    theme: 'Theme',
    themeSystem: 'System',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeEffective: 'Effective: {{theme}}',
    data: 'Data',
    export: 'Export…',
    import: 'Import…',
    resetAllData: 'Reset All Data',
    resetConfirm: 'Reset all local data?',
    showInFolder: 'Show In Folder',
    about: 'About',
    version: 'Version',
    userData: 'User data',
    shortcuts: 'Shortcuts',
    openDataFolder: 'Open Data Folder',
  },
  area: {
    renamePromptTitle: 'Rename area',
    untitled: 'New area',
    deleteConfirm: 'Delete this area? Projects and tasks under it will be soft-deleted.',
  },
  project: {
    newTitlePrompt: 'New project title',
    renamePromptTitle: 'Rename project',
    untitled: 'New project',
    completeConfirm: 'Mark project done and complete {{count}} open tasks?',
    deleteConfirm: 'Delete this project? Tasks and sections under it will be soft-deleted.',
  },
  tag: {
    newPromptTitle: 'New tag',
    renamePromptTitle: 'Rename tag',
    deleteConfirm: 'Delete tag?',
  },
  section: {
    untitled: 'New section',
  },
  task: {
    untitled: 'New task',
    titlePlaceholder: 'New task',
    notesPlaceholder: 'Notes',
    restore: 'Restore',
    deleteConfirm: 'Delete task?',
  },
  upcoming: {
    nextWeek: 'Next Week',
    nextMonth: 'Next Month',
    showingAfter: 'Showing tasks scheduled after {{date}}',
    empty: 'No upcoming tasks',
  },
  projectPage: {
    notesPlaceholder: 'Add notes…',
    noOpenTasks: 'No open tasks',
    completed: 'Completed',
    menuTitle: 'Project',
    areaLabel: 'Area',
    reopen: 'Reopen',
    markDone: 'Mark Done',
  },
  areaPage: {
    menuTitle: 'Area',
  },
  taskEditor: {
    taskTitle: 'Task',
    statusDone: 'Done',
    statusOpen: 'Open',
    scheduledPrefix: 'Scheduled:',
    duePrefix: 'Due:',
    tagsPrefix: 'Tags:',
    clearScheduledAria: 'Clear scheduled',
    clearDueAria: 'Clear due',
    clearTagsAria: 'Clear tags',
    popoverScheduleTitle: 'Scheduled',
    popoverDueTitle: 'Due',
    markdownPlaceholder: 'Markdown supported (stored as plain text in v0.1).',
    actionFailedTitle: 'Action failed',
    titleLabel: 'Title',
    notesLabel: 'Notes',
    projectLabel: 'Project',
    sectionLabel: 'Section',
    areaLabel: 'Area',
    scheduledLabel: 'Scheduled',
    dueLabel: 'Due',
    tagsLabel: 'Tags',
    checklistLabel: 'Checklist',
    markDone: 'Mark Done',
    checklistItemDoneAria: 'Checklist item done',
    checklistItemPlaceholder: 'Checklist item',
    newTagPlaceholder: 'New tag',
  },
  errors: {
    missingAreaId: 'Missing area id.',
    missingProjectId: 'Missing project id.',
  },
  dialog: {
    export: {
      title: 'Export Milesto Data',
    },
    import: {
      title: 'Import Milesto Data',
    },
  },
  fileFilter: {
    json: 'JSON',
  },
} as const

export const messagesZhCN = {
  common: {
    none: '无',
    noneOption: '（无）',
    clear: '清除',
    close: '关闭',
    retry: '重试',
    rename: '重命名',
    delete: '删除',
    search: '搜索',
    schedule: '计划',
    move: '移动',
    more: '更多',
    addProject: '+ 项目',
    addTag: '+ 标签',
    untitled: '（无标题）',
    loading: '加载中…',
    back: '返回',
  },
  aria: {
    sidebar: '侧边栏',
    mainNavigation: '主导航',
    content: '内容',
    tasks: '任务',
    upcomingTasks: '计划任务',
    projectTasks: '项目任务',
    taskEditor: '任务编辑器',
    sectionTitle: '分组标题',
    projectTitle: '项目标题',
    projectActions: '项目操作',
    areaActions: '领域操作',
    markProjectDone: '标记项目完成',
    taskDone: '完成',
    collapseArea: '折叠领域 {{title}}',
    expandArea: '展开领域 {{title}}',
    removeTag: '移除标签 {{title}}',
  },
  nav: {
    inbox: '收件箱',
    today: '今天',
    upcoming: '计划',
    anytime: '随时',
    someday: '某天',
    logbook: '日志',
    settings: '设置',
    projects: '项目',
  },
  shell: {
    empty: '(空)',
    project: '项目',
    area: '领域',
    areas: '领域',
    projectTitlePlaceholder: '新建项目',
    areaTitlePlaceholder: '新建领域',
    create: '创建',
    cancel: '取消',
    new: '+ 新建',
    task: '+ 任务',
    section: '+ 分组',
  },
  search: {
    title: '搜索',
    placeholder: '搜索标题 + 备注…',
    includeLogbook: '包含日志',
    resultsAriaLabel: '搜索结果',
    noResults: '无结果',
  },
  logbook: {
    completedProjects: '已完成项目',
  },
  settings: {
    title: '设置',
    language: '语言',
    languageEnglish: 'English',
    languageChinese: '中文',
    theme: '主题',
    themeSystem: '跟随系统',
    themeLight: '浅色',
    themeDark: '深色',
    themeEffective: '当前：{{theme}}',
    data: '数据',
    export: '导出…',
    import: '导入…',
    resetAllData: '重置所有数据',
    resetConfirm: '重置所有本地数据？',
    showInFolder: '在文件夹中显示',
    about: '关于',
    version: '版本',
    userData: '用户数据',
    shortcuts: '快捷键',
    openDataFolder: '打开数据文件夹',
  },
  area: {
    renamePromptTitle: '重命名领域',
    untitled: '新建领域',
    deleteConfirm: '删除此领域？其下的项目和任务将被软删除。',
  },
  project: {
    newTitlePrompt: '新建项目标题',
    renamePromptTitle: '重命名项目',
    untitled: '新建项目',
    completeConfirm: '标记项目完成并完成 {{count}} 个未完成任务？',
    deleteConfirm: '删除此项目？其下的任务与分组将被软删除。',
  },
  tag: {
    newPromptTitle: '新建标签',
    renamePromptTitle: '重命名标签',
    deleteConfirm: '删除标签？',
  },
  section: {
    untitled: '新建分组',
  },
  task: {
    untitled: '新建任务',
    titlePlaceholder: '新建任务',
    notesPlaceholder: '备注',
    restore: '恢复',
    deleteConfirm: '删除任务？',
  },
  upcoming: {
    nextWeek: '下周',
    nextMonth: '下月',
    showingAfter: '显示 {{date}} 之后计划的任务',
    empty: '暂无计划任务',
  },
  projectPage: {
    notesPlaceholder: '添加备注…',
    noOpenTasks: '没有未完成任务',
    completed: '已完成',
    menuTitle: '项目',
    areaLabel: '领域',
    reopen: '重新打开',
    markDone: '标记完成',
  },
  areaPage: {
    menuTitle: '领域',
  },
  taskEditor: {
    taskTitle: '任务',
    statusDone: '已完成',
    statusOpen: '未完成',
    scheduledPrefix: '计划：',
    duePrefix: '到期：',
    tagsPrefix: '标签：',
    clearScheduledAria: '清除计划',
    clearDueAria: '清除到期',
    clearTagsAria: '清除标签',
    popoverScheduleTitle: '计划',
    popoverDueTitle: '到期',
    markdownPlaceholder: '支持 Markdown（v0.1 中按纯文本存储）。',
    actionFailedTitle: '操作失败',
    titleLabel: '标题',
    notesLabel: '备注',
    projectLabel: '项目',
    sectionLabel: '分组',
    areaLabel: '领域',
    scheduledLabel: '计划',
    dueLabel: '到期',
    tagsLabel: '标签',
    checklistLabel: '清单',
    markDone: '标记完成',
    checklistItemDoneAria: '清单条目完成',
    checklistItemPlaceholder: '清单条目',
    newTagPlaceholder: '新建标签',
  },
  errors: {
    missingAreaId: '缺少领域 ID。',
    missingProjectId: '缺少项目 ID。',
  },
  dialog: {
    export: {
      title: '导出 Milesto 数据',
    },
    import: {
      title: '导入 Milesto 数据',
    },
  },
  fileFilter: {
    json: 'JSON',
  },
} as const

export const messageCatalogs: Record<Locale, MessageCatalog> = {
  en: messagesEn,
  'zh-CN': messagesZhCN,
}

type KeyMismatch = {
  missingInEn: string[]
  missingInZhCN: string[]
}

function collectLeafKeys(node: unknown, prefix: string, out: Set<string>) {
  if (typeof node === 'string') {
    out.add(prefix)
    return
  }

  if (node && typeof node === 'object' && !Array.isArray(node)) {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      const next = prefix ? `${prefix}.${k}` : k
      collectLeafKeys(v, next, out)
    }
    return
  }

  throw new Error(`Invalid message catalog value at "${prefix}": expected string or object`)
}

export function diffCatalogKeys(a: MessageCatalog, b: MessageCatalog): string[] {
  const aKeys = new Set<string>()
  const bKeys = new Set<string>()
  collectLeafKeys(a, '', aKeys)
  collectLeafKeys(b, '', bKeys)
  return [...aKeys].filter((k) => !bKeys.has(k)).sort()
}

export function checkMessageCatalogParity(): KeyMismatch {
  const missingInZhCN = diffCatalogKeys(messagesEn, messagesZhCN)
  const missingInEn = diffCatalogKeys(messagesZhCN, messagesEn)
  return { missingInEn, missingInZhCN }
}
