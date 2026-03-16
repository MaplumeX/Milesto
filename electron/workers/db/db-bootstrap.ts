import Database from 'better-sqlite3'

export function initDb(dbPath: string): Database.Database {
  const db = new Database(dbPath)

  // Baseline pragmas (docs/tech-framework.md).
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')

  migrate(db)
  return db
}

function migrate(db: Database.Database) {
  const userVersion = db.pragma('user_version', { simple: true }) as number

  function hasTable(tableName: string): boolean {
    return Boolean(
      db
        .prepare(
          `SELECT name
           FROM sqlite_master
           WHERE type = 'table' AND name = ?`
        )
        .get(tableName)
    )
  }

  function hasColumn(tableName: string, columnName: string): boolean {
    // Table name is static (ours), so interpolation is safe here.
    const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name?: unknown }[]
    return rows.some((r) => r.name === columnName)
  }

  if (userVersion < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS areas (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        color TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        area_id TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        scheduled_at TEXT,
        is_someday INTEGER NOT NULL DEFAULT 0,
        due_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        deleted_at TEXT,
        CHECK (is_someday IN (0, 1)),
        CHECK (is_someday = 0 OR scheduled_at IS NULL),
        FOREIGN KEY (area_id) REFERENCES areas(id)
      );

      CREATE TABLE IF NOT EXISTS project_sections (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        position INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'open',
        is_inbox INTEGER NOT NULL DEFAULT 0,
        is_someday INTEGER NOT NULL DEFAULT 0,
        project_id TEXT,
        section_id TEXT,
        area_id TEXT,
        scheduled_at TEXT,
        due_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        deleted_at TEXT,
        CHECK (is_inbox IN (0, 1)),
        CHECK (is_someday IN (0, 1)),
        CHECK (is_someday = 0 OR scheduled_at IS NULL),
        CHECK (is_inbox = 0 OR (project_id IS NULL AND scheduled_at IS NULL AND is_someday = 0)),
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (section_id) REFERENCES project_sections(id),
        FOREIGN KEY (area_id) REFERENCES areas(id)
      );

      CREATE TABLE IF NOT EXISTS task_tags (
        task_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (task_id, tag_id),
        FOREIGN KEY (task_id) REFERENCES tasks(id),
        FOREIGN KEY (tag_id) REFERENCES tags(id)
      );

      CREATE TABLE IF NOT EXISTS task_checklist_items (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        title TEXT NOT NULL,
        done INTEGER NOT NULL DEFAULT 0,
        position INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      );

      CREATE TABLE IF NOT EXISTS list_positions (
        list_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        rank INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (list_id, task_id),
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_is_inbox ON tasks(is_inbox);
      CREATE INDEX IF NOT EXISTS idx_tasks_is_someday ON tasks(is_someday);
      CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_at ON tasks(scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_section_id ON tasks(section_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_area_id ON tasks(area_id);
      CREATE INDEX IF NOT EXISTS idx_projects_area_id ON projects(area_id);
      CREATE INDEX IF NOT EXISTS idx_project_sections_project_id ON project_sections(project_id);
      CREATE INDEX IF NOT EXISTS idx_list_positions_list_rank ON list_positions(list_id, rank);

      CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
        title,
        notes,
        content='tasks',
        content_rowid='rowid'
      );

      CREATE TRIGGER IF NOT EXISTS tasks_ai AFTER INSERT ON tasks
      WHEN new.deleted_at IS NULL
      BEGIN
        INSERT INTO tasks_fts(rowid, title, notes) VALUES (new.rowid, new.title, new.notes);
      END;

      CREATE TRIGGER IF NOT EXISTS tasks_ad AFTER DELETE ON tasks
      WHEN old.deleted_at IS NULL
      BEGIN
        INSERT INTO tasks_fts(tasks_fts, rowid, title, notes) VALUES('delete', old.rowid, old.title, old.notes);
      END;

      CREATE TRIGGER IF NOT EXISTS tasks_au AFTER UPDATE OF title, notes ON tasks
      WHEN old.deleted_at IS NULL AND new.deleted_at IS NULL
      BEGIN
        INSERT INTO tasks_fts(tasks_fts, rowid, title, notes) VALUES('delete', old.rowid, old.title, old.notes);
        INSERT INTO tasks_fts(rowid, title, notes) VALUES (new.rowid, new.title, new.notes);
      END;

      CREATE TRIGGER IF NOT EXISTS tasks_au_soft_delete AFTER UPDATE OF deleted_at ON tasks
      WHEN old.deleted_at IS NULL AND new.deleted_at IS NOT NULL
      BEGIN
        INSERT INTO tasks_fts(tasks_fts, rowid, title, notes) VALUES('delete', old.rowid, old.title, old.notes);
      END;

      CREATE TRIGGER IF NOT EXISTS tasks_au_restore AFTER UPDATE OF deleted_at ON tasks
      WHEN old.deleted_at IS NOT NULL AND new.deleted_at IS NULL
      BEGIN
        INSERT INTO tasks_fts(rowid, title, notes) VALUES (new.rowid, new.title, new.notes);
      END;
    `)

    db.pragma('user_version = 1')
  }

  if (userVersion < 2) {
    // v2: Sidebar manual ordering for areas/projects.
    const stmts: string[] = []
    if (!hasColumn('areas', 'position')) stmts.push('ALTER TABLE areas ADD COLUMN position INTEGER;')
    if (!hasColumn('projects', 'position')) stmts.push('ALTER TABLE projects ADD COLUMN position INTEGER;')

    stmts.push('CREATE INDEX IF NOT EXISTS idx_areas_position ON areas(position);')
    stmts.push('CREATE INDEX IF NOT EXISTS idx_projects_area_position ON projects(area_id, position);')

    db.exec(stmts.join('\n'))

    db.pragma('user_version = 2')
  }

  if (userVersion < 3) {
    // v3: App settings key/value store (currently used for locale preference).
    db.exec(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `)

    db.pragma('user_version = 3')
  }

  if (userVersion < 4) {
    // v4: Ordered tags for projects and areas.
    db.exec(`
      CREATE TABLE IF NOT EXISTS project_tags (
        project_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (project_id, tag_id),
        UNIQUE (project_id, position),
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (tag_id) REFERENCES tags(id)
      );

      CREATE TABLE IF NOT EXISTS area_tags (
        area_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (area_id, tag_id),
        UNIQUE (area_id, position),
        FOREIGN KEY (area_id) REFERENCES areas(id),
        FOREIGN KEY (tag_id) REFERENCES tags(id)
      );

      CREATE INDEX IF NOT EXISTS idx_project_tags_project_position ON project_tags(project_id, position);
      CREATE INDEX IF NOT EXISTS idx_area_tags_area_position ON area_tags(area_id, position);
    `)

    db.pragma('user_version = 4')
  }

  if (userVersion < 5) {
    // v5: Project-level Someday scheduling state.
    const stmts: string[] = []
    if (!hasColumn('projects', 'is_someday')) {
      stmts.push(
        "ALTER TABLE projects ADD COLUMN is_someday INTEGER NOT NULL DEFAULT 0;"
      )
      // Backfill is redundant with DEFAULT, but keeps intent explicit.
      stmts.push('UPDATE projects SET is_someday = 0 WHERE is_someday IS NULL;')
    }

    if (stmts.length > 0) db.exec(stmts.join('\n'))
    db.pragma('user_version = 5')
  }

  if (userVersion < 6) {
    const stmts: string[] = []

    if (hasTable('task_tags') && !hasColumn('task_tags', 'deleted_at')) {
      stmts.push(`
        ALTER TABLE task_tags RENAME TO task_tags_legacy;

        CREATE TABLE task_tags (
          task_id TEXT NOT NULL,
          tag_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          PRIMARY KEY (task_id, tag_id),
          FOREIGN KEY (task_id) REFERENCES tasks(id),
          FOREIGN KEY (tag_id) REFERENCES tags(id)
        );

        INSERT INTO task_tags (task_id, tag_id, created_at, updated_at, deleted_at)
        SELECT task_id, tag_id, created_at, created_at, NULL
        FROM task_tags_legacy;

        DROP TABLE task_tags_legacy;

        CREATE INDEX IF NOT EXISTS idx_task_tags_task_active
        ON task_tags(task_id, updated_at)
        WHERE deleted_at IS NULL;
      `)
    }

    if (hasTable('project_tags') && !hasColumn('project_tags', 'deleted_at')) {
      stmts.push(`
        ALTER TABLE project_tags RENAME TO project_tags_legacy;

        CREATE TABLE project_tags (
          project_id TEXT NOT NULL,
          tag_id TEXT NOT NULL,
          position INTEGER,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          PRIMARY KEY (project_id, tag_id),
          FOREIGN KEY (project_id) REFERENCES projects(id),
          FOREIGN KEY (tag_id) REFERENCES tags(id)
        );

        INSERT INTO project_tags (project_id, tag_id, position, created_at, updated_at, deleted_at)
        SELECT project_id, tag_id, position, created_at, created_at, NULL
        FROM project_tags_legacy;

        DROP TABLE project_tags_legacy;

        CREATE UNIQUE INDEX IF NOT EXISTS idx_project_tags_project_position_active
        ON project_tags(project_id, position)
        WHERE deleted_at IS NULL AND position IS NOT NULL;

        CREATE INDEX IF NOT EXISTS idx_project_tags_project_position
        ON project_tags(project_id, position)
        WHERE deleted_at IS NULL;
      `)
    }

    if (hasTable('area_tags') && !hasColumn('area_tags', 'deleted_at')) {
      stmts.push(`
        ALTER TABLE area_tags RENAME TO area_tags_legacy;

        CREATE TABLE area_tags (
          area_id TEXT NOT NULL,
          tag_id TEXT NOT NULL,
          position INTEGER,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          PRIMARY KEY (area_id, tag_id),
          FOREIGN KEY (area_id) REFERENCES areas(id),
          FOREIGN KEY (tag_id) REFERENCES tags(id)
        );

        INSERT INTO area_tags (area_id, tag_id, position, created_at, updated_at, deleted_at)
        SELECT area_id, tag_id, position, created_at, created_at, NULL
        FROM area_tags_legacy;

        DROP TABLE area_tags_legacy;

        CREATE UNIQUE INDEX IF NOT EXISTS idx_area_tags_area_position_active
        ON area_tags(area_id, position)
        WHERE deleted_at IS NULL AND position IS NOT NULL;

        CREATE INDEX IF NOT EXISTS idx_area_tags_area_position
        ON area_tags(area_id, position)
        WHERE deleted_at IS NULL;
      `)
    }

    stmts.push(`
      CREATE TABLE IF NOT EXISTS sync_device_state (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        device_id TEXT NOT NULL UNIQUE,
        device_name TEXT NOT NULL,
        sync_enabled INTEGER NOT NULL DEFAULT 0,
        last_local_hlc TEXT,
        last_successful_sync_at TEXT,
        last_attempted_sync_at TEXT,
        last_error_code TEXT,
        last_error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (sync_enabled IN (0, 1))
      );

      CREATE TABLE IF NOT EXISTS sync_outbox_batches (
        batch_id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        sequence_number INTEGER NOT NULL UNIQUE,
        version TEXT NOT NULL,
        batch_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        retry_count INTEGER NOT NULL DEFAULT 0,
        last_error_code TEXT,
        last_error_message TEXT,
        uploaded_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (status IN ('pending', 'uploaded'))
      );

      CREATE INDEX IF NOT EXISTS idx_sync_outbox_status_sequence
      ON sync_outbox_batches(status, sequence_number);

      CREATE TABLE IF NOT EXISTS sync_remote_cursors (
        source_device_id TEXT PRIMARY KEY,
        last_applied_sequence INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_field_versions (
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        field_name TEXT NOT NULL,
        version TEXT NOT NULL,
        device_id TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (entity_type, entity_id, field_name)
      );

      CREATE INDEX IF NOT EXISTS idx_sync_field_versions_entity
      ON sync_field_versions(entity_type, entity_id);

      CREATE TABLE IF NOT EXISTS sync_list_versions (
        list_scope TEXT PRIMARY KEY,
        version TEXT NOT NULL,
        device_id TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_conflict_events (
        id TEXT PRIMARY KEY,
        scope TEXT NOT NULL,
        source_device_id TEXT NOT NULL,
        incoming_version TEXT NOT NULL,
        winning_version TEXT NOT NULL,
        code TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sync_conflict_events_created_at
      ON sync_conflict_events(created_at DESC);

      CREATE TABLE IF NOT EXISTS sync_credentials (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        encrypted_blob TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `)

    db.exec(stmts.join('\n'))
    db.pragma('user_version = 6')
  }
}
