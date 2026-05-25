/**
 * Batch attach audio for a set of MP3s (upload to R2 + set file_url/file_key/duration).
 *
 *   node scripts/seed/attach-batch.mjs --dry-run   # read-only dedup report, no writes
 *   node scripts/seed/attach-batch.mjs             # upload + attach/create tracks
 *   node scripts/seed/attach-batch.mjs --force     # re-upload even if track already has audio
 *
 * Dedup: each target is normalized (lowercased, parentheticals/feat/diacritics stripped)
 * and matched against EVERY existing track (title + artist names from track_artists,
 * artist_id, and the legacy `artist` string). All full-table fetches paginate via
 * .range() because Supabase silently caps a single response at 1000 rows.
 *
 * No genre is set on created tracks (owner adds genres later). Created tracks are NOT
 * added to any playlist here.
 */
import { readFileSync, existsSync } from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { parseBuffer } from "music-metadata";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const DEFAULT_DURATION_MS = 180000;

const D = "C:\\Users\\lenovo\\Downloads\\";

// title + artists are my best read of each file; the matcher tolerates formatting drift.
// `done: true` marks the two already attached in a prior session (Before You Go, One Call Away).
const TARGETS = [
  { file: D + "Gotye - Somebody That I Used To Know (feat. Kimbra) [Official Music Video] - Gotye.mp3", title: "Somebody That I Used to Know", artists: ["Gotye", "Kimbra"] },
  { file: D + "Lewis Capaldi - Before You Go (Official Video) - LewisCapaldiVEVO.mp3", title: "Before You Go", artists: ["Lewis Capaldi"], done: true },
  { file: D + "Foster The People - Sit Next to Me (Audio) - fosterthepeopleVEVO.mp3", title: "Sit Next to Me", artists: ["Foster the People"] },
  { file: D + "I Think They Call This Love (Cover) - Matthew Ifield.mp3", title: "I Think They Call This Love", artists: ["Matthew Ifield"] },
  { file: D + "Florence + The Machine - Dog Days Are Over (2010 Version) (Official Music Video) - FlorenceMachineVEVO.mp3", title: "Dog Days Are Over", artists: ["Florence + the Machine"] },
  { file: D + "Full Video Wo Ladki Hai Kahan  Dil Chahta Hai  Saif Ali Khan, Sonali Kulkarni - T-Series.mp3", title: "Woh Ladki Hai Kahan", artists: ["Shaan", "Kavita Krishnamurthy"] },
  { file: D + "Main Aisa Kyun Hoon Full Video - LakshyaHrithik Roshan, Preity ZintaShaanJaved Akhtar - SonyMusicIndiaVEVO.mp3", title: "Main Aisa Kyun Hoon", artists: ["Shaan"] },
  { file: D + "Charlie Puth - One Call Away [Official Video] - Charlie Puth.mp3", title: "One Call Away", artists: ["Charlie Puth"], done: true },
  { file: D + "Eminem - The Way I Am (Dirty Version) - EminemExplicit.mp3", title: "The Way I Am", artists: ["Eminem"] },
  { file: D + "Avicii, Sandro Cavazza - Without You “Audio” - AviciiOfficialVEVO.mp3", title: "Without You", artists: ["Avicii", "Sandro Cavazza"] },
  { file: D + "Sufjan Stevens - Mystery of Love (From Call Me By Your Name Soundtrack) - SonySoundtracksVEVO.mp3", title: "Mystery of Love", artists: ["Sufjan Stevens"] },
  { file: D + "Halsey - Without Me - HalseyVEVO.mp3", title: "Without Me", artists: ["Halsey"] },
  { file: D + "Marshmello ft. Khalid - Silence (Official Lyric Video) - Marshmello.mp3", title: "Silence", artists: ["Marshmello", "Khalid"] },
  { file: D + "Mark Ronson - Nothing Breaks Like a Heart (Official Video) ft. Miley Cyrus - MarkRonsonVEVO.mp3", title: "Nothing Breaks Like a Heart", artists: ["Mark Ronson", "Miley Cyrus"] },
  { file: D + "FINNEAS - Let's Fall in Love for the Night (Official Video) - FINNEAS.mp3", title: "Let's Fall in Love for the Night", artists: ["FINNEAS"] },
  { file: D + "Shakira - Hips Don't Lie (featuring Wyclef Jean) (Official 4K Video) ft. Wyclef Jean - shakiraVEVO.mp3", title: "Hips Don't Lie", artists: ["Shakira", "Wyclef Jean"] },
  { file: D + "MIKA - Grace Kelly - MIKAVEVO.mp3", title: "Grace Kelly", artists: ["MIKA"] },
  { file: D + "Juan Magan - Baila Conmigo ft. Luciana (Video Oficial) - JuanMaganVEVO.mp3", title: "Baila Conmigo", artists: ["Juan Magan", "Luciana"] },
  { file: D + "Can't Get It Out of My Head (2012 Version) - Electric Light Orchestra.mp3", title: "Can't Get It Out of My Head", artists: ["Electric Light Orchestra"] },
  { file: D + "Jaiye Sajana (Lyrical) Dhurandhar The Revenge  Ranveer Singh Shashwat Sachdev,Jasmine S,Satinder S - T-Series.mp3", title: "Jaiye Sajana", artists: ["Jasmine Sandlas", "Satinder Sartaaj", "Shashwat Sachdev"] },
  { file: D + "Tchaikovsky - pas de deux - Musica Clásica.mp3", title: "Pas de Deux", artists: ["Tchaikovsky"] },
  { file: D + "Hozier - Too Sweet (Official Lyric Video) - Hozier.mp3", title: "Too Sweet", artists: ["Hozier"] },
  { file: D + "Way Back Into Love - Hugh Grant.mp3", title: "Way Back into Love", artists: ["Hugh Grant", "Haley Bennett"] },
  { file: D + "Empire Of The Sun - We Are The People (Official Music Video) - empireofthesunvevo.mp3", title: "We Are the People", artists: ["Empire of the Sun"] },
  { file: D + "The Pretty Reckless - For I Am Death __ Life Evermore Pt.2 (Official Music Video) - The Pretty Reckless.mp3", title: "For I Am Death / Life Evermore Pt.2", artists: ["The Pretty Reckless"] },
  { file: D + "The Nobodies - Marilyn Manson.mp3", title: "The Nobodies", artists: ["Marilyn Manson"] },
  { file: D + "YUNGBLUD - Zombie (Official Music Video) - YUNGBLUDVEVO.mp3", title: "Zombie", artists: ["YUNGBLUD"] },
  { file: D + "The Cranberries - Zombie (Official Music Video) - TheCranberriesVEVO.mp3", title: "Zombie", artists: ["The Cranberries"] },
  { file: D + "Hanson - MMMBop (Lyrics)  BUGG Lyrics - BUGG Lyrics.mp3", title: "MMMBop", artists: ["Hanson"] },
  { file: D + "Niall Horan - On The Loose (Lyrics) - AyeLyrics.mp3", title: "On the Loose", artists: ["Niall Horan"] },
  { file: D + "Niall Horan - Slow Hands (Lyrics) - AyeLyrics.mp3", title: "Slow Hands", artists: ["Niall Horan"] },
  { file: D + "The Script - Rain (Official Video) - TheScriptVEVO.mp3", title: "Rain", artists: ["The Script"] },
  { file: D + "Harry Styles - Adore You (Lyrics) - 7clouds.mp3", title: "Adore You", artists: ["Harry Styles"] },
  { file: D + "Harry Styles - Sign of the Times (Lyrics) - 7clouds.mp3", title: "Sign of the Times", artists: ["Harry Styles"] },
  { file: D + "PARTYNEXTDOOR, Drake, Yebba - DIE TRYING - PARTYNEXTDOORVEVO.mp3", title: "Die Trying", artists: ["PARTYNEXTDOOR", "Drake", "Yebba"] },
  { file: D + "Vieil Amour - Milmine.mp3", title: "Vieil Amour", artists: ["Milmine"] },
  { file: D + "Altered State Of Mind - Milmine.mp3", title: "Altered State of Mind", artists: ["Milmine"] },
  { file: D + "The Proclaimers - I'm Gonna Be (500 Miles) (Official Music Video) - Dig!.mp3", title: "I'm Gonna Be (500 Miles)", artists: ["The Proclaimers"] },
  { file: D + "Lie To Me - Chris Isaak.mp3", title: "Lie to Me", artists: ["Chris Isaak"] },
  { file: D + "5 Seconds of Summer - Lie To Me (Audio) ft. Julia Michaels - 5SOSVEVO.mp3", title: "Lie to Me", artists: ["5 Seconds of Summer", "Julia Michaels"] },
  { file: D + "Old Sea Brigade & Luke Sital-Singh - Call Me When You Land [Official Music Video] - NettwerkMusic.mp3", title: "Call Me When You Land", artists: ["Old Sea Brigade", "Luke Sital-Singh"] },
  { file: D + "Peach Pit - Give Up Baby Go (Official Video) - PeachPitVEVO.mp3", title: "Give Up Baby Go", artists: ["Peach Pit"] },
  { file: D + "The Shadowboxers - HONEYMOON  (Official Audio) - The Shadowboxers.mp3", title: "Honeymoon", artists: ["The Shadowboxers"] },
  { file: D + "In Case I Fall For You (Instrumental) - Black Sea Dahu.mp3", title: "In Case I Fall for You", artists: ["Black Sea Dahu"] },
];

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL } = process.env;
for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "R2_PUBLIC_URL"]) {
  if (!process.env[k]) { console.error(`Missing env var: ${k}`); process.exit(1); }
}

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

const slugify = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .replace(/\(.*?\)|\[.*?\]/g, " ").replace(/\bfeat\.?\b.*$/g, " ").replace(/&/g, " and ")
  .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const normTitleNoThe = (s) => norm(s).replace(/^the /, "");

async function fetchAll(table, columns) {
  const PAGE = 1000; let from = 0; const out = [];
  for (;;) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data || []));
    if ((data?.length ?? 0) < PAGE) break;
    from += PAGE;
  }
  return out;
}

async function buildIndex() {
  const [tracks, artists, ta] = await Promise.all([
    fetchAll("tracks", "id, title, artist_id, artist, file_url"),
    fetchAll("artists", "id, name, slug"),
    fetchAll("track_artists", "track_id, artist_id"),
  ]);
  const artistName = new Map(artists.map((a) => [a.id, a.name]));
  const trackArtistIds = new Map();
  for (const row of ta) {
    if (!trackArtistIds.has(row.track_id)) trackArtistIds.set(row.track_id, new Set());
    trackArtistIds.get(row.track_id).add(row.artist_id);
  }
  const index = tracks.map((t) => {
    const names = new Set();
    for (const aid of trackArtistIds.get(t.id) || []) if (artistName.has(aid)) names.add(norm(artistName.get(aid)));
    if (t.artist_id && artistName.has(t.artist_id)) names.add(norm(artistName.get(t.artist_id)));
    if (t.artist) names.add(norm(t.artist));
    return { id: t.id, title: t.title, file_url: t.file_url, nTitle: norm(t.title), nTitleNoThe: normTitleNoThe(t.title), artistNames: names };
  });
  return { index, artists, counts: { tracks: tracks.length, artists: artists.length, trackArtists: ta.length } };
}

function matchTarget(target, index) {
  const nt = norm(target.title), ntn = normTitleNoThe(target.title);
  const targetArtists = target.artists.map(norm);
  const titleHits = index.filter((t) => t.nTitle === nt || t.nTitleNoThe === ntn);
  const confident = titleHits.filter((t) => targetArtists.some((a) => t.artistNames.has(a)));
  return { confident, titleOnly: titleHits.filter((t) => !confident.includes(t)) };
}

async function findOrCreateArtist(name) {
  const clean = name.trim();
  const slug = slugify(clean) || "unknown";
  const { data: ex } = await supabase.from("artists").select("id").eq("slug", slug).maybeSingle();
  if (ex) return ex.id;
  const { data, error } = await supabase.from("artists").insert({ name: clean, slug }).select("id").single();
  if (error) { const { data: again } = await supabase.from("artists").select("id").eq("slug", slug).maybeSingle(); if (again) return again.id; throw error; }
  return data.id;
}

async function dryRun() {
  console.log(`\n=== DRY RUN — no writes ===`);
  const { index, counts } = await buildIndex();
  console.log(`DB: ${counts.tracks} tracks, ${counts.artists} artists, ${counts.trackArtists} track_artists links\n`);
  let nNew = 0, nExist = 0, nAmbig = 0;
  for (const t of TARGETS) {
    const onDisk = existsSync(t.file);
    const { confident, titleOnly } = matchTarget(t, index);
    let verdict;
    if (confident.length) {
      const withAudio = confident.filter((c) => c.file_url);
      verdict = `EXISTS  #${confident.map((c) => c.id).join(",")} ${withAudio.length ? "(has audio)" : "(no audio → will attach)"}`;
      nExist++;
    } else if (titleOnly.length) {
      verdict = `TITLE-ONLY match #${titleOnly.map((c) => `${c.id}:"${c.title}"`).join(", ")} — artist differs, REVIEW`;
      nAmbig++;
    } else {
      verdict = "NEW → will create";
      nNew++;
    }
    const flags = [t.done ? "[prior-done]" : "", onDisk ? "" : "[FILE MISSING]"].filter(Boolean).join(" ");
    console.log(`• ${t.title} — ${t.artists.join(", ")}  ${flags}\n    ${verdict}`);
  }
  console.log(`\nSummary: ${nNew} new, ${nExist} already exist, ${nAmbig} title-only (review). Total ${TARGETS.length}.`);
}

async function realRun() {
  console.log(`\n=== ATTACH RUN ${FORCE ? "(force)" : ""} ===`);
  const { index } = await buildIndex();
  for (const t of TARGETS) {
    console.log(`\n── ${t.title} — ${t.artists.join(", ")} ──`);
    if (!existsSync(t.file)) { console.error(`  SKIP: file not found: ${t.file}`); continue; }
    const { confident } = matchTarget(t, index);
    const existing = confident[0];
    if (existing?.file_url && !FORCE) { console.log(`  already has audio (#${existing.id}); skip. Use --force to re-upload.`); continue; }

    const buffer = readFileSync(t.file);
    let durationMs = DEFAULT_DURATION_MS;
    try { const meta = await parseBuffer(buffer, { mimeType: "audio/mpeg" }); if (meta.format.duration) durationMs = Math.round(meta.format.duration * 1000); } catch {}

    const primarySlug = slugify(t.artists[0] || "unknown") || "unknown";
    const key = `music/${primarySlug}/${slugify(t.title)}.mp3`;
    const fileUrl = `${R2_PUBLIC_URL}/${key}`;
    await r2.send(new PutObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key, Body: buffer, ContentType: "audio/mpeg" }));
    console.log(`  uploaded → ${fileUrl} (${(buffer.length / 1024 / 1024).toFixed(2)} MB, ${(durationMs / 1000).toFixed(0)}s)`);
    const audio = { file_key: key, file_url: fileUrl, file_size_bytes: buffer.length, mime_type: "audio/mpeg", duration_ms: durationMs };

    if (existing) {
      const { error } = await supabase.from("tracks").update(audio).eq("id", existing.id);
      if (error) { console.error(`  update failed: ${error.message}`); continue; }
      console.log(`  attached to existing track #${existing.id}`);
    } else {
      const artistIds = [];
      for (const n of t.artists) artistIds.push(await findOrCreateArtist(n));
      const { data: track, error } = await supabase.from("tracks").insert({ title: t.title, artist_id: artistIds[0] ?? null, ...audio }).select("id").single();
      if (error) { console.error(`  create failed: ${error.message}`); continue; }
      const rows = artistIds.map((aid, i) => ({ track_id: track.id, artist_id: aid, role: i === 0 ? "primary" : "featured", position: i }));
      await supabase.from("track_artists").insert(rows);
      console.log(`  created track #${track.id} (artists: ${t.artists.join(", ")}; no genre; no playlist)`);
    }
  }
  console.log("\nDone.");
}

(DRY_RUN ? dryRun() : realRun()).catch((e) => { console.error("attach-batch failed:", e); process.exit(1); });
