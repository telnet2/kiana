/**
 * VFS integration types for MemFS
 * Defines interfaces for VFS client and related types
 */

// Minimal VFS client interface for MemFS integration
export interface VFSClient {
  // File operations
  readFile(path: string, encoding?: string): Promise<string | Uint8Array>;
  writeFile(path: string, data: string | Uint8Array, options?: VFSWriteOptions): Promise<void>;
  writeFileText(path: string, text: string, options?: VFSWriteOptions): Promise<void>;
  appendFile(path: string, data: string | Uint8Array, options?: VFSWriteOptions): Promise<void>;
  unlink(path: string): Promise<void>;
  
  // Directory operations
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  readdir(path: string, options?: { withFileTypes?: boolean }): Promise<VFSDirectoryEntry[]>;
  rm(path: string, options?: { recursive?: boolean }): Promise<void>;
  rmdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  
  // File information
  stat(path: string): Promise<VFSFileStats>;
  access(path: string, mode?: number): Promise<void>;
  
  // Path operations
  rename(oldPath: string, newPath: string): Promise<void>;
  copyFile(src: string, dest: string, options?: VFSCopyOptions): Promise<void>;
}

// VFS file statistics
export interface VFSFileStats {
  isFile(): boolean;
  isDirectory(): boolean;
  size: number;
  mtime: Date;
  ctime: Date;
  mode: number;
  version?: number;
  contentType?: string;
  checksum?: string;
  metadata?: Record<string, unknown>;
}

// VFS directory entry
export interface VFSDirectoryEntry {
  name: string;
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
  isBlockDevice(): boolean;
  isCharacterDevice(): boolean;
  isFIFO(): boolean;
  isSocket(): boolean;
}

// VFS write options
export interface VFSWriteOptions {
  encoding?: string;
  contentType?: string;
  expectedVersion?: number;
}

// VFS copy options
export interface VFSCopyOptions {
  overwrite?: boolean;
}

// VFS error
export class VFSError extends Error {
  code?: string;
  statusCode?: number;
  details?: any;

  constructor(message: string, code?: string, statusCode?: number, details?: any) {
    super(message);
    this.name = 'VFSError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

// VFS client factory function type
export type VFSClientFactory = (options: VFSClientOptions) => VFSClient;

// VFS client options
export interface VFSClientOptions {
  baseURL?: string;
  token?: string;
  apiPrefix?: string;
  homeDir?: string;
  timeout?: number;
  retries?: number;
}

// Enhanced VFS client with caching (from CachedVFS)
export interface CachedVFSClient extends VFSClient {
  // Cache management
  setCacheEnabled(enabled: boolean): void;
  isCacheEnabled(): boolean;
  clearCache(): Promise<void>;
  getCacheStatistics(): Promise<VFSCacheStatistics>;
  
  // Cache operations
  invalidateFile(path: string): Promise<boolean>;
  invalidateDirectory(directory: string): Promise<number>;
  warmupCache(patterns: string[], options?: VFSWarmupOptions): Promise<VFSWarmupResult>;
}

// VFS cache statistics
export interface VFSCacheStatistics {
  enabled: boolean;
  totalHits: number;
  totalMisses: number;
  totalReads: number;
  totalWrites: number;
  hitRatio: number;
  filesCached: number;
  totalSize: number;
  avgAccessCount: number;
  hotFiles: Array<{ path: string; accessCount: number }>;
}

// VFS warmup options
export interface VFSWarmupOptions {
  maxConcurrent?: number;
  maxFilesPerPattern?: number;
  includeBinary?: boolean;
}

// VFS warmup result
export interface VFSWarmupResult {
  cached: number;
  errors: string[];
}

// VFS batch operations
export interface VFSBatchClient extends VFSClient {
  batchImport(rootDir: string, csvFile: File): Promise<VFSBatchImportResult>;
  batchImportStream(rootDir: string, csvData: string, onProgress?: VFSProgressCallback): Promise<VFSBatchImportStreamResult>;
}

// VFS batch import result
export interface VFSBatchImportResult {
  created: number;
  errors?: Array<{ path: string; error: string }>;
}

// VFS batch import stream result
export interface VFSBatchImportStreamResult {
  created: number;
  failed: number;
  errors: Array<{ path: string; error: string }>;
}

// VFS progress callback
export type VFSProgressCallback = (event: VFSProgressEvent, progress: VFSProgress) => void;

// VFS progress event
export interface VFSProgressEvent {
  type: 'start' | 'progress' | 'complete' | 'error';
  message: string;
}

// VFS progress
export interface VFSProgress {
  total: number;
  completed: number;
  percentage: number;
  currentFile?: string;
}

// VFS search operations
export interface VFSSearchClient extends VFSClient {
  search(query: VFSSearchQuery): Promise<VFSSearchResult[]>;
  find(pattern: string, options?: VFSFindOptions): Promise<VFSFindResult>;
}

// VFS search query
export interface VFSSearchQuery {
  json_path?: string;
  jq_expression?: string;
  value?: string;
  meta_key?: string;
  meta_value?: string;
  meta_json_path?: string;
  meta_jq_expression?: string;
  type?: 'f' | 'd';
  limit?: number;
}

// VFS search result
export interface VFSSearchResult {
  path: string;
  sizeBytes: number;
  contentType: string;
  metadata?: Record<string, unknown>;
}

// VFS find options
export interface VFSFindOptions {
  since?: Date;
  limit?: number;
  cursor?: string;
}

// VFS find result
export interface VFSFindResult {
  results: VFSFileEntry[];
  next_cursor?: string;
  total?: number;
}

// VFS file entry
export interface VFSFileEntry {
  name: string;
  directory_path: string;
  path: string;
  size: number;
  content_type: string;
  version: number;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}