const Database = require('better-sqlite3');
const path = require('path');
const { CONFIG_DIR } = require('./config.cjs');

const DB_PATH = path.join(CONFIG_DIR, 'command-center.db');

let db = null;

/**
 * Initialize the database and create tables
 */
function initDatabase() {
  // Ensure config directory exists
  const fs = require('fs');
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  
  // Enable foreign keys and WAL mode for better performance
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  
  // Create tables
  db.exec(`
    -- Local tasks
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      notes TEXT,
      link TEXT,
      category TEXT NOT NULL CHECK(category IN ('work', 'home', 'personal', 'side-project')),
      status TEXT DEFAULT 'todo' CHECK(status IN ('todo', 'in-progress', 'done')),
      due_date TEXT,
      is_sync_priority INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT,
      source TEXT DEFAULT 'local' CHECK(source IN ('local'))
    );

    -- Subtasks for tasks (lightweight checklist items)
    CREATE TABLE IF NOT EXISTS subtasks (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      title TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    -- Meetings
    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('work', 'home', 'personal', 'side-project')),
      done INTEGER DEFAULT 0,
      link TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Daily logs (extended for rituals)
    CREATE TABLE IF NOT EXISTS daily_logs (
      id TEXT PRIMARY KEY,
      date TEXT UNIQUE NOT NULL,
      
      -- Morning ritual
      morning_ritual_completed INTEGER DEFAULT 0,
      morning_ritual_time TEXT,
      intention TEXT,
      sync_priority_id TEXT,
      
      -- Evening ritual
      evening_ritual_completed INTEGER DEFAULT 0,
      evening_ritual_time TEXT,
      reflection TEXT,
      gratitude TEXT,
      untracked_wins TEXT,
      energy_level INTEGER CHECK(energy_level BETWEEN 1 AND 5),
      
      -- Computed metrics
      tasks_completed INTEGER DEFAULT 0,
      tasks_created INTEGER DEFAULT 0,
      focus_achieved INTEGER DEFAULT 0,
      
      -- Legacy fields (kept for compatibility)
      morning_intention TEXT,
      evening_reflection TEXT,
      meetings TEXT,
      
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      
      FOREIGN KEY (sync_priority_id) REFERENCES tasks(id) ON DELETE SET NULL
    );

    -- Streak tracking
    CREATE TABLE IF NOT EXISTS streaks (
      id TEXT PRIMARY KEY,
      streak_type TEXT NOT NULL UNIQUE,
      current_count INTEGER DEFAULT 0,
      best_count INTEGER DEFAULT 0,
      last_date TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Weekly metrics (aggregated)
    CREATE TABLE IF NOT EXISTS weekly_metrics (
      id TEXT PRIMARY KEY,
      year INTEGER NOT NULL,
      week INTEGER NOT NULL,
      tasks_completed INTEGER DEFAULT 0,
      tasks_created INTEGER DEFAULT 0,
      focus_days INTEGER DEFAULT 0,
      morning_rituals INTEGER DEFAULT 0,
      evening_rituals INTEGER DEFAULT 0,
      avg_energy REAL,
      goals_completed INTEGER DEFAULT 0,
      goals_progress_avg REAL,
      prs_merged INTEGER DEFAULT 0,
      prs_reviewed INTEGER DEFAULT 0,
      inbox_processed INTEGER DEFAULT 0,
      avg_inbox_time_minutes REAL,
      computed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(year, week)
    );

    -- Monthly metrics (aggregated)
    CREATE TABLE IF NOT EXISTS monthly_metrics (
      id TEXT PRIMARY KEY,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      tasks_completed INTEGER DEFAULT 0,
      focus_days INTEGER DEFAULT 0,
      ritual_days INTEGER DEFAULT 0,
      avg_energy REAL,
      goals_completed INTEGER DEFAULT 0,
      prs_merged INTEGER DEFAULT 0,
      prs_reviewed INTEGER DEFAULT 0,
      tasks_by_category TEXT,
      computed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(year, month)
    );

    -- GitHub activity log
    CREATE TABLE IF NOT EXISTS github_activity (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      activity_type TEXT NOT NULL,
      repo TEXT,
      item_number INTEGER,
      item_title TEXT,
      url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes for metrics tables
    CREATE INDEX IF NOT EXISTS idx_weekly_metrics_year_week ON weekly_metrics(year, week);
    CREATE INDEX IF NOT EXISTS idx_monthly_metrics_year_month ON monthly_metrics(year, month);
    CREATE INDEX IF NOT EXISTS idx_github_activity_date ON github_activity(date);
    CREATE INDEX IF NOT EXISTS idx_github_activity_type ON github_activity(activity_type);

    -- Create indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);
    CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON daily_logs(date);
    CREATE INDEX IF NOT EXISTS idx_meetings_time ON meetings(time);

    -- Blocked meeting patterns for WorkIQ sync
    CREATE TABLE IF NOT EXISTS blocked_meeting_patterns (
      id TEXT PRIMARY KEY,
      pattern TEXT NOT NULL,
      is_regex INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Index for blocked meeting patterns
    CREATE INDEX IF NOT EXISTS idx_blocked_patterns_pattern ON blocked_meeting_patterns(pattern);

    -- Project items
    CREATE TABLE IF NOT EXISTS project_items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT DEFAULT 'idea' CHECK(status IN ('idea', 'in-progress', 'completed')),
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Index for project items
    CREATE INDEX IF NOT EXISTS idx_project_items_status ON project_items(status);
  `);
  
  // Run migrations to add new columns to existing tables
  runMigrations(db);
  
  console.log('Database initialized at:', DB_PATH);
  return db;
}

/**
 * Run schema migrations for existing databases
 */
function runMigrations(db) {
  // Check if sync_status table exists before trying to migrate it
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sync_status'").all();
  if (tables.length > 0) {
    // Check if duration column exists in sync_status
    const syncStatusInfo = db.pragma('table_info(sync_status)');
    const hasDuration = syncStatusInfo.some(col => col.name === 'duration');
    
    if (!hasDuration) {
      console.log('Running migration: adding duration column to sync_status');
      db.exec('ALTER TABLE sync_status ADD COLUMN duration INTEGER');
    }
  }
  
  // Check if meetings table has correct schema (needs date and time columns)
  const meetingsInfo = db.pragma('table_info(meetings)');
  const hasDate = meetingsInfo.some(col => col.name === 'date');
  const hasTime = meetingsInfo.some(col => col.name === 'time');
  const hasNotes = meetingsInfo.some(col => col.name === 'notes');
  
  if (!hasDate || !hasTime) {
    console.log('Running migration: updating meetings table schema to have date and time columns');
    const hasDatetime = meetingsInfo.some(col => col.name === 'datetime');
    
    // Create new table with correct schema
    db.exec(`
      CREATE TABLE meetings_new (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('work', 'home', 'personal', 'side-project')),
        done INTEGER DEFAULT 0,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Copy existing data if the table has records
    const count = db.prepare('SELECT COUNT(*) as count FROM meetings').get().count;
    if (count > 0) {
      if (hasDatetime) {
        // Old schema had datetime column
        console.log('Migrating from datetime column to date/time columns');
        db.exec(`
          INSERT INTO meetings_new (id, title, date, time, category, done, created_at)
          SELECT 
            id,
            title,
            DATE(datetime) as date,
            TIME(datetime) as time,
            category,
            done,
            created_at
          FROM meetings;
        `);
      } else {
        // Unknown old schema, try to preserve what we can
        console.log('Attempting to preserve existing meeting data');
        try {
          db.exec(`
            INSERT INTO meetings_new (id, title, date, time, category, done, created_at)
            SELECT 
              id,
              title,
              COALESCE(date, datetime, created_at) as date,
              COALESCE(time, '12:00') as time,
              category,
              done,
              created_at
            FROM meetings;
          `);
        } catch (err) {
          console.log('Could not migrate old meeting data:', err.message);
        }
      }
    }
    
    // Replace old table
    db.exec(`
      DROP TABLE meetings;
      ALTER TABLE meetings_new RENAME TO meetings;
      CREATE INDEX IF NOT EXISTS idx_meetings_time ON meetings(time);
    `);
    
    console.log('Meetings table migration complete');
  } else if (!hasNotes) {
    // Add notes column if it doesn't exist
    console.log('Running migration: adding notes column to meetings table');
    db.exec('ALTER TABLE meetings ADD COLUMN notes TEXT');
  }

  // Add link column to meetings if it doesn't exist
  const meetingsInfoForLink = db.pragma('table_info(meetings)');
  const hasLink = meetingsInfoForLink.some(col => col.name === 'link');
  if (!hasLink) {
    console.log('Running migration: adding link column to meetings table');
    db.exec('ALTER TABLE meetings ADD COLUMN link TEXT');
  }

  // Add source and external_id columns for WorkIQ sync
  const meetingsInfoForSync = db.pragma('table_info(meetings)');
  const hasSource = meetingsInfoForSync.some(col => col.name === 'source');
  const hasExternalId = meetingsInfoForSync.some(col => col.name === 'external_id');
  if (!hasSource) {
    console.log('Running migration: adding source column to meetings table');
    db.exec("ALTER TABLE meetings ADD COLUMN source TEXT DEFAULT 'local'");
  }
  if (!hasExternalId) {
    console.log('Running migration: adding external_id column to meetings table');
    db.exec('ALTER TABLE meetings ADD COLUMN external_id TEXT');
    db.exec('CREATE INDEX IF NOT EXISTS idx_meetings_external_id ON meetings(external_id)');
  }

  // Daily logs ritual columns migration
  const dailyLogsInfo = db.pragma('table_info(daily_logs)');
  const hasMorningRitualCompleted = dailyLogsInfo.some(col => col.name === 'morning_ritual_completed');
  const hasIntention = dailyLogsInfo.some(col => col.name === 'intention');
  const hasGratitude = dailyLogsInfo.some(col => col.name === 'gratitude');
  const hasTasksCompleted = dailyLogsInfo.some(col => col.name === 'tasks_completed');
  const hasUpdatedAt = dailyLogsInfo.some(col => col.name === 'updated_at');
  const hasCreatedAt = dailyLogsInfo.some(col => col.name === 'created_at');

  if (!hasMorningRitualCompleted) {
    console.log('Running migration: adding ritual columns to daily_logs');
    db.exec('ALTER TABLE daily_logs ADD COLUMN morning_ritual_completed INTEGER DEFAULT 0');
    db.exec('ALTER TABLE daily_logs ADD COLUMN morning_ritual_time TEXT');
    db.exec('ALTER TABLE daily_logs ADD COLUMN evening_ritual_completed INTEGER DEFAULT 0');
    db.exec('ALTER TABLE daily_logs ADD COLUMN evening_ritual_time TEXT');
    db.exec('ALTER TABLE daily_logs ADD COLUMN untracked_wins TEXT');
    db.exec('ALTER TABLE daily_logs ADD COLUMN focus_achieved INTEGER DEFAULT 0');
  }
  if (!hasIntention) {
    console.log('Running migration: adding intention column to daily_logs');
    db.exec('ALTER TABLE daily_logs ADD COLUMN intention TEXT');
  }
  if (!hasGratitude) {
    console.log('Running migration: adding gratitude column to daily_logs');
    db.exec('ALTER TABLE daily_logs ADD COLUMN gratitude TEXT');
  }
  if (!hasTasksCompleted) {
    console.log('Running migration: adding metrics columns to daily_logs');
    db.exec('ALTER TABLE daily_logs ADD COLUMN tasks_completed INTEGER DEFAULT 0');
    db.exec('ALTER TABLE daily_logs ADD COLUMN tasks_created INTEGER DEFAULT 0');
  }
  if (!hasUpdatedAt) {
    console.log('Running migration: adding updated_at column to daily_logs');
    db.exec('ALTER TABLE daily_logs ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP');
  }
  if (!hasCreatedAt) {
    console.log('Running migration: adding created_at column to daily_logs');
    db.exec('ALTER TABLE daily_logs ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP');
  }

  // Migrate morning_intention to intention if data exists
  if (dailyLogsInfo.some(col => col.name === 'morning_intention')) {
    try {
      db.exec(`
        UPDATE daily_logs 
        SET intention = morning_intention 
        WHERE intention IS NULL AND morning_intention IS NOT NULL
      `);
    } catch (err) {
      // Ignore if columns don't exist
    }
  }

  // Migrate evening_reflection to reflection if data exists
  if (dailyLogsInfo.some(col => col.name === 'evening_reflection')) {
    try {
      const hasReflection = dailyLogsInfo.some(col => col.name === 'reflection');
      if (!hasReflection) {
        db.exec('ALTER TABLE daily_logs ADD COLUMN reflection TEXT');
      }
      db.exec(`
        UPDATE daily_logs 
        SET reflection = evening_reflection 
        WHERE reflection IS NULL AND evening_reflection IS NOT NULL
      `);
    } catch (err) {
      // Ignore if columns don't exist
    }
  }

  // Create streaks table if it doesn't exist (for existing DBs)
  db.exec(`
    CREATE TABLE IF NOT EXISTS streaks (
      id TEXT PRIMARY KEY,
      streak_type TEXT NOT NULL UNIQUE,
      current_count INTEGER DEFAULT 0,
      best_count INTEGER DEFAULT 0,
      last_date TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create weekly_metrics table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS weekly_metrics (
      id TEXT PRIMARY KEY,
      year INTEGER NOT NULL,
      week INTEGER NOT NULL,
      tasks_completed INTEGER DEFAULT 0,
      tasks_created INTEGER DEFAULT 0,
      focus_days INTEGER DEFAULT 0,
      morning_rituals INTEGER DEFAULT 0,
      evening_rituals INTEGER DEFAULT 0,
      avg_energy REAL,
      goals_completed INTEGER DEFAULT 0,
      goals_progress_avg REAL,
      prs_merged INTEGER DEFAULT 0,
      prs_reviewed INTEGER DEFAULT 0,
      inbox_processed INTEGER DEFAULT 0,
      avg_inbox_time_minutes REAL,
      computed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(year, week)
    )
  `);

  // Create monthly_metrics table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS monthly_metrics (
      id TEXT PRIMARY KEY,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      tasks_completed INTEGER DEFAULT 0,
      focus_days INTEGER DEFAULT 0,
      ritual_days INTEGER DEFAULT 0,
      avg_energy REAL,
      goals_completed INTEGER DEFAULT 0,
      prs_merged INTEGER DEFAULT 0,
      prs_reviewed INTEGER DEFAULT 0,
      tasks_by_category TEXT,
      computed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(year, month)
    )
  `);

  // Create github_activity table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS github_activity (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      activity_type TEXT NOT NULL,
      repo TEXT,
      item_number INTEGER,
      item_title TEXT,
      url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes for new tables
  db.exec('CREATE INDEX IF NOT EXISTS idx_weekly_metrics_year_week ON weekly_metrics(year, week)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_monthly_metrics_year_month ON monthly_metrics(year, month)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_github_activity_date ON github_activity(date)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_github_activity_type ON github_activity(activity_type)');

  // Create subtasks table if it doesn't exist (for existing DBs)
  db.exec(`
    CREATE TABLE IF NOT EXISTS subtasks (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      title TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id)');

  // Add link column to tasks table if it doesn't exist
  const tasksInfo = db.prepare("PRAGMA table_info(tasks)").all();
  const tasksHasLink = tasksInfo.some(col => col.name === 'link');
  if (!tasksHasLink) {
    console.log('Running migration: adding link column to tasks');
    db.exec('ALTER TABLE tasks ADD COLUMN link TEXT');
  }

  // Add sort_order column to tasks table if it doesn't exist
  const hasSortOrder = tasksInfo.some(col => col.name === 'sort_order');
  if (!hasSortOrder) {
    console.log('Running migration: adding sort_order column to tasks');
    db.exec('ALTER TABLE tasks ADD COLUMN sort_order INTEGER DEFAULT 0');
    // Initialize sort_order based on created_at for existing tasks
    db.exec(`
      UPDATE tasks SET sort_order = (
        SELECT COUNT(*) FROM tasks t2 WHERE t2.created_at > tasks.created_at
      )
    `);
  }
}

/**
 * Get the database instance, initializing if needed
 */
function getDb() {
  if (!db) {
    initDatabase();
  }
  return db;
}

/**
 * Close the database connection
 */
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

// ============================================
// TASKS CRUD
// ============================================

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function getAllTasks() {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  return db.prepare(`
    SELECT id, title, notes, link, category, status, due_date as dueDate, 
           is_sync_priority as isSyncPriority, sort_order as sortOrder, created_at as createdAt, 
           completed_at as completedAt, source
    FROM tasks
    WHERE due_date IS NULL OR due_date <= ?
    ORDER BY sort_order ASC, created_at DESC
  `).all(today);
}

function getTaskById(id) {
  const db = getDb();
  return db.prepare(`
    SELECT id, title, notes, link, category, status, due_date as dueDate,
           is_sync_priority as isSyncPriority, sort_order as sortOrder, created_at as createdAt,
           completed_at as completedAt, source
    FROM tasks WHERE id = ?
  `).get(id);
}

function getActiveTasks() {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  return db.prepare(`
    SELECT id, title, notes, link, category, status, due_date as dueDate,
           is_sync_priority as isSyncPriority, sort_order as sortOrder, created_at as createdAt,
           completed_at as completedAt, source
    FROM tasks
    WHERE status != 'done'
      AND (due_date IS NULL OR due_date <= ?)
    ORDER BY sort_order ASC, created_at DESC
  `).all(today);
}

function getCompletedTasks() {
  const db = getDb();
  return db.prepare(`
    SELECT id, title, notes, link, category, status, due_date as dueDate,
           is_sync_priority as isSyncPriority, sort_order as sortOrder, created_at as createdAt,
           completed_at as completedAt, source
    FROM tasks
    WHERE status = 'done'
    ORDER BY completed_at DESC
  `).all();
}

function createTask(task) {
  const db = getDb();
  const id = task.id || generateId();
  const now = new Date().toISOString();
  
  // Get max sort_order and add 1 for new task (puts it at the end)
  const maxOrder = db.prepare('SELECT MAX(sort_order) as maxOrder FROM tasks WHERE status != ?').get('done');
  const sortOrder = task.sortOrder !== undefined ? task.sortOrder : ((maxOrder?.maxOrder || 0) + 1);
  
  const stmt = db.prepare(`
    INSERT INTO tasks (id, title, notes, link, category, status, due_date, is_sync_priority, sort_order, created_at, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    id,
    task.title,
    task.notes || null,
    task.link || null,
    task.category,
    task.status || 'todo',
    task.dueDate || null,
    task.isSyncPriority ? 1 : 0,
    sortOrder,
    task.createdAt || now,
    task.source || 'local',
  );
  
  return getTaskById(id);
}

function updateTask(id, updates) {
  const db = getDb();
  const existing = getTaskById(id);
  if (!existing) return null;
  
  const fields = [];
  const values = [];
  
  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.notes !== undefined) {
    fields.push('notes = ?');
    values.push(updates.notes);
  }
  if (updates.link !== undefined) {
    fields.push('link = ?');
    values.push(updates.link);
  }
  if (updates.category !== undefined) {
    fields.push('category = ?');
    values.push(updates.category);
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
    if (updates.status === 'done' && !updates.completedAt) {
      fields.push('completed_at = ?');
      values.push(new Date().toISOString());
    } else if (updates.status !== 'done') {
      fields.push('completed_at = ?');
      values.push(null);
    }
  }
  if (updates.dueDate !== undefined) {
    fields.push('due_date = ?');
    values.push(updates.dueDate);
  }
  if (updates.isSyncPriority !== undefined) {
    fields.push('is_sync_priority = ?');
    values.push(updates.isSyncPriority ? 1 : 0);
  }
  if (updates.sortOrder !== undefined) {
    fields.push('sort_order = ?');
    values.push(updates.sortOrder);
  }
  if (updates.completedAt !== undefined) {
    fields.push('completed_at = ?');
    values.push(updates.completedAt);
  }
  
  if (fields.length === 0) return existing;
  
  values.push(id);
  db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  
  return getTaskById(id);
}

/**
 * Reorder tasks by providing an array of task IDs in the desired order
 * This updates the sort_order for all provided tasks
 */
function reorderTasks(taskIds) {
  const db = getDb();
  const stmt = db.prepare('UPDATE tasks SET sort_order = ? WHERE id = ?');
  
  const updateMany = db.transaction((ids) => {
    for (let i = 0; i < ids.length; i++) {
      stmt.run(i, ids[i]);
    }
  });
  
  updateMany(taskIds);
  return true;
}

function deleteTask(id) {
  const db = getDb();
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  return result.changes > 0;
}

function toggleTask(id) {
  const db = getDb();
  const task = getTaskById(id);
  if (!task) return null;
  
  const newStatus = task.status === 'done' ? 'todo' : 'done';
  const completedAt = newStatus === 'done' ? new Date().toISOString() : null;
  
  db.prepare('UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?')
    .run(newStatus, completedAt, id);
  
  return getTaskById(id);
}

function setSyncPriority(taskId) {
  const db = getDb();
  // Clear existing sync priority
  db.prepare('UPDATE tasks SET is_sync_priority = 0 WHERE is_sync_priority = 1').run();
  
  if (taskId) {
    db.prepare('UPDATE tasks SET is_sync_priority = 1 WHERE id = ?').run(taskId);
  }
  
  return getTaskById(taskId);
}

function getSyncPriority() {
  const db = getDb();
  return db.prepare(`
    SELECT id, title, notes, category, status, due_date as dueDate,
           is_sync_priority as isSyncPriority, created_at as createdAt,
           completed_at as completedAt, source
    FROM tasks
    WHERE is_sync_priority = 1
  `).get() || null;
}

// ============================================
// MEETINGS CRUD
// ============================================

function getAllMeetings() {
  const db = getDb();
  return db.prepare(`
    SELECT id, title, date, time, category, done, notes, link
    FROM meetings
    ORDER BY date ASC, time ASC
  `).all().map(m => ({ ...m, done: Boolean(m.done) }));
}

function getTodayMeetings() {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  return db.prepare(`
    SELECT id, title, date, time, category, done, notes, link
    FROM meetings
    WHERE date = ?
    ORDER BY time ASC
  `).all(today).map(m => ({ ...m, done: Boolean(m.done) }));
}

function getMeetingsByDate(dateString) {
  const db = getDb();
  return db.prepare(`
    SELECT id, title, date, time, category, done, notes, link
    FROM meetings
    WHERE date = ?
    ORDER BY time ASC
  `).all(dateString).map(m => ({ ...m, done: Boolean(m.done) }));
}

function createMeeting(meeting) {
  const db = getDb();
  const id = meeting.id || generateId();
  const source = meeting.source || 'local';
  const externalId = meeting.externalId || null;
  
  db.prepare(`
    INSERT INTO meetings (id, title, date, time, category, done, notes, link, source, external_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, meeting.title, meeting.date, meeting.time, meeting.category, meeting.done ? 1 : 0, meeting.notes || null, meeting.link || null, source, externalId);
  
  return { id, title: meeting.title, date: meeting.date, time: meeting.time, category: meeting.category, done: Boolean(meeting.done), notes: meeting.notes, link: meeting.link, source, externalId };
}

function updateMeeting(id, updates) {
  const db = getDb();
  const fields = [];
  const values = [];
  
  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.date !== undefined) {
    fields.push('date = ?');
    values.push(updates.date);
  }
  if (updates.time !== undefined) {
    fields.push('time = ?');
    values.push(updates.time);
  }
  if (updates.category !== undefined) {
    fields.push('category = ?');
    values.push(updates.category);
  }
  if (updates.done !== undefined) {
    fields.push('done = ?');
    values.push(updates.done ? 1 : 0);
  }
  if (updates.notes !== undefined) {
    fields.push('notes = ?');
    values.push(updates.notes);
  }
  if (updates.link !== undefined) {
    fields.push('link = ?');
    values.push(updates.link);
  }
  
  if (fields.length === 0) return null;
  
  values.push(id);
  db.prepare(`UPDATE meetings SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  
  const result = db.prepare('SELECT id, title, date, time, category, done, notes, link FROM meetings WHERE id = ?').get(id);
  return result ? { ...result, done: Boolean(result.done) } : null;
}

function deleteMeeting(id) {
  const db = getDb();
  const result = db.prepare('DELETE FROM meetings WHERE id = ?').run(id);
  return result.changes > 0;
}

function toggleMeeting(id) {
  const db = getDb();
  const meeting = db.prepare('SELECT done FROM meetings WHERE id = ?').get(id);
  if (!meeting) return null;
  
  db.prepare('UPDATE meetings SET done = ? WHERE id = ?').run(meeting.done ? 0 : 1, id);
  
  const result = db.prepare('SELECT id, title, date, time, category, done, notes, link FROM meetings WHERE id = ?').get(id);
  return result ? { ...result, done: Boolean(result.done) } : null;
}

// ============================================
// BLOCKED MEETING PATTERNS
// ============================================

function getBlockedMeetingPatterns() {
  const db = getDb();
  return db.prepare(`
    SELECT id, pattern, is_regex as isRegex, created_at as createdAt
    FROM blocked_meeting_patterns
    ORDER BY created_at DESC
  `).all().map(p => ({ ...p, isRegex: Boolean(p.isRegex) }));
}

function addBlockedMeetingPattern(pattern, isRegex = false) {
  const db = getDb();
  const id = generateId();
  
  db.prepare(`
    INSERT INTO blocked_meeting_patterns (id, pattern, is_regex)
    VALUES (?, ?, ?)
  `).run(id, pattern, isRegex ? 1 : 0);
  
  return { id, pattern, isRegex };
}

function removeBlockedMeetingPattern(id) {
  const db = getDb();
  const result = db.prepare('DELETE FROM blocked_meeting_patterns WHERE id = ?').run(id);
  return result.changes > 0;
}

function getMeetingByExternalId(externalId) {
  const db = getDb();
  return db.prepare(`
    SELECT id, title, date, time, category, done, notes, link, source, external_id as externalId
    FROM meetings
    WHERE external_id = ?
  `).get(externalId);
}

function getMeetingsBySource(source) {
  const db = getDb();
  return db.prepare(`
    SELECT id, title, date, time, category, done, notes, link, source, external_id as externalId
    FROM meetings
    WHERE source = ?
    ORDER BY date ASC, time ASC
  `).all().map(m => ({ ...m, done: Boolean(m.done) }));
}

// ============================================
// DAILY LOGS CRUD (Extended for Rituals)
// ============================================

function getDailyLog(date) {
  const db = getDb();
  const row = db.prepare(`
    SELECT id, date, 
           morning_ritual_completed as morningRitualCompleted,
           morning_ritual_time as morningRitualTime,
           intention,
           sync_priority_id as syncPriorityId,
           evening_ritual_completed as eveningRitualCompleted,
           evening_ritual_time as eveningRitualTime,
           reflection,
           gratitude,
           untracked_wins as untrackedWins,
           energy_level as energyLevel,
           tasks_completed as tasksCompleted,
           tasks_created as tasksCreated,
           focus_achieved as focusAchieved,
           morning_intention as morningIntention,
           evening_reflection as eveningReflection,
           meetings,
           created_at as createdAt,
           updated_at as updatedAt
    FROM daily_logs
    WHERE date = ?
  `).get(date);
  
  if (!row) return null;
  
  return {
    ...row,
    morningRitualCompleted: Boolean(row.morningRitualCompleted),
    eveningRitualCompleted: Boolean(row.eveningRitualCompleted),
    focusAchieved: Boolean(row.focusAchieved),
  };
}

function getTodayLog() {
  const today = new Date().toISOString().split('T')[0];
  return getDailyLog(today);
}

function createOrUpdateDailyLog(date, updates) {
  const db = getDb();
  const existing = getDailyLog(date);
  const now = new Date().toISOString();
  
  if (existing) {
    const fields = ['updated_at = ?'];
    const values = [now];
    
    // Legacy fields (for compatibility)
    if (updates.syncPriorityId !== undefined) {
      fields.push('sync_priority_id = ?');
      values.push(updates.syncPriorityId);
    }
    if (updates.morningIntention !== undefined) {
      fields.push('morning_intention = ?');
      values.push(updates.morningIntention);
    }
    if (updates.eveningReflection !== undefined) {
      fields.push('evening_reflection = ?');
      values.push(updates.eveningReflection);
    }
    if (updates.meetings !== undefined) {
      fields.push('meetings = ?');
      values.push(updates.meetings);
    }
    
    // New ritual fields
    if (updates.morningRitualCompleted !== undefined) {
      fields.push('morning_ritual_completed = ?');
      values.push(updates.morningRitualCompleted ? 1 : 0);
    }
    if (updates.morningRitualTime !== undefined) {
      fields.push('morning_ritual_time = ?');
      values.push(updates.morningRitualTime);
    }
    if (updates.intention !== undefined) {
      fields.push('intention = ?');
      values.push(updates.intention);
    }
    if (updates.eveningRitualCompleted !== undefined) {
      fields.push('evening_ritual_completed = ?');
      values.push(updates.eveningRitualCompleted ? 1 : 0);
    }
    if (updates.eveningRitualTime !== undefined) {
      fields.push('evening_ritual_time = ?');
      values.push(updates.eveningRitualTime);
    }
    if (updates.reflection !== undefined) {
      fields.push('reflection = ?');
      values.push(updates.reflection);
    }
    if (updates.gratitude !== undefined) {
      fields.push('gratitude = ?');
      values.push(updates.gratitude);
    }
    if (updates.untrackedWins !== undefined) {
      fields.push('untracked_wins = ?');
      values.push(updates.untrackedWins);
    }
    if (updates.energyLevel !== undefined) {
      fields.push('energy_level = ?');
      values.push(updates.energyLevel);
    }
    if (updates.tasksCompleted !== undefined) {
      fields.push('tasks_completed = ?');
      values.push(updates.tasksCompleted);
    }
    if (updates.tasksCreated !== undefined) {
      fields.push('tasks_created = ?');
      values.push(updates.tasksCreated);
    }
    if (updates.focusAchieved !== undefined) {
      fields.push('focus_achieved = ?');
      values.push(updates.focusAchieved ? 1 : 0);
    }
    
    values.push(date);
    db.prepare(`UPDATE daily_logs SET ${fields.join(', ')} WHERE date = ?`).run(...values);
  } else {
    const id = generateId();
    db.prepare(`
      INSERT INTO daily_logs (
        id, date, sync_priority_id, morning_intention, evening_reflection, meetings, energy_level,
        morning_ritual_completed, morning_ritual_time, intention,
        evening_ritual_completed, evening_ritual_time, reflection, gratitude, untracked_wins,
        tasks_completed, tasks_created, focus_achieved, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      date,
      updates.syncPriorityId || null,
      updates.morningIntention || null,
      updates.eveningReflection || null,
      updates.meetings || null,
      updates.energyLevel || null,
      updates.morningRitualCompleted ? 1 : 0,
      updates.morningRitualTime || null,
      updates.intention || null,
      updates.eveningRitualCompleted ? 1 : 0,
      updates.eveningRitualTime || null,
      updates.reflection || null,
      updates.gratitude || null,
      updates.untrackedWins || null,
      updates.tasksCompleted || 0,
      updates.tasksCreated || 0,
      updates.focusAchieved ? 1 : 0,
      now,
      now
    );
  }
  
  return getDailyLog(date);
}

/**
 * Get daily logs for a date range
 */
function getDailyLogs(startDate, endDate) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, date, 
           morning_ritual_completed as morningRitualCompleted,
           morning_ritual_time as morningRitualTime,
           intention,
           sync_priority_id as syncPriorityId,
           evening_ritual_completed as eveningRitualCompleted,
           evening_ritual_time as eveningRitualTime,
           reflection,
           gratitude,
           untracked_wins as untrackedWins,
           energy_level as energyLevel,
           tasks_completed as tasksCompleted,
           tasks_created as tasksCreated,
           focus_achieved as focusAchieved,
           created_at as createdAt,
           updated_at as updatedAt
    FROM daily_logs
    WHERE date >= ? AND date <= ?
    ORDER BY date DESC
  `).all(startDate, endDate);
  
  return rows.map(row => ({
    ...row,
    morningRitualCompleted: Boolean(row.morningRitualCompleted),
    eveningRitualCompleted: Boolean(row.eveningRitualCompleted),
    focusAchieved: Boolean(row.focusAchieved),
  }));
}

// ============================================
// STREAKS
// ============================================

/**
 * Get a streak by type
 */
function getStreak(streakType) {
  const db = getDb();
  return db.prepare(`
    SELECT id, streak_type as streakType, current_count as currentCount, 
           best_count as bestCount, last_date as lastDate, updated_at as updatedAt
    FROM streaks
    WHERE streak_type = ?
  `).get(streakType);
}

/**
 * Get all streaks
 */
function getAllStreaks() {
  const db = getDb();
  return db.prepare(`
    SELECT id, streak_type as streakType, current_count as currentCount, 
           best_count as bestCount, last_date as lastDate, updated_at as updatedAt
    FROM streaks
  `).all();
}

/**
 * Update a streak (increment or reset based on date)
 */
function updateStreak(streakType, date) {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = getStreak(streakType);
  
  if (!existing) {
    // Create new streak
    const id = generateId();
    db.prepare(`
      INSERT INTO streaks (id, streak_type, current_count, best_count, last_date, updated_at)
      VALUES (?, ?, 1, 1, ?, ?)
    `).run(id, streakType, date, now);
    return getStreak(streakType);
  }
  
  // Check if this is consecutive
  const lastDate = existing.lastDate;
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  if (lastDate === date) {
    // Already recorded for today
    return existing;
  } else if (lastDate === yesterdayStr) {
    // Consecutive day - increment streak
    const newCount = existing.currentCount + 1;
    const newBest = Math.max(newCount, existing.bestCount);
    db.prepare(`
      UPDATE streaks 
      SET current_count = ?, best_count = ?, last_date = ?, updated_at = ?
      WHERE streak_type = ?
    `).run(newCount, newBest, date, now, streakType);
  } else {
    // Streak broken - reset to 1
    db.prepare(`
      UPDATE streaks 
      SET current_count = 1, last_date = ?, updated_at = ?
      WHERE streak_type = ?
    `).run(date, now, streakType);
  }
  
  return getStreak(streakType);
}

// ============================================
// WEEKLY METRICS
// ============================================

/**
 * Get weekly metrics for a specific year and week
 */
function getWeeklyMetrics(year, week) {
  const db = getDb();
  return db.prepare(`
    SELECT id, year, week, tasks_completed as tasksCompleted, tasks_created as tasksCreated,
           focus_days as focusDays, morning_rituals as morningRituals, evening_rituals as eveningRituals,
           avg_energy as avgEnergy, goals_completed as goalsCompleted, goals_progress_avg as goalsProgressAvg,
           prs_merged as prsMerged, prs_reviewed as prsReviewed, inbox_processed as inboxProcessed,
           avg_inbox_time_minutes as avgInboxTimeMinutes, computed_at as computedAt
    FROM weekly_metrics
    WHERE year = ? AND week = ?
  `).get(year, week);
}

/**
 * Get weekly metrics for the last N weeks
 */
function getRecentWeeklyMetrics(numWeeks = 4) {
  const db = getDb();
  return db.prepare(`
    SELECT id, year, week, tasks_completed as tasksCompleted, tasks_created as tasksCreated,
           focus_days as focusDays, morning_rituals as morningRituals, evening_rituals as eveningRituals,
           avg_energy as avgEnergy, goals_completed as goalsCompleted, goals_progress_avg as goalsProgressAvg,
           prs_merged as prsMerged, prs_reviewed as prsReviewed, inbox_processed as inboxProcessed,
           avg_inbox_time_minutes as avgInboxTimeMinutes, computed_at as computedAt
    FROM weekly_metrics
    ORDER BY year DESC, week DESC
    LIMIT ?
  `).all(numWeeks);
}

/**
 * Compute and save weekly metrics from daily logs
 */
function computeWeeklyMetrics(year, week) {
  const db = getDb();
  const now = new Date().toISOString();
  
  // Get the date range for the week
  const startDate = getDateFromWeek(year, week, 1); // Monday
  const endDate = getDateFromWeek(year, week, 7); // Sunday
  
  // Aggregate daily logs for the week
  const dailyLogs = getDailyLogs(startDate, endDate);
  
  const metrics = {
    tasksCompleted: dailyLogs.reduce((sum, log) => sum + (log.tasksCompleted || 0), 0),
    tasksCreated: dailyLogs.reduce((sum, log) => sum + (log.tasksCreated || 0), 0),
    focusDays: dailyLogs.filter(log => log.focusAchieved).length,
    morningRituals: dailyLogs.filter(log => log.morningRitualCompleted).length,
    eveningRituals: dailyLogs.filter(log => log.eveningRitualCompleted).length,
    avgEnergy: calculateAverage(dailyLogs.filter(log => log.energyLevel).map(log => log.energyLevel)),
  };
  
  const id = generateId();
  db.prepare(`
    INSERT INTO weekly_metrics (id, year, week, tasks_completed, tasks_created, focus_days,
                                morning_rituals, evening_rituals, avg_energy, computed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(year, week) DO UPDATE SET
      tasks_completed = excluded.tasks_completed,
      tasks_created = excluded.tasks_created,
      focus_days = excluded.focus_days,
      morning_rituals = excluded.morning_rituals,
      evening_rituals = excluded.evening_rituals,
      avg_energy = excluded.avg_energy,
      computed_at = excluded.computed_at
  `).run(id, year, week, metrics.tasksCompleted, metrics.tasksCreated, metrics.focusDays,
         metrics.morningRituals, metrics.eveningRituals, metrics.avgEnergy, now);
  
  return getWeeklyMetrics(year, week);
}

// Helper: Get date string from year, week, day (1=Monday, 7=Sunday)
function getDateFromWeek(year, week, dayOfWeek) {
  const jan1 = new Date(year, 0, 1);
  const daysToFirstMonday = (8 - jan1.getDay()) % 7;
  const firstMonday = new Date(year, 0, 1 + daysToFirstMonday);
  const targetDate = new Date(firstMonday);
  targetDate.setDate(firstMonday.getDate() + (week - 1) * 7 + (dayOfWeek - 1));
  return targetDate.toISOString().split('T')[0];
}

// Helper: Calculate average
function calculateAverage(numbers) {
  if (!numbers.length) return null;
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

// ============================================
// SUBTASKS CRUD
// ============================================

/**
 * Get all subtasks for a task
 */
function getSubtasksForTask(taskId) {
  const db = getDb();
  return db.prepare(`
    SELECT id, task_id as taskId, title, completed, sort_order as sortOrder,
           created_at as createdAt, completed_at as completedAt
    FROM subtasks
    WHERE task_id = ?
    ORDER BY sort_order ASC, created_at ASC
  `).all(taskId);
}

/**
 * Get a single subtask by ID
 */
function getSubtaskById(id) {
  const db = getDb();
  return db.prepare(`
    SELECT id, task_id as taskId, title, completed, sort_order as sortOrder,
           created_at as createdAt, completed_at as completedAt
    FROM subtasks
    WHERE id = ?
  `).get(id);
}

/**
 * Create a new subtask
 */
function createSubtask(taskId, title) {
  const db = getDb();
  const id = generateId();
  const now = new Date().toISOString();
  
  // Get the max sort_order for this task
  const maxOrder = db.prepare(`
    SELECT COALESCE(MAX(sort_order), -1) as maxOrder FROM subtasks WHERE task_id = ?
  `).get(taskId).maxOrder;
  
  db.prepare(`
    INSERT INTO subtasks (id, task_id, title, sort_order, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, taskId, title, maxOrder + 1, now);
  
  return getSubtaskById(id);
}

/**
 * Update a subtask's title
 */
function updateSubtask(id, title) {
  const db = getDb();
  db.prepare(`
    UPDATE subtasks SET title = ? WHERE id = ?
  `).run(title, id);
  return getSubtaskById(id);
}

/**
 * Toggle a subtask's completed status
 */
function toggleSubtask(id) {
  const db = getDb();
  const subtask = getSubtaskById(id);
  if (!subtask) return null;
  
  const newCompleted = subtask.completed ? 0 : 1;
  const completedAt = newCompleted ? new Date().toISOString() : null;
  
  db.prepare(`
    UPDATE subtasks SET completed = ?, completed_at = ? WHERE id = ?
  `).run(newCompleted, completedAt, id);
  
  return getSubtaskById(id);
}

/**
 * Delete a subtask
 */
function deleteSubtask(id) {
  const db = getDb();
  const result = db.prepare('DELETE FROM subtasks WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Delete all subtasks for a task
 */
function deleteSubtasksForTask(taskId) {
  const db = getDb();
  const result = db.prepare('DELETE FROM subtasks WHERE task_id = ?').run(taskId);
  return result.changes;
}

/**
 * Reorder subtasks for a task
 */
function reorderSubtasks(taskId, subtaskIds) {
  const db = getDb();
  const stmt = db.prepare('UPDATE subtasks SET sort_order = ? WHERE id = ? AND task_id = ?');
  
  const updateMany = db.transaction((ids) => {
    ids.forEach((id, index) => {
      stmt.run(index, id, taskId);
    });
  });
  
  updateMany(subtaskIds);
  return getSubtasksForTask(taskId);
}

/**
 * Get subtask summary for a task (count completed/total)
 */
function getSubtaskSummary(taskId) {
  const db = getDb();
  const result = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed
    FROM subtasks
    WHERE task_id = ?
  `).get(taskId);
  
  return {
    total: result.total || 0,
    completed: result.completed || 0
  };
}

/**
 * Get subtask summaries for multiple tasks at once
 */
function getSubtaskSummaries(taskIds) {
  if (!taskIds || taskIds.length === 0) return {};
  
  const db = getDb();
  const placeholders = taskIds.map(() => '?').join(',');
  const results = db.prepare(`
    SELECT 
      task_id as taskId,
      COUNT(*) as total,
      SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed
    FROM subtasks
    WHERE task_id IN (${placeholders})
    GROUP BY task_id
  `).all(...taskIds);
  
  const summaries = {};
  for (const row of results) {
    summaries[row.taskId] = {
      total: row.total || 0,
      completed: row.completed || 0
    };
  }
  return summaries;
}

// ============================================
// PROJECT ITEMS CRUD
// ============================================

function createProjectItem(input) {
  const db = getDb();
  const id = generateId();
  const now = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO project_items (id, title, status, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, input.title, input.status || 'idea', input.notes || null, now, now);
  
  return getProjectItemById(id);
}

function getProjectItemById(id) {
  const db = getDb();
  return db.prepare(`
    SELECT id, title, status, notes, created_at as createdAt, updated_at as updatedAt
    FROM project_items WHERE id = ?
  `).get(id);
}

function getAllProjectItems(filters = {}) {
  const db = getDb();
  let query = 'SELECT id, title, status, notes, created_at as createdAt, updated_at as updatedAt FROM project_items';
  const params = [];
  
  if (filters.status) {
    query += ' WHERE status = ?';
    params.push(filters.status);
  }
  
  query += ' ORDER BY created_at DESC';
  
  return db.prepare(query).all(...params);
}

function updateProjectItem(id, updates) {
  const db = getDb();
  const now = new Date().toISOString();
  const fields = [];
  const values = [];
  
  if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
  if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
  if (updates.notes !== undefined) { fields.push('notes = ?'); values.push(updates.notes); }
  
  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);
  
  db.prepare(`UPDATE project_items SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  
  return getProjectItemById(id);
}

function deleteProjectItem(id) {
  const db = getDb();
  const result = db.prepare('DELETE FROM project_items WHERE id = ?').run(id);
  return result.changes > 0;
}

// ============================================
// SEED DATA (for initial setup)
// ============================================

function seedInitialData() {
  const db = getDb();
  
  // Check if there are any tasks
  const taskCount = db.prepare('SELECT COUNT(*) as count FROM tasks').get().count;
  
  if (taskCount === 0) {
    const now = new Date().toISOString();
    const today = new Date().toISOString().split('T')[0];
    
    // Seed some initial tasks
    const initialTasks = [
      { title: 'Review PR for authentication changes', category: 'work', status: 'todo' },
      { title: 'Update documentation for API endpoints', category: 'work', status: 'in-progress' },
      { title: 'Grocery shopping', category: 'home', status: 'todo' },
      { title: 'Work on side project feature', category: 'side-project', status: 'todo' },
    ];
    
    const insertTask = db.prepare(`
      INSERT INTO tasks (id, title, category, status, created_at, source)
      VALUES (?, ?, ?, ?, ?, 'local')
    `);
    
    for (const task of initialTasks) {
      insertTask.run(generateId(), task.title, task.category, task.status, now);
    }
    
    // Seed some initial meetings for today
    const initialMeetings = [
      { title: 'Team standup', date: today, time: '09:30' },
      { title: '1:1 with manager', date: today, time: '14:00' },
    ];
    
    const insertMeeting = db.prepare(`
      INSERT INTO meetings (id, title, date, time, category, done)
      VALUES (?, ?, ?, ?, 'work', 0)
    `);
    
    for (const meeting of initialMeetings) {
      insertMeeting.run(generateId(), meeting.title, meeting.date, meeting.time);
    }
    
    console.log('Seeded initial data');
  }
}

// ============================================
// DATABASE PATH
// ============================================

function getDatabasePath() {
  return DB_PATH;
}

module.exports = {
  initDatabase,
  getDb,
  closeDatabase,
  getDatabasePath,
  
  // Tasks
  getAllTasks,
  getTaskById,
  getActiveTasks,
  getCompletedTasks,
  createTask,
  updateTask,
  deleteTask,
  toggleTask,
  reorderTasks,
  setSyncPriority,
  getSyncPriority,
  
  // Meetings
  getAllMeetings,
  getTodayMeetings,
  getMeetingsByDate,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  toggleMeeting,
  getMeetingByExternalId,
  getMeetingsBySource,
  
  // Blocked meeting patterns
  getBlockedMeetingPatterns,
  addBlockedMeetingPattern,
  removeBlockedMeetingPattern,
  
  // Daily logs
  getDailyLog,
  getTodayLog,
  createOrUpdateDailyLog,
  
  // Subtasks
  getSubtasksForTask,
  getSubtaskById,
  createSubtask,
  updateSubtask,
  toggleSubtask,
  deleteSubtask,
  deleteSubtasksForTask,
  reorderSubtasks,
  getSubtaskSummary,
  getSubtaskSummaries,
  
  // Daily Rituals
  getDailyLog,
  createOrUpdateDailyLog,
  getDailyLogs,
  
  // Streaks
  getStreak,
  getAllStreaks,
  updateStreak,
  
  // Weekly Metrics
  getWeeklyMetrics,
  getRecentWeeklyMetrics,
  computeWeeklyMetrics,
  
  // Project items
  createProjectItem,
  getProjectItemById,
  getAllProjectItems,
  updateProjectItem,
  deleteProjectItem,
  
  // Setup
  seedInitialData,
};
