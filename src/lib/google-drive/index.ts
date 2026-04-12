import { createAdminClient } from "@/lib/supabase/server";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/drive/callback`;

const SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
];

export function getAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return response.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error("Token refresh failed");
  }

  return response.json();
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  thumbnailLink?: string;
  webContentLink?: string;
}

export async function listAudioFiles(
  accessToken: string,
  folderId: string
): Promise<DriveFile[]> {
  // Always require a folderId - we only want audio files from specific folders
  const query = `'${folderId}' in parents and mimeType contains 'audio/'`;

  const params = new URLSearchParams({
    q: query,
    fields: "files(id,name,mimeType,size,thumbnailLink,webContentLink)",
    pageSize: "100",
  });

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to list files");
  }

  const data = await response.json();
  return data.files || [];
}

export async function listFolders(
  accessToken: string,
  parentId?: string
): Promise<DriveFile[]> {
  let query = "mimeType = 'application/vnd.google-apps.folder'";
  if (parentId) {
    query = `'${parentId}' in parents and ${query}`;
  } else {
    query = `${query} and 'root' in parents`;
  }

  const params = new URLSearchParams({
    q: query,
    fields: "files(id,name,mimeType)",
    pageSize: "50",
  });

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to list folders");
  }

  const data = await response.json();
  return data.files || [];
}

export async function getFileMetadata(
  accessToken: string,
  fileId: string
): Promise<{
  id: string;
  name: string;
  mimeType: string;
  size: string;
  duration?: number;
}> {
  const params = new URLSearchParams({
    fields: "id,name,mimeType,size,videoMediaMetadata,imageMediaMetadata",
  });

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to get file metadata");
  }

  return response.json();
}

export async function getValidAccessToken(userId: number): Promise<string | null> {
  const supabase = createAdminClient();

  const { data: credentials } = await supabase
    .from("drive_credentials")
    .select("*")
    .eq("user_id", userId)
    .single() as { data: { access_token: string; refresh_token: string; token_expires_at: string } | null };

  if (!credentials) return null;

  const now = new Date();
  const expiresAt = new Date(credentials.token_expires_at);

  if (now < expiresAt) {
    return credentials.access_token;
  }

  // Token expired, refresh it
  try {
    const refreshed = await refreshAccessToken(credentials.refresh_token);
    const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);

    await (supabase
      .from("drive_credentials") as any)
      .update({
        access_token: refreshed.access_token,
        token_expires_at: newExpiresAt.toISOString(),
      })
      .eq("user_id", userId);

    return refreshed.access_token;
  } catch {
    return null;
  }
}
