/**
 * Typed helpers for Electron IPC communication
 * 
 * This module provides type-safe access to Electron APIs exposed via the preload script.
 * When running in a browser (without Electron), these functions return safe defaults.
 */

import type { 
  Task, 
  Meeting, 
  DailyLog, 
  Streak,
  WeeklyMetrics,
  Subtask,
  SubtaskSummary,
  ProjectItem,
  ProjectStatus,
} from '../types'

// GitHub types
interface GitHubPR {
  id: string
  number: number
  title: string
  url: string
  repo: string
  repoFullName: string
  createdAt: string
  updatedAt: string
  state?: string
  type: 'review-requested' | 'authored'
}

interface GitHubIssue {
  id: string
  number: number
  title: string
  url: string
  repo: string
  repoFullName: string
  labels: string[]
  createdAt: string
  updatedAt: string
  type: 'assigned'
}

interface GitHubPRDetails {
  number: number
  title: string
  body: string
  url: string
  state: string
  author: string
  createdAt: string
  updatedAt: string
  reviews: unknown[]
  reviewDecision: string | null
  ciStatus: unknown
}

interface GitHubIssueDetails {
  number: number
  title: string
  body: string
  url: string
  state: string
  author: string
  createdAt: string
  updatedAt: string
  labels: string[]
  assignees: string[]
}

interface GitHubAllData {
  prsToReview: GitHubPR[]
  myPRs: GitHubPR[]
  assignedIssues: GitHubIssue[]
  fetchedAt: string
}

// Type definitions for the Electron API exposed in preload.js
export interface ElectronAPI {
  getVersion: () => Promise<string>
  getPlatform: () => Promise<string>
  fs: {
    readFile: (filePath: string) => Promise<string | null>
    writeFile: (filePath: string, data: string) => Promise<boolean>
  }
  db: {
    getPath: () => Promise<string>
    tasks: {
      getAll: () => Promise<Task[]>
      getById: (id: string) => Promise<Task | null>
      getActive: () => Promise<Task[]>
      getCompleted: () => Promise<Task[]>
      create: (task: Omit<Task, 'id' | 'createdAt'>) => Promise<Task>
      update: (id: string, updates: Partial<Task>) => Promise<Task | null>
      delete: (id: string) => Promise<boolean>
      deleteFromCache: (notionId: string) => Promise<boolean>
      toggle: (id: string) => Promise<Task | null>
      setSyncPriority: (taskId: string | null) => Promise<Task | null>
      getSyncPriority: () => Promise<Task | null>
      reorder: (taskIds: string[]) => Promise<void>
    }
    subtasks: {
      getForTask: (taskId: string) => Promise<Subtask[]>
      create: (taskId: string, title: string) => Promise<Subtask>
      update: (id: string, title: string) => Promise<Subtask | null>
      toggle: (id: string) => Promise<Subtask | null>
      delete: (id: string) => Promise<boolean>
      reorder: (taskId: string, subtaskIds: string[]) => Promise<Subtask[]>
      getSummary: (taskId: string) => Promise<SubtaskSummary>
      getSummaries: (taskIds: string[]) => Promise<Record<string, SubtaskSummary>>
    }
    meetings: {
      getAll: () => Promise<Meeting[]>
      getToday: () => Promise<Meeting[]>
      getByDate: (date: string) => Promise<Meeting[]>
      create: (meeting: Omit<Meeting, 'id'>) => Promise<Meeting>
      update: (id: string, updates: Partial<Meeting>) => Promise<Meeting | null>
      delete: (id: string) => Promise<boolean>
      toggle: (id: string) => Promise<Meeting | null>
    }
    dailyLogs: {
      get: (date: string) => Promise<DailyLog | null>
      getToday: () => Promise<DailyLog | null>
      upsert: (date: string, updates: Partial<DailyLog>) => Promise<DailyLog>
      getRange: (startDate: string, endDate: string) => Promise<DailyLog[]>
    }
    streaks: {
      get: (streakType: string) => Promise<Streak | null>
      getAll: () => Promise<Streak[]>
      update: (streakType: string) => Promise<Streak>
    }
    weeklyMetrics: {
      get: (year: number, week: number) => Promise<WeeklyMetrics | null>
      getRecent: (numWeeks?: number) => Promise<WeeklyMetrics[]>
      compute: (year: number, week: number) => Promise<WeeklyMetrics>
    }
    projects: {
      create: (input: { title: string; status?: ProjectStatus; notes?: string }) => Promise<ProjectItem>
      getById: (id: string) => Promise<ProjectItem | null>
      getAll: (filters?: { status?: ProjectStatus }) => Promise<ProjectItem[]>
      update: (id: string, updates: Partial<Pick<ProjectItem, 'title' | 'status' | 'notes'>>) => Promise<ProjectItem | null>
      delete: (id: string) => Promise<boolean>
    }
  }
  openExternal: (url: string) => Promise<void>
  config: {
    get: (key?: string) => Promise<unknown>
    set: (key: string, value: unknown) => Promise<boolean>
    getAll: () => Promise<unknown>
    getPath: () => Promise<string>
  }
  github: {
    isAvailable: () => Promise<boolean>
    fetchPRsToReview: () => Promise<GitHubPR[]>
    fetchMyPRs: () => Promise<GitHubPR[]>
    fetchAssignedIssues: () => Promise<GitHubIssue[]>
    fetchCopilotIssues: () => Promise<GitHubIssue[]>
    fetchAll: () => Promise<GitHubAllData>
    getPRDetails: (repoFullName: string, prNumber: number) => Promise<GitHubPRDetails>
    getIssueDetails: (repoFullName: string, issueNumber: number) => Promise<GitHubIssueDetails>
    openUrl: (url: string) => Promise<void>
  }
  files: {
    readMarkdown: (filePath: string) => Promise<{
      path: string
      name: string
      frontmatter: Record<string, unknown>
      body: string
      modifiedAt: string
    }>
    listMarkdown: (directory: string, recursive?: boolean) => Promise<string[]>
    listProjects: () => Promise<Array<{
      path: string
      name: string
      excerpt: string
      modifiedAt: string
      [key: string]: unknown
    }>>
    listNotes: (subDirectory?: string) => Promise<Array<{
      path: string
      relativePath: string
      name: string
      excerpt: string
      modifiedAt: string
      [key: string]: unknown
    }>>
    search: (directory: string, query: string) => Promise<Array<{
      path: string
      name: string
      title: string
      excerpt: string
      modifiedAt: string
      matchType: 'title' | 'tags' | 'body'
      [key: string]: unknown
    }>>
    searchNotes: (query: string) => Promise<Array<{
      path: string
      name: string
      title: string
      excerpt: string
      modifiedAt: string
      matchType: 'title' | 'tags' | 'body'
      [key: string]: unknown
    }>>
    getStats: (filePath: string) => Promise<{
      path: string
      name: string
      size: number
      createdAt: string
      modifiedAt: string
      isDirectory: boolean
      isFile: boolean
    }>
    directoryExists: (dirPath: string) => Promise<boolean>
    openInEditor: (filePath: string) => Promise<string>
    showInFolder: (filePath: string) => Promise<boolean>
  }
  elevenlabs: {
    isConfigured: () => Promise<boolean>
    textToSpeech: (text: string, options?: { voiceId?: string; modelId?: string }) => Promise<{
      success: boolean
      audio?: string  // base64 encoded audio
      error?: string
    }>
    getVoices: () => Promise<{
      success: boolean
      voices?: Array<{
        voice_id: string
        name: string
        category: string
        labels?: Record<string, string>
      }>
      error?: string
    }>
  }
  workiq: {
    isAvailable: () => Promise<boolean>
    fetchTodaysMeetings: () => Promise<Array<{
      title: string
      date: string
      time: string
      link: string | null
      externalId: string
    }>>
    fetchWeekMeetings: () => Promise<Array<{
      title: string
      date: string
      time: string
      link: string | null
      externalId: string
    }>>
    syncMeetings: () => Promise<{
      success: boolean
      synced: number
      skipped?: number
      blocked?: number
      error?: string
    }>
    syncMeetingsForDate: (dateString: string) => Promise<{
      success: boolean
      synced: number
      skipped?: number
      blocked?: number
      error?: string
    }>
    fetchMeetingsForSelection: (dateString: string) => Promise<{
      success: boolean
      meetings: Array<{
        title: string
        date: string
        time: string
        link: string | null
        externalId: string
        status: 'new' | 'existing' | 'blocked'
        existingId: string | null
        existingTime: string | null
        hasTimeChanged: boolean
      }>
      date: string
      error?: string
    }>
    addSelectedMeetings: (meetings: Array<{
      title: string
      date: string
      time: string
      link: string | null
      externalId: string
    }>) => Promise<{
      success: boolean
      added: number
      updated: number
      error?: string
    }>
    getBlockedPatterns: () => Promise<Array<{
      id: string
      pattern: string
      isRegex: boolean
      createdAt: string
    }>>
    addBlockedPattern: (pattern: string, isRegex?: boolean) => Promise<{
      id: string
      pattern: string
      isRegex: boolean
    }>
    removeBlockedPattern: (id: string) => Promise<boolean>
    blockMeetingByTitle: (title: string) => Promise<{
      id: string
      pattern: string
      isRegex: boolean
    }>
    onSyncComplete: (callback: (data: { syncedCount: number; skippedCount: number; blockedCount: number }) => void) => void
    removeSyncCompleteListener: () => void
  }
  onMainMessage: (callback: (...args: unknown[]) => void) => void
  removeMainMessageListener: () => void
  onInboxRefresh: (callback: () => void) => void
  removeInboxRefreshListener: () => void
}

// Extend Window interface to include electronAPI
declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

/**
 * Check if we're running inside Electron
 */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && window.electronAPI !== undefined
}

/**
 * Get the Electron API (returns undefined if not in Electron)
 */
export function getElectronAPI(): ElectronAPI | undefined {
  if (isElectron()) {
    return window.electronAPI
  }
  return undefined
}

/**
 * Get the app version (from Electron or fallback)
 */
export async function getAppVersion(): Promise<string> {
  if (isElectron()) {
    return window.electronAPI!.getVersion()
  }
  return '0.0.0-web'
}

/**
 * Get the current platform
 */
export async function getPlatform(): Promise<string> {
  if (isElectron()) {
    return window.electronAPI!.getPlatform()
  }
  return 'web'
}

/**
 * File system operations (only available in Electron)
 */
export const fs = {
  /**
   * Read a file from the local file system
   */
  async readFile(filePath: string): Promise<string | null> {
    if (!isElectron()) {
      console.warn('fs.readFile is only available in Electron')
      return null
    }
    return window.electronAPI!.fs.readFile(filePath)
  },

  /**
   * Write data to a file on the local file system
   */
  async writeFile(filePath: string, data: string): Promise<boolean> {
    if (!isElectron()) {
      console.warn('fs.writeFile is only available in Electron')
      return false
    }
    return window.electronAPI!.fs.writeFile(filePath, data)
  },
}

/**
 * Subscribe to messages from the main process
 */
export function onMainMessage(callback: (...args: unknown[]) => void): () => void {
  if (!isElectron()) {
    return () => {} // Return no-op cleanup function
  }
  
  window.electronAPI!.onMainMessage(callback)
  
  // Return cleanup function
  return () => {
    window.electronAPI!.removeMainMessageListener()
  }
}

/**
 * Subscribe to inbox refresh events (triggered by Chrome extension)
 */
export function onInboxRefresh(callback: () => void): () => void {
  if (!isElectron()) {
    return () => {} // Return no-op cleanup function
  }
  
  window.electronAPI!.onInboxRefresh(callback)
  
  // Return cleanup function
  return () => {
    window.electronAPI!.removeInboxRefreshListener()
  }
}
