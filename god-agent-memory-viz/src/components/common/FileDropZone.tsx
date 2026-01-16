/**
 * FileDropZone Component
 *
 * Provides a drag-and-drop interface for uploading SQLite database files.
 * Supports .db, .sqlite, and .sqlite3 file extensions with validation.
 *
 * @module components/common/FileDropZone
 */

import React, { useState, useRef, useCallback } from 'react';
import { cn } from '@/utils/cn';

/**
 * Accepted file extensions for database files
 */
const ACCEPTED_EXTENSIONS = ['.db', '.sqlite', '.sqlite3'];

/**
 * Maximum file size (100MB)
 */
const MAX_FILE_SIZE = 100 * 1024 * 1024;

/**
 * File validation result
 */
interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * FileDropZone props
 */
interface FileDropZoneProps {
  /** Callback when a valid file is selected */
  onFileSelect: (file: File) => void;
  /** Callback when validation fails */
  onError?: (error: string) => void;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Whether a file is currently being processed */
  loading?: boolean;
  /** Additional class names */
  className?: string;
  /** Currently loaded file name for display */
  currentFileName?: string;
}

/**
 * Formats file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * SQLite magic bytes: "SQLite format 3\0"
 */
const SQLITE_MAGIC = 'SQLite format 3';

/**
 * Validates SQLite file by checking magic bytes in header
 */
async function isSQLiteFile(file: File): Promise<boolean> {
  try {
    const header = await file.slice(0, 16).arrayBuffer();
    const view = new Uint8Array(header);
    const magic = String.fromCharCode(...view.slice(0, 15));
    return magic === SQLITE_MAGIC;
  } catch {
    return false;
  }
}

/**
 * Validates a file for database upload (sync validation)
 */
function validateFile(file: File): ValidationResult {
  // Check file extension
  const fileName = file.name.toLowerCase();
  const hasValidExtension = ACCEPTED_EXTENSIONS.some((ext) => fileName.endsWith(ext));

  if (!hasValidExtension) {
    return {
      valid: false,
      error: `Invalid file type. Accepted: ${ACCEPTED_EXTENSIONS.join(', ')}`,
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${formatFileSize(MAX_FILE_SIZE)}`,
    };
  }

  // Check for empty file
  if (file.size === 0) {
    return {
      valid: false,
      error: 'File is empty',
    };
  }

  return { valid: true };
}

/**
 * Validates a file for database upload including SQLite magic bytes check
 */
async function validateFileAsync(file: File): Promise<ValidationResult> {
  // First run sync validations
  const syncResult = validateFile(file);
  if (!syncResult.valid) {
    return syncResult;
  }

  // Check SQLite magic bytes
  const isSQLite = await isSQLiteFile(file);
  if (!isSQLite) {
    return {
      valid: false,
      error: 'File does not appear to be a valid SQLite database',
    };
  }

  return { valid: true };
}

/**
 * FileDropZone component for SQLite database file upload
 */
export function FileDropZone({
  onFileSelect,
  onError,
  disabled = false,
  loading = false,
  className,
  currentFileName,
}: FileDropZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled && !loading) {
        setIsDragActive(true);
      }
    },
    [disabled, loading]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const processFile = useCallback(
    async (file: File) => {
      // Run async validation including SQLite magic bytes check
      const validation = await validateFileAsync(file);

      if (!validation.valid) {
        onError?.(validation.error!);
        return;
      }

      setSelectedFile(file);
      onFileSelect(file);
    },
    [onFileSelect, onError]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      if (disabled || loading) return;

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        processFile(files[0]);
      }
    },
    [disabled, loading, processFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        processFile(files[0]);
      }
      // Reset input to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [processFile]
  );

  const handleClick = useCallback(() => {
    if (!disabled && !loading) {
      fileInputRef.current?.click();
    }
  }, [disabled, loading]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && !disabled && !loading) {
        e.preventDefault();
        fileInputRef.current?.click();
      }
    },
    [disabled, loading]
  );

  const displayFileName = currentFileName ?? selectedFile?.name;

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center',
        'min-h-[200px] p-6 rounded-lg border-2 border-dashed',
        'transition-colors duration-200 cursor-pointer',
        isDragActive && !disabled && !loading
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-300 dark:border-gray-600',
        disabled && 'opacity-50 cursor-not-allowed',
        loading && 'cursor-wait',
        !disabled && !loading && 'hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800/50',
        className
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={disabled || loading ? -1 : 0}
      role="button"
      aria-label="Drop database file here or click to browse"
      aria-disabled={disabled || loading}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(',')}
        onChange={handleFileInput}
        className="hidden"
        disabled={disabled || loading}
        aria-hidden="true"
      />

      {loading ? (
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading database...</p>
        </div>
      ) : (
        <>
          {/* Icon */}
          <div
            className={cn(
              'w-16 h-16 mb-4 rounded-full flex items-center justify-center',
              isDragActive
                ? 'bg-blue-100 dark:bg-blue-800'
                : 'bg-gray-100 dark:bg-gray-700'
            )}
          >
            <svg
              className={cn(
                'w-8 h-8',
                isDragActive
                  ? 'text-blue-500'
                  : 'text-gray-400 dark:text-gray-500'
              )}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
          </div>

          {/* Text */}
          <div className="text-center">
            <p className="text-base font-medium text-gray-700 dark:text-gray-200">
              {isDragActive ? 'Drop your database file here' : 'Drop SQLite database or click to browse'}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Supports {ACCEPTED_EXTENSIONS.join(', ')} (max {formatFileSize(MAX_FILE_SIZE)})
            </p>
          </div>

          {/* Selected/Current file info */}
          {displayFileName && (
            <div className="mt-4 px-4 py-2 bg-green-50 dark:bg-green-900/30 rounded-md border border-green-200 dark:border-green-700">
              <p className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="font-medium">{displayFileName}</span>
                {selectedFile && (
                  <span className="text-green-600 dark:text-green-400">
                    ({formatFileSize(selectedFile.size)})
                  </span>
                )}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default FileDropZone;
