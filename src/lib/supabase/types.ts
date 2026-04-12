export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: number;
          auth_id: string;
          email: string;
          display_name: string;
          avatar_url: string | null;
          is_host: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          auth_id: string;
          email: string;
          display_name: string;
          avatar_url?: string | null;
          is_host?: boolean;
        };
        Update: {
          email?: string;
          display_name?: string;
          avatar_url?: string | null;
        };
      };
      friend_messages: {
        Row: {
          id: number;
          user_id: number;
          welcome_title: string;
          welcome_subtitle: string;
          custom_color: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: number;
          welcome_title: string;
          welcome_subtitle: string;
          custom_color?: string | null;
        };
        Update: {
          welcome_title?: string;
          welcome_subtitle?: string;
          custom_color?: string | null;
        };
      };
      tracks: {
        Row: {
          id: number;
          drive_file_id: string;
          title: string;
          artist: string | null;
          album: string | null;
          duration_ms: number;
          cover_url: string | null;
          file_size_bytes: number | null;
          mime_type: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          drive_file_id: string;
          title: string;
          artist?: string | null;
          album?: string | null;
          duration_ms: number;
          cover_url?: string | null;
          file_size_bytes?: number | null;
          mime_type?: string;
        };
        Update: {
          title?: string;
          artist?: string | null;
          album?: string | null;
          duration_ms?: number;
          cover_url?: string | null;
        };
      };
      playback_state: {
        Row: {
          id: number;
          current_track_id: number | null;
          is_playing: boolean;
          playback_started_at: string | null;
          position_at_timestamp: number;
          queue_track_ids: number[];
          queue_position: number;
          volume: number;
          updated_at: string;
        };
        Insert: never;
        Update: {
          current_track_id?: number | null;
          is_playing?: boolean;
          playback_started_at?: string | null;
          position_at_timestamp?: number;
          queue_track_ids?: number[];
          queue_position?: number;
          volume?: number;
        };
      };
      posts: {
        Row: {
          id: number;
          content: string;
          is_pinned: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          content: string;
          is_pinned?: boolean;
        };
        Update: {
          content?: string;
          is_pinned?: boolean;
        };
      };
      recommendations: {
        Row: {
          id: number;
          track_id: number;
          message: string;
          target_user_id: number | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          track_id: number;
          message: string;
          target_user_id?: number | null;
        };
        Update: {
          is_read?: boolean;
        };
      };
      notifications: {
        Row: {
          id: number;
          type: "online" | "message" | "recommendation";
          title: string;
          body: string | null;
          target_user_id: number | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          type: "online" | "message" | "recommendation";
          title: string;
          body?: string | null;
          target_user_id?: number | null;
        };
        Update: {
          is_read?: boolean;
        };
      };
      visibility_rules: {
        Row: {
          id: number;
          rule_type: "hide_from" | "show_only";
          context: string;
          user_id: number;
          created_at: string;
        };
        Insert: {
          rule_type: "hide_from" | "show_only";
          context: string;
          user_id: number;
        };
        Update: never;
      };
      gallery_entries: {
        Row: {
          id: number;
          title: string | null;
          note: string | null;
          image_url: string | null;
          track_id: number | null;
          session_date: string;
          created_at: string;
        };
        Insert: {
          title?: string | null;
          note?: string | null;
          image_url?: string | null;
          track_id?: number | null;
          session_date: string;
        };
        Update: {
          title?: string | null;
          note?: string | null;
          image_url?: string | null;
        };
      };
      drive_credentials: {
        Row: {
          id: number;
          user_id: number;
          access_token: string;
          refresh_token: string;
          token_expires_at: string;
          drive_folder_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: number;
          access_token: string;
          refresh_token: string;
          token_expires_at: string;
          drive_folder_id?: string | null;
        };
        Update: {
          access_token?: string;
          refresh_token?: string;
          token_expires_at?: string;
          drive_folder_id?: string | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
