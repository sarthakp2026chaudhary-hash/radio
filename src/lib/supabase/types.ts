export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type RepeatMode = "off" | "all" | "one";
export type SourceType = "playlist" | "album" | "artist" | "queue";

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
          is_host_listener: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          auth_id: string;
          email: string;
          display_name: string;
          avatar_url?: string | null;
          is_host?: boolean;
          is_host_listener?: boolean;
        };
        Update: {
          email?: string;
          display_name?: string;
          avatar_url?: string | null;
          is_host_listener?: boolean;
        };
      };
      artists: {
        Row: {
          id: number;
          name: string;
          slug: string;
          bio: string | null;
          image_url: string | null;
          musicbrainz_id: string | null;
          spotify_id: string | null;
          apple_music_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          slug: string;
          bio?: string | null;
          image_url?: string | null;
          musicbrainz_id?: string | null;
          spotify_id?: string | null;
          apple_music_id?: string | null;
        };
        Update: {
          name?: string;
          slug?: string;
          bio?: string | null;
          image_url?: string | null;
          musicbrainz_id?: string | null;
          spotify_id?: string | null;
          apple_music_id?: string | null;
        };
      };
      albums: {
        Row: {
          id: number;
          name: string;
          slug: string;
          musicbrainz_id: string | null;
          spotify_id: string | null;
          apple_music_id: string | null;
          release_date: string | null;
          cover_url: string | null;
          total_tracks: number | null;
          label: string | null;
          upc: string | null;
          // Legacy fields
          title: string;
          artist_id: number | null;
          year: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          slug: string;
          musicbrainz_id?: string | null;
          spotify_id?: string | null;
          apple_music_id?: string | null;
          release_date?: string | null;
          cover_url?: string | null;
          total_tracks?: number | null;
          label?: string | null;
          upc?: string | null;
          title?: string;
          artist_id?: number | null;
          year?: number | null;
        };
        Update: {
          name?: string;
          slug?: string;
          musicbrainz_id?: string | null;
          spotify_id?: string | null;
          apple_music_id?: string | null;
          release_date?: string | null;
          cover_url?: string | null;
          total_tracks?: number | null;
          label?: string | null;
          upc?: string | null;
          title?: string;
          artist_id?: number | null;
          year?: number | null;
        };
      };
      tracks: {
        Row: {
          id: number;
          title: string;
          artist_id: number | null;
          album_id: number | null;
          duration_ms: number;
          genre: string | null;
          bpm: number | null;
          track_number: number | null;
          disc_number: number;
          cover_url: string | null;
          file_key: string | null;
          file_url: string | null;
          file_size_bytes: number | null;
          mime_type: string;
          // Industry identifiers
          isrc: string | null;
          musicbrainz_recording_id: string | null;
          musicbrainz_release_id: string | null;
          spotify_id: string | null;
          spotify_uri: string | null;
          apple_music_id: string | null;
          youtube_id: string | null;
          acoustid: string | null;
          // Album metadata
          album_name: string | null;
          release_date: string | null;
          key: string | null;
          explicit: boolean;
          // Legacy Google Drive fields (deprecated)
          drive_file_id: string | null;
          folder_id: string | null;
          folder_name: string | null;
          // Legacy artist/album as strings (deprecated)
          artist: string | null;
          album: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          title: string;
          artist_id?: number | null;
          album_id?: number | null;
          duration_ms: number;
          genre?: string | null;
          bpm?: number | null;
          track_number?: number | null;
          disc_number?: number;
          cover_url?: string | null;
          file_key?: string | null;
          file_url?: string | null;
          file_size_bytes?: number | null;
          mime_type?: string;
          isrc?: string | null;
          musicbrainz_recording_id?: string | null;
          musicbrainz_release_id?: string | null;
          spotify_id?: string | null;
          spotify_uri?: string | null;
          apple_music_id?: string | null;
          youtube_id?: string | null;
          acoustid?: string | null;
          album_name?: string | null;
          release_date?: string | null;
          key?: string | null;
          explicit?: boolean;
          drive_file_id?: string | null;
        };
        Update: {
          title?: string;
          artist_id?: number | null;
          album_id?: number | null;
          duration_ms?: number;
          genre?: string | null;
          bpm?: number | null;
          track_number?: number | null;
          disc_number?: number;
          cover_url?: string | null;
          file_key?: string | null;
          file_url?: string | null;
          isrc?: string | null;
          musicbrainz_recording_id?: string | null;
          musicbrainz_release_id?: string | null;
          spotify_id?: string | null;
          spotify_uri?: string | null;
          apple_music_id?: string | null;
          youtube_id?: string | null;
          acoustid?: string | null;
          album_name?: string | null;
          release_date?: string | null;
          key?: string | null;
          explicit?: boolean;
        };
      };
      playlists: {
        Row: {
          id: number;
          name: string;
          description: string | null;
          cover_url: string | null;
          is_public: boolean;
          created_by: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          description?: string | null;
          cover_url?: string | null;
          is_public?: boolean;
          created_by?: number | null;
        };
        Update: {
          name?: string;
          description?: string | null;
          cover_url?: string | null;
          is_public?: boolean;
        };
      };
      playlist_tracks: {
        Row: {
          id: number;
          playlist_id: number;
          track_id: number;
          position: number;
          added_at: string;
        };
        Insert: {
          playlist_id: number;
          track_id: number;
          position: number;
        };
        Update: {
          position?: number;
        };
      };
      channels: {
        Row: {
          id: number;
          name: string;
          slug: string;
          description: string | null;
          cover_url: string | null;
          is_active: boolean;
          is_public: boolean;
          status: "active" | "paused" | "archived";
          for_user_id: number | null;
          archived_as_playlist_id: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          slug: string;
          description?: string | null;
          cover_url?: string | null;
          is_active?: boolean;
          is_public?: boolean;
          status?: "active" | "paused" | "archived";
          for_user_id?: number | null;
        };
        Update: {
          name?: string;
          slug?: string;
          description?: string | null;
          cover_url?: string | null;
          is_active?: boolean;
          is_public?: boolean;
          status?: "active" | "paused" | "archived";
          for_user_id?: number | null;
        };
      };
      channel_members: {
        Row: {
          id: number;
          channel_id: number;
          user_id: string;
          role: "listener" | "moderator";
          invited_by: string | null;
          invited_at: string;
        };
        Insert: {
          channel_id: number;
          user_id: string;
          role?: "listener" | "moderator";
          invited_by?: string | null;
        };
        Update: {
          role?: "listener" | "moderator";
        };
      };
      channel_track_votes: {
        Row: {
          id: number;
          channel_id: number;
          track_id: number;
          user_id: number;
          created_at: string;
        };
        Insert: {
          channel_id: number;
          track_id: number;
          user_id: number;
          created_at?: string;
        };
        Update: {
          channel_id?: number;
          track_id?: number;
          user_id?: number;
        };
      };
      channel_state: {
        Row: {
          id: number;
          channel_id: number;
          current_track_id: number | null;
          is_playing: boolean;
          playback_started_at: string | null;
          position_ms: number;
          source_type: SourceType | null;
          source_id: number | null;
          source_position: number;
          priority_queue: number[];
          user_queue: number[];
          shuffle_enabled: boolean;
          shuffle_order: number[];
          repeat_mode: RepeatMode;
          color_scheme: string;
          broadcast_mode: "automated" | "live";
          live_host_user_id: number | null;
          live_started_at: string | null;
          current_track_source: "source" | "priority" | "user" | "host";
          updated_at: string;
        };
        Insert: {
          channel_id: number;
          current_track_id?: number | null;
          is_playing?: boolean;
          playback_started_at?: string | null;
          position_ms?: number;
          source_type?: SourceType | null;
          source_id?: number | null;
          source_position?: number;
          priority_queue?: number[];
          user_queue?: number[];
          shuffle_enabled?: boolean;
          shuffle_order?: number[];
          repeat_mode?: RepeatMode;
          color_scheme?: string;
          broadcast_mode?: "automated" | "live";
          live_host_user_id?: number | null;
          current_track_source?: "source" | "priority" | "user" | "host";
        };
        Update: {
          current_track_id?: number | null;
          is_playing?: boolean;
          playback_started_at?: string | null;
          position_ms?: number;
          source_type?: SourceType | null;
          source_id?: number | null;
          source_position?: number;
          priority_queue?: number[];
          user_queue?: number[];
          shuffle_enabled?: boolean;
          shuffle_order?: number[];
          repeat_mode?: RepeatMode;
          color_scheme?: string;
          broadcast_mode?: "automated" | "live";
          live_host_user_id?: number | null;
          live_started_at?: string | null;
          current_track_source?: "source" | "priority" | "user" | "host";
        };
      };
      channel_listeners: {
        Row: {
          id: number;
          channel_id: number;
          user_id: number;
          joined_at: string;
          last_heartbeat: string;
        };
        Insert: {
          channel_id: number;
          user_id: number;
        };
        Update: {
          last_heartbeat?: string;
        };
      };
      track_artists: {
        Row: {
          id: number;
          track_id: number;
          artist_id: number;
          role: "primary" | "featured" | "producer" | "remixer";
          position: number;
          credit_name: string | null;
          is_main: boolean;
          created_at: string;
        };
        Insert: {
          track_id: number;
          artist_id: number;
          role?: "primary" | "featured" | "producer" | "remixer";
          position?: number;
          credit_name?: string | null;
          is_main?: boolean;
        };
        Update: {
          role?: "primary" | "featured" | "producer" | "remixer";
          position?: number;
          credit_name?: string | null;
          is_main?: boolean;
        };
      };
      host_presence: {
        Row: {
          id: number;
          user_id: number;
          channel_id: number | null;
          is_listening: boolean;
          last_heartbeat: string;
          session_started_at: string;
        };
        Insert: {
          user_id: number;
          channel_id?: number | null;
          is_listening?: boolean;
        };
        Update: {
          channel_id?: number | null;
          is_listening?: boolean;
          last_heartbeat?: string;
        };
      };
      queue_journal: {
        Row: {
          id: number;
          channel_id: number;
          session_date: string;
          track_id: number;
          position: number;
          journal_order: number;
          played_at: string;
          added_by: "source" | "priority" | "user" | "host";
        };
        Insert: {
          channel_id: number;
          track_id: number;
          position: number;
          session_date?: string;
          added_by?: "source" | "priority" | "user" | "host";
        };
        Update: never;
      };
      listening_history: {
        Row: {
          id: number;
          user_id: number;
          track_id: number;
          channel_id: number | null;
          played_at: string;
          duration_listened_ms: number;
          completed: boolean;
        };
        Insert: {
          user_id: number;
          track_id: number;
          channel_id?: number | null;
          duration_listened_ms?: number;
          completed?: boolean;
        };
        Update: {
          duration_listened_ms?: number;
          completed?: boolean;
        };
      };
      track_play_counts: {
        Row: {
          track_id: number;
          total_plays: number;
          host_plays: number;
          last_played_at: string | null;
          updated_at: string;
        };
        Insert: never;
        Update: never;
      };
      user_library: {
        Row: {
          id: number;
          user_id: number;
          track_id: number;
          added_at: string;
          source_channel_id: number | null;
        };
        Insert: {
          user_id: number;
          track_id: number;
          source_channel_id?: number | null;
        };
        Update: never;
      };
      channel_schedules: {
        Row: {
          id: number;
          channel_id: number;
          name: string;
          playlist_id: number | null;
          day_of_week: number | null;
          start_time: string;
          end_time: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          channel_id: number;
          name: string;
          playlist_id?: number | null;
          day_of_week?: number | null;
          start_time: string;
          end_time: string;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          playlist_id?: number | null;
          day_of_week?: number | null;
          start_time?: string;
          end_time?: string;
          is_active?: boolean;
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
      // Legacy table - will be deprecated
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
          current_folder_id: string | null;
          color_scheme: string;
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
          current_folder_id?: string | null;
          color_scheme?: string;
        };
      };
      track_votes: {
        Row: {
          id: number;
          track_id: number;
          user_id: number;
          folder_id: string;
          created_at: string;
        };
        Insert: {
          track_id: number;
          user_id: number;
          folder_id: string;
        };
        Update: never;
      };
      stickers: {
        Row: {
          id: number;
          label: string;
          sound_url: string | null;
          created_at: string;
        };
        Insert: {
          label: string;
          sound_url?: string | null;
        };
        Update: {
          label?: string;
          sound_url?: string | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_next_track: {
        Args: { p_channel_id: number };
        Returns: number | null;
      };
      advance_channel_track: {
        Args: { p_channel_id: number };
        Returns: void;
      };
      can_access_channel: {
        Args: { p_channel_id: number; p_user_id: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
  };
}

// Convenience types for common use cases
export type Artist = Database["public"]["Tables"]["artists"]["Row"];
export type ArtistInsert = Database["public"]["Tables"]["artists"]["Insert"];
export type Album = Database["public"]["Tables"]["albums"]["Row"];
export type AlbumInsert = Database["public"]["Tables"]["albums"]["Insert"];
export type Track = Database["public"]["Tables"]["tracks"]["Row"];
export type TrackInsert = Database["public"]["Tables"]["tracks"]["Insert"];
export type Playlist = Database["public"]["Tables"]["playlists"]["Row"];
export type PlaylistInsert = Database["public"]["Tables"]["playlists"]["Insert"];
export type PlaylistTrack = Database["public"]["Tables"]["playlist_tracks"]["Row"];
export type Channel = Database["public"]["Tables"]["channels"]["Row"];
export type ChannelInsert = Database["public"]["Tables"]["channels"]["Insert"];
export type ChannelState = Database["public"]["Tables"]["channel_state"]["Row"];
export type ChannelMember = Database["public"]["Tables"]["channel_members"]["Row"];
export type ChannelMemberInsert = Database["public"]["Tables"]["channel_members"]["Insert"];
export type User = Database["public"]["Tables"]["users"]["Row"];

// Extended types with relations
export type TrackWithArtist = Track & {
  artists: Artist | null;
  albums: Album | null;
};

export type PlaylistWithTracks = Playlist & {
  playlist_tracks: (PlaylistTrack & { tracks: TrackWithArtist })[];
};

export type ChannelWithState = Channel & {
  channel_state: ChannelState | null;
};

// New types for live playlists feature
export type TrackArtist = Database["public"]["Tables"]["track_artists"]["Row"];
export type TrackArtistInsert = Database["public"]["Tables"]["track_artists"]["Insert"];
export type HostPresence = Database["public"]["Tables"]["host_presence"]["Row"];
export type QueueJournal = Database["public"]["Tables"]["queue_journal"]["Row"];
export type ListeningHistory = Database["public"]["Tables"]["listening_history"]["Row"];
export type TrackPlayCount = Database["public"]["Tables"]["track_play_counts"]["Row"];
export type UserLibrary = Database["public"]["Tables"]["user_library"]["Row"];
export type ChannelSchedule = Database["public"]["Tables"]["channel_schedules"]["Row"];
export type ChannelScheduleInsert = Database["public"]["Tables"]["channel_schedules"]["Insert"];

// Extended track type with multiple artists
export type TrackWithArtists = Track & {
  track_artists: (TrackArtist & { artists: Artist })[];
  albums: Album | null;
};
