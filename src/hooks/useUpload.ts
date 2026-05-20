"use client";

import { useState, useCallback } from "react";

export interface UploadItem {
  id: string;
  file: File;
  artistId: number;
  albumId?: number;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
  error?: string;
  result?: {
    track: any;
    extracted: any;
  };
}

export function useUpload() {
  const [uploads, setUploads] = useState<UploadItem[]>([]);

  const addToQueue = useCallback((files: File[], artistId: number, albumId?: number) => {
    const newUploads: UploadItem[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      artistId,
      albumId,
      status: "pending",
      progress: 0,
    }));

    setUploads((prev) => [...prev, ...newUploads]);
    return newUploads;
  }, []);

  const uploadFile = useCallback(async (item: UploadItem) => {
    setUploads((prev) =>
      prev.map((u) =>
        u.id === item.id ? { ...u, status: "uploading", progress: 0 } : u
      )
    );

    try {
      const formData = new FormData();
      formData.append("file", item.file);
      formData.append("artist_id", item.artistId.toString());
      if (item.albumId) {
        formData.append("album_id", item.albumId.toString());
      }

      const xhr = new XMLHttpRequest();

      const result = await new Promise<{ track: any; extracted: any }>((resolve, reject) => {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            setUploads((prev) =>
              prev.map((u) => (u.id === item.id ? { ...u, progress } : u))
            );
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            try {
              const error = JSON.parse(xhr.responseText);
              reject(new Error(error.error || "Upload failed"));
            } catch {
              reject(new Error("Upload failed"));
            }
          }
        };

        xhr.onerror = () => reject(new Error("Network error"));

        xhr.open("POST", "/api/tracks/upload");
        xhr.send(formData);
      });

      setUploads((prev) =>
        prev.map((u) =>
          u.id === item.id
            ? { ...u, status: "success", progress: 100, result }
            : u
        )
      );

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Upload failed";
      setUploads((prev) =>
        prev.map((u) =>
          u.id === item.id ? { ...u, status: "error", error: errorMessage } : u
        )
      );
      throw err;
    }
  }, []);

  const uploadAll = useCallback(async () => {
    const pending = uploads.filter((u) => u.status === "pending");

    for (const item of pending) {
      try {
        await uploadFile(item);
      } catch {
        // Continue with next file even if one fails
      }
    }
  }, [uploads, uploadFile]);

  const removeUpload = useCallback((id: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setUploads((prev) => prev.filter((u) => u.status !== "success"));
  }, []);

  const clearAll = useCallback(() => {
    setUploads([]);
  }, []);

  return {
    uploads,
    addToQueue,
    uploadFile,
    uploadAll,
    removeUpload,
    clearCompleted,
    clearAll,
  };
}
