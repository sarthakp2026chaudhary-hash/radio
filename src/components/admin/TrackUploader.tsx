"use client";

import { useState, useCallback, useRef } from "react";
import { Button, Progress } from "@/components/ui";
import type { UploadItem } from "@/hooks/useUpload";

interface TrackUploaderProps {
  artistId: number | null;
  artistName: string | null;
  onFilesSelected: (files: File[]) => void;
  uploads: UploadItem[];
  onUploadAll: () => void;
  onRemoveUpload: (id: string) => void;
  onClearCompleted: () => void;
}

const ALLOWED_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/flac",
  "audio/m4a",
  "audio/aac",
  "audio/x-m4a",
];

export function TrackUploader({
  artistId,
  artistName,
  onFilesSelected,
  uploads,
  onUploadAll,
  onRemoveUpload,
  onClearCompleted,
}: TrackUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (artistId) setIsDragging(true);
  }, [artistId]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (!artistId) return;

      const files = Array.from(e.dataTransfer.files).filter((file) =>
        ALLOWED_TYPES.some((type) => file.type === type || file.name.match(/\.(mp3|wav|flac|m4a|aac)$/i))
      );

      if (files.length > 0) {
        onFilesSelected(files);
      }
    },
    [artistId, onFilesSelected]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        onFilesSelected(files);
      }
      e.target.value = "";
    },
    [onFilesSelected]
  );

  const pendingCount = uploads.filter((u) => u.status === "pending").length;
  const uploadingCount = uploads.filter((u) => u.status === "uploading").length;
  const successCount = uploads.filter((u) => u.status === "success").length;
  const errorCount = uploads.filter((u) => u.status === "error").length;

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => artistId && fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-2xl p-8 text-center transition-all
          ${artistId ? "cursor-pointer" : "cursor-not-allowed opacity-50"}
          ${isDragging ? "border-ember bg-ember/5" : "border-surface-3 hover:border-surface-2"}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,.wav,.flac,.m4a,.aac,audio/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          disabled={!artistId}
        />

        <div className="flex flex-col items-center gap-3">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center"
            style={{ background: isDragging ? "var(--ember-subtle)" : "var(--surface-2)" }}
          >
            <svg
              className={`w-7 h-7 ${isDragging ? "text-ember" : "text-text-muted"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
          </div>

          {artistId ? (
            <>
              <p className="text-text-primary font-medium">
                Drop audio files here or click to browse
              </p>
              <p className="text-sm text-text-tertiary">
                Uploading to <span className="text-ember">{artistName}</span>
              </p>
              <p className="text-xs text-text-muted">
                MP3, WAV, FLAC, M4A, AAC • Max 50MB per file
              </p>
            </>
          ) : (
            <p className="text-text-secondary">
              Select an artist first to upload tracks
            </p>
          )}
        </div>
      </div>

      {/* Upload Queue */}
      {uploads.length > 0 && (
        <div
          className="rounded-2xl p-4"
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--surface-3)",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="font-medium text-text-primary">Upload Queue</h3>
              <div className="flex items-center gap-2 text-xs">
                {pendingCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-surface-3 text-text-secondary">
                    {pendingCount} pending
                  </span>
                )}
                {uploadingCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-warning/15 text-warning">
                    {uploadingCount} uploading
                  </span>
                )}
                {successCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-success/15 text-success">
                    {successCount} done
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-error/15 text-error">
                    {errorCount} failed
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {successCount > 0 && (
                <Button variant="ghost" size="sm" onClick={onClearCompleted}>
                  Clear completed
                </Button>
              )}
              {pendingCount > 0 && (
                <Button variant="primary" size="sm" onClick={onUploadAll}>
                  Upload all ({pendingCount})
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2 max-h-64 overflow-auto">
            {uploads.map((upload) => (
              <div
                key={upload.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-surface-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {upload.file.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-text-tertiary">
                      {(upload.file.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                    {upload.status === "success" && upload.result?.extracted && (
                      <span className="text-xs text-success">
                        {upload.result.extracted.title || "Uploaded"}
                      </span>
                    )}
                    {upload.status === "error" && (
                      <span className="text-xs text-error">{upload.error}</span>
                    )}
                  </div>
                  {upload.status === "uploading" && (
                    <Progress value={upload.progress} size="sm" className="mt-2" />
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {upload.status === "pending" && (
                    <span className="text-xs text-text-muted">Pending</span>
                  )}
                  {upload.status === "uploading" && (
                    <span className="text-xs text-warning">{upload.progress}%</span>
                  )}
                  {upload.status === "success" && (
                    <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {upload.status === "error" && (
                    <svg className="w-5 h-5 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  <button
                    onClick={() => onRemoveUpload(upload.id)}
                    className="p-1 rounded hover:bg-surface-3 text-text-muted hover:text-text-secondary"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
