import { SupabaseClient } from "@supabase/supabase-js";
import type {
  Artist,
  ArtistInsert,
  Album,
  AlbumInsert,
  Track,
  TrackInsert,
  Playlist,
  PlaylistInsert,
  Channel,
  ChannelInsert,
  ChannelState,
  ChannelMember,
  ChannelMemberInsert,
  User,
  TrackArtist,
  TrackArtistInsert,
  HostPresence,
  QueueJournal,
  ListeningHistory,
  TrackPlayCount,
  UserLibrary,
  ChannelSchedule,
  ChannelScheduleInsert,
} from "./types";
import { slugify } from "../utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>;

export const db = {
  artists: {
    list: async (supabase: AnySupabase) => {
      const result = await supabase.from("artists").select("*").order("name");
      return result as { data: Artist[] | null; error: any };
    },

    get: async (supabase: AnySupabase, id: number) => {
      const result = await supabase.from("artists").select("*, albums(*), tracks(*)").eq("id", id).single();
      return result as { data: (Artist & { albums: Album[]; tracks: Track[] }) | null; error: any };
    },

    getBySlug: async (supabase: AnySupabase, slug: string) => {
      const result = await supabase.from("artists").select("slug").eq("slug", slug).maybeSingle();
      return result as { data: { slug: string } | null; error: any };
    },

    create: async (supabase: AnySupabase, data: ArtistInsert) => {
      const result = await supabase.from("artists").insert(data).select().single();
      return result as { data: Artist | null; error: any };
    },

    update: async (supabase: AnySupabase, id: number, data: Partial<Artist>) => {
      const result = await supabase.from("artists").update(data).eq("id", id).select().single();
      return result as { data: Artist | null; error: any };
    },

    delete: async (supabase: AnySupabase, id: number) => {
      const result = await supabase.from("artists").delete().eq("id", id);
      return result as { error: any };
    },

    getIdBySlug: async (supabase: AnySupabase, slug: string) => {
      const result = await supabase.from("artists").select("id").eq("slug", slug).maybeSingle();
      return result as { data: { id: number } | null; error: any };
    },

    // Find an artist by name (via slug), creating it if missing. Used by text-first add.
    findOrCreateByName: async (
      supabase: AnySupabase,
      name: string
    ): Promise<{ id: number | null; error: any }> => {
      const clean = name.trim();
      const slug = slugify(clean) || "unknown";
      const existing = await supabase.from("artists").select("id").eq("slug", slug).maybeSingle();
      if (existing.data) return { id: (existing.data as any).id as number, error: null };
      const created = await supabase.from("artists").insert({ name: clean, slug }).select("id").single();
      if (created.error) {
        // unique-slug race: re-fetch
        const again = await supabase.from("artists").select("id").eq("slug", slug).maybeSingle();
        if (again.data) return { id: (again.data as any).id as number, error: null };
        return { id: null, error: created.error };
      }
      return { id: (created.data as any).id as number, error: null };
    },
  },

  albums: {
    list: async (supabase: AnySupabase) => {
      const result = await supabase.from("albums").select("*, artists(*)").order("title");
      return result as { data: (Album & { artists: Artist })[] | null; error: any };
    },

    get: async (supabase: AnySupabase, id: number) => {
      const result = await supabase.from("albums").select("*, artists(*), tracks(*)").eq("id", id).single();
      return result as { data: (Album & { artists: Artist; tracks: Track[] }) | null; error: any };
    },

    create: async (supabase: AnySupabase, data: AlbumInsert) => {
      const result = await supabase.from("albums").insert(data).select().single();
      return result as { data: Album | null; error: any };
    },

    update: async (supabase: AnySupabase, id: number, data: Partial<Album>) => {
      const result = await supabase.from("albums").update(data).eq("id", id).select().single();
      return result as { data: Album | null; error: any };
    },

    delete: async (supabase: AnySupabase, id: number) => {
      const result = await supabase.from("albums").delete().eq("id", id);
      return result as { error: any };
    },
  },

  tracks: {
    list: async (supabase: AnySupabase) => {
      const result = await supabase.from("tracks").select("*, artists:artist_id(*), albums:album_id(*)").order("title");
      return result as { data: (Track & { artists: Artist | null; albums: Album | null })[] | null; error: any };
    },

    get: async (supabase: AnySupabase, id: number) => {
      const result = await supabase.from("tracks").select("*, artists:artist_id(*), albums:album_id(*)").eq("id", id).single();
      return result as { data: (Track & { artists: Artist | null; albums: Album | null }) | null; error: any };
    },

    create: async (supabase: AnySupabase, data: TrackInsert) => {
      const result = await supabase.from("tracks").insert(data).select("*, artists:artist_id(*), albums:album_id(*)").single();
      return result as { data: (Track & { artists: Artist | null; albums: Album | null }) | null; error: any };
    },

    update: async (supabase: AnySupabase, id: number, data: Partial<Track>) => {
      const result = await supabase.from("tracks").update(data).eq("id", id).select().single();
      return result as { data: Track | null; error: any };
    },

    delete: async (supabase: AnySupabase, id: number) => {
      const result = await supabase.from("tracks").delete().eq("id", id);
      return result as { error: any };
    },
  },

  playlists: {
    list: async (supabase: AnySupabase) => {
      const result = await supabase
        .from("playlists")
        .select("*, playlist_tracks(id, position, tracks(id, title, duration_ms, artists:artist_id(name)))")
        .neq("name", "__defaults__")
        .order("created_at", { ascending: false });
      return result as { data: any[] | null; error: any };
    },

    get: async (supabase: AnySupabase, id: number) => {
      const result = await supabase
        .from("playlists")
        .select("*, playlist_tracks(id, position, added_at, tracks(id, title, duration_ms, cover_url, file_url, artists:artist_id(id, name, slug), albums:album_id(id, title)))")
        .eq("id", id)
        .single();
      return result as { data: any | null; error: any };
    },

    create: async (supabase: AnySupabase, data: PlaylistInsert) => {
      const result = await supabase.from("playlists").insert(data).select().single();
      return result as { data: Playlist | null; error: any };
    },

    update: async (supabase: AnySupabase, id: number, data: Partial<Playlist>) => {
      const result = await supabase.from("playlists").update(data).eq("id", id).select().single();
      return result as { data: Playlist | null; error: any };
    },

    delete: async (supabase: AnySupabase, id: number) => {
      const result = await supabase.from("playlists").delete().eq("id", id);
      return result as { error: any };
    },

    addTrack: async (supabase: AnySupabase, playlistId: number, trackId: number, position: number) => {
      const result = await supabase
        .from("playlist_tracks")
        .insert({ playlist_id: playlistId, track_id: trackId, position })
        .select("*, tracks(id, title, duration_ms, artists:artist_id(name))")
        .single();
      return result as { data: any | null; error: any };
    },

    removeTrack: async (supabase: AnySupabase, playlistId: number, trackId: number) => {
      const result = await supabase.from("playlist_tracks").delete().eq("playlist_id", playlistId).eq("track_id", trackId);
      return result as { error: any };
    },

    getMaxPosition: async (supabase: AnySupabase, playlistId: number) => {
      const result = await supabase
        .from("playlist_tracks")
        .select("position")
        .eq("playlist_id", playlistId)
        .order("position", { ascending: false })
        .limit(1);
      return result as { data: { position: number }[] | null; error: any };
    },

    reorderTracks: async (supabase: AnySupabase, playlistId: number, trackIds: number[]) => {
      await supabase.from("playlist_tracks").delete().eq("playlist_id", playlistId);
      const updates = trackIds.map((trackId, index) => ({
        playlist_id: playlistId,
        track_id: trackId,
        position: index,
      }));
      const result = await supabase.from("playlist_tracks").insert(updates);
      return result as { error: any };
    },

    // Assign (or clear) a playlist's folder. Untyped client tolerates folder_id.
    setFolder: async (supabase: AnySupabase, playlistId: number, folderId: number | null) => {
      const result = await supabase.from("playlists").update({ folder_id: folderId }).eq("id", playlistId);
      return result as { error: any };
    },
  },

  folders: {
    list: async (supabase: AnySupabase) => {
      const result = await supabase.from("folders").select("*").order("position").order("name");
      return result as { data: any[] | null; error: any };
    },

    // Folders with their direct playlists; build the nested tree (via parent_id) in the UI.
    tree: async (supabase: AnySupabase) => {
      const result = await supabase
        .from("folders")
        .select("*, playlists(id, name, folder_id, is_public)")
        .order("position");
      return result as { data: any[] | null; error: any };
    },

    create: async (
      supabase: AnySupabase,
      data: { name: string; parent_id?: number | null; position?: number; color?: string | null }
    ) => {
      const result = await supabase.from("folders").insert(data).select().single();
      return result as { data: any | null; error: any };
    },

    update: async (supabase: AnySupabase, id: number, data: Record<string, unknown>) => {
      const result = await supabase.from("folders").update(data).eq("id", id).select().single();
      return result as { data: any | null; error: any };
    },

    delete: async (supabase: AnySupabase, id: number) => {
      const result = await supabase.from("folders").delete().eq("id", id);
      return result as { error: any };
    },
  },

  channels: {
    list: async (supabase: AnySupabase) => {
      const result = await supabase
        .from("channels")
        .select("*, channel_state(current_track_id, is_playing, source_type, source_id, broadcast_mode, tracks:current_track_id(id, title, artists:artist_id(id, name)))")
        .eq("is_active", true)
        .order("created_at");
      return result as { data: any[] | null; error: any };
    },

    getBySlug: async (supabase: AnySupabase, slug: string) => {
      const result = await supabase
        .from("channels")
        .select("*, channel_state(*, current_track:current_track_id(id, title, duration_ms, file_url, cover_url, artists:artist_id(id, name), albums:album_id(id, title)))")
        .eq("slug", slug)
        .single();
      return result as { data: any | null; error: any };
    },

    create: async (supabase: AnySupabase, data: ChannelInsert) => {
      const { data: channel, error } = await supabase.from("channels").insert(data).select().single();
      if (channel && !error) {
        await supabase.from("channel_state").insert({ channel_id: (channel as any).id });
      }
      return { data: channel as Channel | null, error };
    },

    update: async (supabase: AnySupabase, slug: string, data: Partial<Channel>) => {
      const result = await supabase.from("channels").update(data).eq("slug", slug).select().single();
      return result as { data: Channel | null; error: any };
    },

    delete: async (supabase: AnySupabase, slug: string) => {
      const result = await supabase.from("channels").delete().eq("slug", slug);
      return result as { error: any };
    },

    getListenerCount: async (supabase: AnySupabase, channelId: number) => {
      const { count } = await supabase
        .from("channel_listeners")
        .select("*", { count: "exact", head: true })
        .eq("channel_id", channelId)
        .gte("last_heartbeat", new Date(Date.now() - 60000).toISOString());
      return count || 0;
    },
  },

  channelState: {
    get: async (supabase: AnySupabase, channelId: number) => {
      const result = await supabase
        .from("channel_state")
        .select("*, current_track:current_track_id(id, title, duration_ms, file_url, cover_url, artists:artist_id(id, name, slug), albums:album_id(id, title))")
        .eq("channel_id", channelId)
        .single();
      return result as { data: any | null; error: any };
    },

    create: async (supabase: AnySupabase, channelId: number) => {
      const result = await supabase.from("channel_state").insert({ channel_id: channelId });
      return result as { error: any };
    },

    update: async (supabase: AnySupabase, channelId: number, data: Partial<ChannelState>) => {
      const result = await supabase.from("channel_state").update(data).eq("channel_id", channelId);
      return result as { error: any };
    },
  },

  users: {
    getByAuthId: async (supabase: AnySupabase, authId: string) => {
      const result = await supabase.from("users").select("*").eq("auth_id", authId).single();
      return result as { data: User | null; error: any };
    },

    isHost: async (supabase: AnySupabase, authId: string) => {
      const { data } = await supabase.from("users").select("is_host").eq("auth_id", authId).single();
      return (data as any)?.is_host === true;
    },
  },

  channelMembers: {
    list: async (supabase: AnySupabase, channelId: number) => {
      const result = await supabase
        .from("channel_members")
        .select("*, user:user_id(id, email, raw_user_meta_data)")
        .eq("channel_id", channelId)
        .order("invited_at");
      return result as { data: (ChannelMember & { user: any })[] | null; error: any };
    },

    add: async (supabase: AnySupabase, data: ChannelMemberInsert) => {
      const result = await supabase
        .from("channel_members")
        .insert(data)
        .select()
        .single();
      return result as { data: ChannelMember | null; error: any };
    },

    remove: async (supabase: AnySupabase, channelId: number, userId: string) => {
      const result = await supabase
        .from("channel_members")
        .delete()
        .eq("channel_id", channelId)
        .eq("user_id", userId);
      return result as { error: any };
    },

    updateRole: async (supabase: AnySupabase, channelId: number, userId: string, role: "listener" | "moderator") => {
      const result = await supabase
        .from("channel_members")
        .update({ role })
        .eq("channel_id", channelId)
        .eq("user_id", userId);
      return result as { error: any };
    },

    isMember: async (supabase: AnySupabase, channelId: number, userId: string) => {
      const { data } = await supabase
        .from("channel_members")
        .select("id")
        .eq("channel_id", channelId)
        .eq("user_id", userId)
        .maybeSingle();
      return !!data;
    },

    canAccess: async (supabase: AnySupabase, channelId: number, userId: string) => {
      const { data: rpcResult } = await supabase.rpc("can_access_channel", {
        p_channel_id: channelId,
        p_user_id: userId,
      });
      return rpcResult as boolean;
    },
  },

  trackArtists: {
    list: async (supabase: AnySupabase, trackId: number) => {
      const result = await supabase
        .from("track_artists")
        .select("*, artists:artist_id(*)")
        .eq("track_id", trackId)
        .order("position");
      return result as { data: (TrackArtist & { artists: Artist })[] | null; error: any };
    },

    add: async (supabase: AnySupabase, data: TrackArtistInsert) => {
      const result = await supabase.from("track_artists").insert(data).select("*, artists:artist_id(*)").single();
      return result as { data: (TrackArtist & { artists: Artist }) | null; error: any };
    },

    remove: async (supabase: AnySupabase, trackId: number, artistId: number) => {
      const result = await supabase.from("track_artists").delete().eq("track_id", trackId).eq("artist_id", artistId);
      return result as { error: any };
    },

    updateRole: async (supabase: AnySupabase, trackId: number, artistId: number, role: TrackArtist["role"]) => {
      const result = await supabase.from("track_artists").update({ role }).eq("track_id", trackId).eq("artist_id", artistId);
      return result as { error: any };
    },

    setForTrack: async (supabase: AnySupabase, trackId: number, artists: { artistId: number; role: TrackArtist["role"]; position: number }[]) => {
      await supabase.from("track_artists").delete().eq("track_id", trackId);
      if (artists.length === 0) return { error: null };
      const inserts = artists.map((a) => ({ track_id: trackId, artist_id: a.artistId, role: a.role, position: a.position }));
      const result = await supabase.from("track_artists").insert(inserts);
      return result as { error: any };
    },
  },

  hostPresence: {
    get: async (supabase: AnySupabase) => {
      const result = await supabase
        .from("host_presence")
        .select("*, users:user_id(*), channels:channel_id(*)")
        .eq("is_listening", true)
        .maybeSingle();
      return result as { data: (HostPresence & { users: User; channels: Channel | null }) | null; error: any };
    },

    update: async (supabase: AnySupabase, userId: number, data: { channel_id?: number | null; is_listening?: boolean }) => {
      const result = await supabase
        .from("host_presence")
        .upsert({ user_id: userId, ...data, last_heartbeat: new Date().toISOString() }, { onConflict: "user_id" })
        .select()
        .single();
      return result as { data: HostPresence | null; error: any };
    },

    heartbeat: async (supabase: AnySupabase, userId: number) => {
      const result = await supabase
        .from("host_presence")
        .update({ last_heartbeat: new Date().toISOString() })
        .eq("user_id", userId);
      return result as { error: any };
    },

    isLive: async (supabase: AnySupabase, channelId: number) => {
      const { data } = await supabase
        .from("host_presence")
        .select("id")
        .eq("channel_id", channelId)
        .eq("is_listening", true)
        .gte("last_heartbeat", new Date(Date.now() - 60000).toISOString())
        .maybeSingle();
      return !!data;
    },
  },

  queueJournal: {
    list: async (supabase: AnySupabase, channelId: number, sessionDate?: string) => {
      const date = sessionDate || new Date().toISOString().split("T")[0];
      const result = await supabase
        .from("queue_journal")
        .select("*, tracks:track_id(*, artists:artist_id(*))")
        .eq("channel_id", channelId)
        .eq("session_date", date)
        .order("position");
      return result as { data: (QueueJournal & { tracks: Track & { artists: Artist | null } })[] | null; error: any };
    },

    saveAsPlaylist: async (supabase: AnySupabase, channelId: number, name: string, sessionDate?: string) => {
      const date = sessionDate || new Date().toISOString().split("T")[0];
      const { data: journalEntries } = await supabase
        .from("queue_journal")
        .select("track_id, position")
        .eq("channel_id", channelId)
        .eq("session_date", date)
        .order("position");

      if (!journalEntries?.length) return { data: null, error: { message: "No journal entries for this date" } };

      const { data: playlist, error: playlistError } = await supabase
        .from("playlists")
        .insert({ name, description: `Saved from channel journal on ${date}` })
        .select()
        .single();

      if (playlistError) return { data: null, error: playlistError };

      const tracks = journalEntries.map((entry: any, index: number) => ({
        playlist_id: (playlist as any).id,
        track_id: entry.track_id,
        position: index,
      }));
      await supabase.from("playlist_tracks").insert(tracks);

      return { data: playlist as Playlist, error: null };
    },
  },

  listeningHistory: {
    record: async (supabase: AnySupabase, userId: number, trackId: number, channelId?: number) => {
      const result = await supabase
        .from("listening_history")
        .insert({ user_id: userId, track_id: trackId, channel_id: channelId || null })
        .select()
        .single();
      return result as { data: ListeningHistory | null; error: any };
    },

    list: async (supabase: AnySupabase, userId: number, limit = 50) => {
      const result = await supabase
        .from("listening_history")
        .select("*, tracks:track_id(*, artists:artist_id(*))")
        .eq("user_id", userId)
        .order("played_at", { ascending: false })
        .limit(limit);
      return result as { data: (ListeningHistory & { tracks: Track & { artists: Artist | null } })[] | null; error: any };
    },
  },

  trackPlayCounts: {
    get: async (supabase: AnySupabase, trackId: number) => {
      const result = await supabase.from("track_play_counts").select("*").eq("track_id", trackId).maybeSingle();
      return result as { data: TrackPlayCount | null; error: any };
    },

    getTopTracks: async (supabase: AnySupabase, limit = 20, hostOnly = false) => {
      const orderColumn = hostOnly ? "host_plays" : "total_plays";
      const result = await supabase
        .from("track_play_counts")
        .select("*, tracks:track_id(*, artists:artist_id(*))")
        .order(orderColumn, { ascending: false })
        .limit(limit);
      return result as { data: (TrackPlayCount & { tracks: Track & { artists: Artist | null } })[] | null; error: any };
    },
  },

  userLibrary: {
    list: async (supabase: AnySupabase, userId: number) => {
      const result = await supabase
        .from("user_library")
        .select("*, tracks:track_id(*, artists:artist_id(*))")
        .eq("user_id", userId)
        .order("added_at", { ascending: false });
      return result as { data: (UserLibrary & { tracks: Track & { artists: Artist | null } })[] | null; error: any };
    },

    add: async (supabase: AnySupabase, userId: number, trackId: number, sourceChannelId?: number) => {
      const result = await supabase
        .from("user_library")
        .insert({ user_id: userId, track_id: trackId, source_channel_id: sourceChannelId || null })
        .select()
        .single();
      return result as { data: UserLibrary | null; error: any };
    },

    remove: async (supabase: AnySupabase, userId: number, trackId: number) => {
      const result = await supabase.from("user_library").delete().eq("user_id", userId).eq("track_id", trackId);
      return result as { error: any };
    },

    has: async (supabase: AnySupabase, userId: number, trackId: number) => {
      const { data } = await supabase.from("user_library").select("id").eq("user_id", userId).eq("track_id", trackId).maybeSingle();
      return !!data;
    },
  },

  channelSchedules: {
    list: async (supabase: AnySupabase, channelId: number) => {
      const result = await supabase
        .from("channel_schedules")
        .select("*, playlists:playlist_id(*)")
        .eq("channel_id", channelId)
        .order("start_time");
      return result as { data: (ChannelSchedule & { playlists: Playlist | null })[] | null; error: any };
    },

    create: async (supabase: AnySupabase, data: ChannelScheduleInsert) => {
      const result = await supabase.from("channel_schedules").insert(data).select().single();
      return result as { data: ChannelSchedule | null; error: any };
    },

    update: async (supabase: AnySupabase, id: number, data: Partial<ChannelSchedule>) => {
      const result = await supabase.from("channel_schedules").update(data).eq("id", id).select().single();
      return result as { data: ChannelSchedule | null; error: any };
    },

    delete: async (supabase: AnySupabase, id: number) => {
      const result = await supabase.from("channel_schedules").delete().eq("id", id);
      return result as { error: any };
    },

    getActiveForTime: async (supabase: AnySupabase, channelId: number, time: string, dayOfWeek: number) => {
      const result = await supabase
        .from("channel_schedules")
        .select("*")
        .eq("channel_id", channelId)
        .eq("is_active", true)
        .or(`day_of_week.is.null,day_of_week.eq.${dayOfWeek}`)
        .lte("start_time", time)
        .gte("end_time", time)
        .maybeSingle();
      return result as { data: ChannelSchedule | null; error: any };
    },
  },
};
