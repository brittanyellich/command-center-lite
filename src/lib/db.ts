/**
 * Typed database access for the React frontend
 * 
 * This module provides type-safe access to the SQLite database via Electron IPC.
 * When running in a browser (without Electron), these functions return mock data.
 */

import { isElectron } from './electron'
import type { Task, Meeting, DailyLog, ProjectItem, ProjectStatus } from '../types'

// Database API type definition
interface DatabaseAPI {
  getPath: () => Promise<string>
  tasks: {
    getAll: () => Promise<Task[]>
    getById: (id: string) => Promise<Task | null>
    getActive: () => Promise<Task[]>
    getCompleted: () => Promise<Task[]>
    create: (task: Omit<Task, 'id' | 'createdAt'>) => Promise<Task>
    update: (id: string, updates: Partial<Task>) => Promise<Task | null>
    delete: (id: string) => Promise<boolean>
    toggle: (id: string) => Promise<Task | null>
    setSyncPriority: (taskId: string | null) => Promise<Task | null>
    getSyncPriority: () => Promise<Task | null>
  }
  meetings: {
    getAll: () => Promise<Meeting[]>
    getToday: () => Promise<Meeting[]>
    create: (meeting: Omit<Meeting, 'id'>) => Promise<Meeting>
    update: (id: string, updates: Partial<Meeting>) => Promise<Meeting | null>
    delete: (id: string) => Promise<boolean>
    toggle: (id: string) => Promise<Meeting | null>
  }
  dailyLogs: {
    get: (date: string) => Promise<DailyLog | null>
    getToday: () => Promise<DailyLog | null>
    upsert: (date: string, updates: Partial<DailyLog>) => Promise<DailyLog>
  }
  sync?: {
    getStatus: (source: string) => Promise<SyncStatus | null>
    updateStatus: (source: string, status: string, error?: string) => Promise<SyncStatus>
  }
  projects: {
    create: (input: { title: string; status?: ProjectStatus; notes?: string }) => Promise<ProjectItem>
    getById: (id: string) => Promise<ProjectItem | null>
    getAll: (filters?: { status?: ProjectStatus }) => Promise<ProjectItem[]>
    update: (id: string, updates: Partial<Pick<ProjectItem, 'title' | 'status' | 'notes'>>) => Promise<ProjectItem | null>
    delete: (id: string) => Promise<boolean>
  }
}

interface SyncStatus {
  source: string
  lastSync: string
  status: string
  error: string | null
}

// Helper to get the database API
function getDbApi(): DatabaseAPI | null {
  if (!isElectron() || !window.electronAPI?.db) {
    return null
  }
  return window.electronAPI.db as DatabaseAPI
}

// ============================================
// TASKS
// ============================================

export const tasks = {
  async getAll(): Promise<Task[]> {
    const db = getDbApi()
    if (!db) return []
    return db.tasks.getAll()
  },

  async getById(id: string): Promise<Task | null> {
    const db = getDbApi()
    if (!db) return null
    return db.tasks.getById(id)
  },

  async getActive(): Promise<Task[]> {
    const db = getDbApi()
    if (!db) return []
    return db.tasks.getActive()
  },

  async getCompleted(): Promise<Task[]> {
    const db = getDbApi()
    if (!db) return []
    return db.tasks.getCompleted()
  },

  async create(task: Omit<Task, 'id' | 'createdAt'>): Promise<Task | null> {
    const db = getDbApi()
    if (!db) return null
    return db.tasks.create(task)
  },

  async update(id: string, updates: Partial<Task>): Promise<Task | null> {
    const db = getDbApi()
    if (!db) return null
    return db.tasks.update(id, updates)
  },

  async delete(id: string): Promise<boolean> {
    const db = getDbApi()
    if (!db) return false
    return db.tasks.delete(id)
  },

  async toggle(id: string): Promise<Task | null> {
    const db = getDbApi()
    if (!db) return null
    return db.tasks.toggle(id)
  },

  async setSyncPriority(taskId: string | null): Promise<Task | null> {
    const db = getDbApi()
    if (!db) return null
    return db.tasks.setSyncPriority(taskId)
  },

  async getSyncPriority(): Promise<Task | null> {
    const db = getDbApi()
    if (!db) return null
    return db.tasks.getSyncPriority()
  },
}

// ============================================
// MEETINGS
// ============================================

export const meetings = {
  async getAll(): Promise<Meeting[]> {
    const db = getDbApi()
    if (!db) return []
    return db.meetings.getAll()
  },

  async getToday(): Promise<Meeting[]> {
    const db = getDbApi()
    if (!db) return []
    return db.meetings.getToday()
  },

  async create(meeting: Omit<Meeting, 'id'>): Promise<Meeting | null> {
    const db = getDbApi()
    if (!db) return null
    return db.meetings.create(meeting)
  },

  async update(id: string, updates: Partial<Meeting>): Promise<Meeting | null> {
    const db = getDbApi()
    if (!db) return null
    return db.meetings.update(id, updates)
  },

  async delete(id: string): Promise<boolean> {
    const db = getDbApi()
    if (!db) return false
    return db.meetings.delete(id)
  },

  async toggle(id: string): Promise<Meeting | null> {
    const db = getDbApi()
    if (!db) return null
    return db.meetings.toggle(id)
  },
}

// ============================================
// DAILY LOGS
// ============================================

export const dailyLogs = {
  async get(date: string): Promise<DailyLog | null> {
    const db = getDbApi()
    if (!db) return null
    return db.dailyLogs.get(date)
  },

  async getToday(): Promise<DailyLog | null> {
    const db = getDbApi()
    if (!db) return null
    return db.dailyLogs.getToday()
  },

  async upsert(date: string, updates: Partial<DailyLog>): Promise<DailyLog | null> {
    const db = getDbApi()
    if (!db) return null
    return db.dailyLogs.upsert(date, updates)
  },
}

// ============================================
// SYNC STATUS
// ============================================

export const sync = {
  async getStatus(source: string): Promise<SyncStatus | null> {
    const db = getDbApi()
    if (!db || !db.sync) return null
    return db.sync.getStatus(source)
  },

  async updateStatus(source: string, status: string, error?: string): Promise<SyncStatus | null> {
    const db = getDbApi()
    if (!db || !db.sync) return null
    return db.sync.updateStatus(source, status, error)
  },
}

// ============================================
// PROJECTS
// ============================================

export const projects = {
  async getAll(filters?: { status?: ProjectStatus }): Promise<ProjectItem[]> {
    const db = getDbApi()
    if (!db) return []
    return db.projects.getAll(filters)
  },

  async getById(id: string): Promise<ProjectItem | null> {
    const db = getDbApi()
    if (!db) return null
    return db.projects.getById(id)
  },

  async create(input: { title: string; status?: ProjectStatus; notes?: string }): Promise<ProjectItem | null> {
    const db = getDbApi()
    if (!db) return null
    return db.projects.create(input)
  },

  async update(id: string, updates: Partial<Pick<ProjectItem, 'title' | 'status' | 'notes'>>): Promise<ProjectItem | null> {
    const db = getDbApi()
    if (!db) return null
    return db.projects.update(id, updates)
  },

  async delete(id: string): Promise<boolean> {
    const db = getDbApi()
    if (!db) return false
    return db.projects.delete(id)
  },
}

// ============================================
// DATABASE INFO
// ============================================

export async function getDatabasePath(): Promise<string> {
  const db = getDbApi()
  if (!db) return ''
  return db.getPath()
}

/**
 * Check if database is available
 */
export function isDatabaseAvailable(): boolean {
  return isElectron() && window.electronAPI?.db !== undefined
}
