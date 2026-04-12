/**
 * Audio Sync Engine
 * Keeps all listeners in perfect sync with the host
 */

import { calibrateTimeOffset, getServerTime } from "./time-sync";

export interface PlaybackState {
  current_track_id: number | null;
  is_playing: boolean;
  playback_started_at: string | null;
  position_at_timestamp: number;
  volume: number;
  current_folder_id?: string | null;
}

interface AudioSyncEngineOptions {
  onSyncStatus?: (status: SyncStatus) => void;
}

export type SyncStatus = "synced" | "syncing" | "drifted" | "offline";

export class AudioSyncEngine {
  private audioElement: HTMLAudioElement | null = null;
  private timeOffset: number = 0;
  private playbackState: PlaybackState | null = null;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private recalibrationInterval: ReturnType<typeof setInterval> | null = null;
  private onSyncStatus?: (status: SyncStatus) => void;
  private isInitialized = false;

  // Sync thresholds (in milliseconds)
  private readonly DRIFT_THRESHOLD_MS = 150;
  private readonly SOFT_CORRECTION_THRESHOLD_MS = 50;
  private readonly SYNC_INTERVAL_MS = 5000;
  private readonly RECALIBRATION_INTERVAL_MS = 60000;

  constructor(options: AudioSyncEngineOptions = {}) {
    this.onSyncStatus = options.onSyncStatus;
  }

  /**
   * Initialize the sync engine with an audio element
   */
  async initialize(audioElement: HTMLAudioElement): Promise<void> {
    this.audioElement = audioElement;
    this.onSyncStatus?.("syncing");

    // Calibrate time offset
    this.timeOffset = await calibrateTimeOffset();
    console.log(`Time offset calibrated: ${this.timeOffset}ms`);

    // Start sync loop
    this.startSyncLoop();

    // Start periodic recalibration
    this.startRecalibration();

    this.isInitialized = true;
    this.onSyncStatus?.("synced");
  }

  /**
   * Get current server time
   */
  private getServerTime(): number {
    return getServerTime(this.timeOffset);
  }

  /**
   * Calculate where playback should be right now
   */
  private calculateTargetPosition(): number | null {
    if (!this.playbackState || !this.playbackState.is_playing) {
      return null;
    }

    if (!this.playbackState.playback_started_at) {
      return this.playbackState.position_at_timestamp;
    }

    const serverNow = this.getServerTime();
    const startedAt = new Date(this.playbackState.playback_started_at).getTime();
    const elapsed = serverNow - startedAt;

    return this.playbackState.position_at_timestamp + elapsed;
  }

  /**
   * Handle playback state changes from Supabase Realtime
   */
  onPlaybackStateChange(state: PlaybackState): void {
    const previousState = this.playbackState;
    this.playbackState = state;

    if (!this.audioElement || !this.isInitialized) return;

    // Track changed - need to load new audio
    if (state.current_track_id !== previousState?.current_track_id) {
      // Audio source should be set externally
      return;
    }

    if (state.is_playing) {
      this.syncToTarget();
      if (this.audioElement.paused) {
        this.audioElement.play().catch(console.error);
      }
    } else {
      this.audioElement.pause();
      // Seek to the paused position (with validation)
      const positionSec = state.position_at_timestamp / 1000;
      if (isFinite(positionSec) && positionSec >= 0) {
        this.audioElement.currentTime = positionSec;
      }
    }

    // Update volume
    this.audioElement.volume = state.volume;
  }

  /**
   * Sync audio to target position
   */
  private syncToTarget(): void {
    if (!this.audioElement || !this.playbackState?.is_playing) return;

    const targetMs = this.calculateTargetPosition();
    if (targetMs === null) return;

    const currentMs = this.audioElement.currentTime * 1000;
    const drift = targetMs - currentMs;

    if (Math.abs(drift) > this.DRIFT_THRESHOLD_MS) {
      // Hard sync: seek directly
      console.log(`Hard sync: drift ${drift.toFixed(0)}ms, seeking to ${targetMs.toFixed(0)}ms`);
      this.onSyncStatus?.("syncing");
      this.audioElement.currentTime = targetMs / 1000;
      this.onSyncStatus?.("synced");
    } else if (Math.abs(drift) > this.SOFT_CORRECTION_THRESHOLD_MS) {
      // Soft sync: adjust playback rate temporarily
      console.log(`Soft sync: drift ${drift.toFixed(0)}ms, adjusting rate`);
      this.onSyncStatus?.("drifted");

      const rate = drift > 0 ? 1.03 : 0.97;
      this.audioElement.playbackRate = rate;

      // Reset rate after correction period
      setTimeout(() => {
        if (this.audioElement) {
          this.audioElement.playbackRate = 1.0;
          this.onSyncStatus?.("synced");
        }
      }, Math.abs(drift) * 2);
    } else {
      this.onSyncStatus?.("synced");
    }
  }

  /**
   * Start the sync loop
   */
  private startSyncLoop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      if (this.playbackState?.is_playing) {
        this.syncToTarget();
      }
    }, this.SYNC_INTERVAL_MS);
  }

  /**
   * Start periodic time recalibration
   */
  private startRecalibration(): void {
    if (this.recalibrationInterval) {
      clearInterval(this.recalibrationInterval);
    }

    this.recalibrationInterval = setInterval(async () => {
      try {
        const newOffset = await calibrateTimeOffset(3);
        const drift = Math.abs(newOffset - this.timeOffset);

        if (drift > 50) {
          console.log(`Time drift detected: ${drift.toFixed(0)}ms, recalibrating`);
          this.timeOffset = newOffset;
        }
      } catch (error) {
        console.warn("Recalibration failed:", error);
        this.onSyncStatus?.("offline");
      }
    }, this.RECALIBRATION_INTERVAL_MS);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    if (this.recalibrationInterval) {
      clearInterval(this.recalibrationInterval);
      this.recalibrationInterval = null;
    }
    this.audioElement = null;
    this.playbackState = null;
    this.isInitialized = false;
  }

  /**
   * Get current sync status
   */
  getSyncInfo(): { offset: number; isInitialized: boolean } {
    return {
      offset: this.timeOffset,
      isInitialized: this.isInitialized,
    };
  }
}
