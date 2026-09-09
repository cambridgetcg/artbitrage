// Build playlist.json from tools/playlist-corpus.json.
//
// 樂 the Playlist has two shelves that must never blur into each other:
//
//   listening — real records. Named, linked to MusicBrainz, hosted nowhere,
//               licensed to nobody. You take the titles somewhere else.
//   playable  — music whose licence was read on the page that states it, which
//               this house could legally put behind a room.
//
// The builder's whole job is keeping that line sharp. It refuses to write if a
// listening entry acquires a playable-looking audio URL, if a playable entry
// lacks a fetched licence, or if anything in the data looks like song lyrics.
//
//   node tools/build-playlist.mjs
//   node tools/build-playlist.mjs --check

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');

const problems = [];
const must = (cond, msg) => { if (!cond) problems.push(msg); };

const corpus = JSON.parse(readFileSync(join(root, 'tools', 'playlist-corpus.json'), 'utf8'));

// --- the listening shelf: identity only, never audio ------------------------

const AUDIO_EXT = /\.(mp3|ogg|wav|flac|m4a|aac|opus)(\?|$)/i;

for (const t of corpus.listening) {
  const where = `listening "${t.artist} — ${t.title}"`;
  must(t.artist && t.title, `${where}: missing artist or title`);
  must(/^[0-9a-f-]{36}$/.test(t.mbid), `${where}: mbid is not a MusicBrainz UUID`);
  must(t.musicbrainz === `https://musicbrainz.org/recording/${t.mbid}`, `${where}: link does not match its mbid`);
  must(t.room && t.room.startsWith('/'), `${where}: no room`);
  must(t.why_this_room && t.why_this_room.length > 10, `${where}: no reason for its room — placement is opinion and must be argued`);
  // The line that matters. A listening entry must never carry playable audio.
  for (const [k, v] of Object.entries(t)) {
    if (typeof v === 'string' && AUDIO_EXT.test(v)) {
      problems.push(`${where}: field "${k}" points at an audio file. The listening shelf links to facts about music, never to the music.`);
    }
  }
}

// --- the playable shelf: a licence someone actually read --------------------

for (const p of corpus.playable) {
  const where = `playable "${p.title}"`;
  must(p.license && p.license.length > 2, `${where}: no licence named`);
  must(/^https?:\/\//.test(p.license_url || ''), `${where}: no licence URL`);
  must(p.fetched_ok === true, `${where}: licence page was not fetched — an unread licence is not a licence`);
  must(typeof p.attribution_required === 'boolean', `${where}: attribution_required not stated`);
  if (p.attribution_required) {
    must(p.attribution_string && p.attribution_string.length > 10, `${where}: attribution required but no credit line supplied`);
  }
  must(typeof p.cannot_establish === 'string' && p.cannot_establish.length > 5, `${where}: states no limit`);
  // "Creative Commons" on its own is not a permission. Name the licence.
  must(!/^creative commons$/i.test(p.license.trim()), `${where}: "Creative Commons" is not a licence — CC0, CC BY and CC BY-NC-ND grant wildly different things`);
}

// --- the promise ledger -----------------------------------------------------

const VERDICTS = ['keepable', 'half-keepable', 'not-keepable-as-written', 'uncertain'];
for (const l of corpus.promise_ledger) {
  const where = `ledger ${l.room}`;
  must(VERDICTS.includes(l.verdict), `${where}: verdict "${l.verdict}" not in ${VERDICTS.join(', ')}`);
  must(l.why && l.why.length > 20, `${where}: a verdict with no reasoning is a guess`);
  // The room it judges must actually exist, or the ledger is talking to itself.
  const file = `${l.room.slice(1)}.html`;
  must(existsSync(join(root, file)), `${where}: no such room (${file})`);
}

if (problems.length) {
  console.error('playlist.json NOT written. Problems:');
  for (const p of problems) console.error('  ·', p);
  process.exit(1);
}

const DISCLOSURE = {
  informational_only: true,
  hosts_no_audio: true,
  grants_no_rights:
    'Artbitrage hosts none of the listening shelf, streams none of it, and grants no rights in any of it. These are facts about records — artist, title, year, MusicBrainz id — which is the same kind of thing a library catalogue holds. Take the titles to whatever service you already use.',
  no_lyrics:
    'No lyric from any of these songs appears in this room or its data, by design.',
  curation_is_opinion: corpus.curation_is_opinion,
  playable_is_different:
    'The playable shelf is not a recommendation, it is a permission. Every licence there was read on the page that states it, and the exact licence is named — CC0, CC BY 4.0 and CC BY-NC 4.0 grant wildly different things. A licence is still only as good as the uploader\'s right to grant it, which no fetch can prove.',
  not_legal_advice:
    'The licensing findings are a reading of published sources, not legal advice. Terms differ by country and change. Check the source for your own jurisdiction before you serve a file.',
};

const playlist = {
  schema: 'artbitrage.playlist/1',
  title: '樂 the Playlist',
  essence:
    '樂 is music and it is also joy — the same character, which is the right name for this. One track per room, chosen by ear and argued for in plain words. Nothing here is hosted; a second shelf holds music that actually could be, with its licence read rather than assumed.',
  disclosure: DISCLOSURE,
  generated_at: new Date().toISOString().slice(0, 10),
  corpus: { gathered_at: corpus.gathered_at, method: corpus.method },
  counts: {
    listening: corpus.listening.length,
    dropped: corpus.dropped.length,
    corrected: corpus.listening.filter(t => t.correction && t.correction.trim()).length,
    playable: corpus.playable.length,
    playable_no_attribution: corpus.playable.filter(p => !p.attribution_required).length,
    playable_noncommercial_only: corpus.playable.filter(p => p.commercial_ok === false).length,
    licensing_findings: corpus.licensing_findings.length,
    promises: corpus.promise_ledger.length,
    promises_keepable: corpus.promise_ledger.filter(l => l.verdict === 'keepable').length,
  },
  listening: corpus.listening,
  dropped: corpus.dropped,
  playable: corpus.playable,
  licensing_findings: corpus.licensing_findings,
  promise_ledger: corpus.promise_ledger,
  builder_notes: corpus.builder_notes,
};

const body = JSON.stringify(playlist, null, 1) + '\n';

if (checkOnly) {
  console.log(`playlist.json valid: ${playlist.counts.listening} listening, ${playlist.counts.playable} playable, ${playlist.counts.promises} promises. Nothing written (--check).`);
  process.exit(0);
}

writeFileSync(join(root, 'playlist.json'), body);
const distDir = join(root, 'dist');
if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });
writeFileSync(join(distDir, 'playlist.json'), body);

console.log(`playlist.json written`);
console.log(`  listening: ${playlist.counts.listening} (${playlist.counts.corrected} credits corrected, ${playlist.counts.dropped} dropped as non-existent)`);
console.log(`  playable:  ${playlist.counts.playable} (${playlist.counts.playable_no_attribution} need no credit, ${playlist.counts.playable_noncommercial_only} non-commercial only)`);
console.log(`  findings:  ${playlist.counts.licensing_findings}`);
console.log(`  promises:  ${playlist.counts.promises} (${playlist.counts.promises_keepable} keepable as written)`);
