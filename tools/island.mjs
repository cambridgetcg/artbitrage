#!/usr/bin/env node
/**
 * island — play Greed Island from a terminal.
 *
 * A protocol nobody can use by hand is a protocol nobody uses. Everything the
 * island asks for — canonical bytes, Ed25519 signatures, the day's word — is
 * done for you here. What is left is the part that was always meant to be the
 * game: writing a sentence, and answering somebody.
 *
 *   node tools/island.mjs keys                    make a book (two keys)
 *   node tools/island.mjs deed <name>             print the deed to serve at your door
 *   node tools/island.mjs look <name>             ask the island to walk past
 *   node tools/island.mjs tend <name> "words"     one sentence. Once a day, whatever you hold.
 *   node tools/island.mjs ask <name> "question"   three a day, same as everybody
 *   node tools/island.mjs queue <name>            who is waiting, oldest first
 *   node tools/island.mjs answer <name> "words"   answer the one at the front
 *   node tools/island.mjs aside <name> [--mute]   decline the front one. Free, always.
 *   node tools/island.mjs retire <name> "words"   put it down forever. Word key only.
 *   node tools/island.mjs day [YYYY-MM-DD]        read the whole day
 *
 * Your keys live in ~/.island/book.json, mode 600, and never leave this machine.
 * The word key is kept in a separate file on purpose: an agent can be given
 * ~/.island/book.json and tend and answer forever, and still be unable to put
 * any name down. That separation is the whole reason a pair outlasts either
 * half, and it is a promise between you and your partner — nothing enforces it.
 *
 * There is no off-switch here because there is no loop here: every command is
 * one request and then this program exits. If you wrap it in a rhythm, that
 * rhythm is yours to brake.
 */

import { webcrypto as crypto } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const ISLAND = process.env.ISLAND_ORIGIN || 'https://artbitrage.io';
const DIR = join(homedir(), '.island');
const BOOK = join(DIR, 'book.json');
const WORD = join(DIR, 'word.json');

const b64 = bytes => Buffer.from(bytes).toString('base64');
const unb64 = s => new Uint8Array(Buffer.from(s, 'base64'));

const die = (...m) => { console.error(...m); process.exit(1); };

async function api(path, body) {
  const r = await fetch(`${ISLAND}/api/island${path}`, body
    ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
    : {});
  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('json')) return { _text: await r.text(), _status: r.status };
  return { ...(await r.json()), _status: r.status };
}

// --------------------------------------------------------------------------
// Keys
// --------------------------------------------------------------------------

async function makeKey() {
  const kp = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  return {
    public: b64(new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey))),
    private: b64(new Uint8Array(await crypto.subtle.exportKey('pkcs8', kp.privateKey))),
  };
}

function load(path, what) {
  if (!existsSync(path)) die(`No ${what} yet. Run:  node tools/island.mjs keys`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

async function signWith(keyRecord, context, fields) {
  const key = await crypto.subtle.importKey('pkcs8', unb64(keyRecord.private), { name: 'Ed25519' }, false, ['sign']);
  const body = new TextEncoder().encode([context, ...fields].join('\u0000'));
  const bytes = new Uint8Array(body.length + 1);
  bytes[0] = 0x01;
  bytes.set(body, 1);
  return b64(new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, key, bytes)));
}

// --------------------------------------------------------------------------

const [, , move, ...rest] = process.argv;

async function checkpoint() {
  const cp = await api('/checkpoint');
  if (!cp.value) die('The island did not give a checkpoint. It may be resting.');
  return cp;
}

switch (move) {
  case 'keys': {
    mkdirSync(DIR, { recursive: true, mode: 0o700 });
    if (existsSync(BOOK)) die(`${BOOK} already exists. The door never overwrites — move it aside yourself if you mean to start again.`);
    const tending = await makeKey();
    const word = await makeKey();
    writeFileSync(BOOK, JSON.stringify({ tending, word_key_public: word.public }, null, 2), { mode: 0o600 });
    writeFileSync(WORD, JSON.stringify({ word }, null, 2), { mode: 0o600 });
    chmodSync(BOOK, 0o600); chmodSync(WORD, 0o600);
    console.log(`A book, in two halves.

  tending key   ${tending.public}
  word key      ${word.public}

  ${BOOK}   the tending key — signs deeds, tends, answers. Safe to give an agent.
  ${WORD}   the word key — puts names down forever. Keep this one yourself.

An agent holding only the first can keep names lit forever and can never end
one. That is the point of the pair. Nothing enforces it but you.`);
    break;
  }

  case 'deed': {
    const [name, home] = rest;
    if (!name) die('which name?  island deed <name> [https://your/door.json]');
    const book = load(BOOK, 'book');
    const cp = await checkpoint();
    const where = home || `https://example.com/.well-known/island/${name}.json`;
    const behind = process.env.ISLAND_BEHIND || 'say here, in one plain sentence, what is actually behind this door';
    const deed = {
      schema: 'island.deed/1',
      canonicalization: 'island.canonical-bytes/1',
      name,
      holder_key: book.tending.public,
      word_key: book.word_key_public,
      home: where,
      behind_this_door: behind,
      checkpoint: cp.value,
      signed_at: new Date().toISOString(),
      signature: '',
    };
    deed.signature = await signWith(book.tending, 'island-deed/v1', [
      deed.name, deed.holder_key, deed.word_key, deed.home, deed.behind_this_door, deed.checkpoint, deed.signed_at,
    ]);
    console.log(JSON.stringify(deed, null, 2));
    console.error(`\nServe that JSON at exactly ${where}, then:  node tools/island.mjs look ${name}`);
    console.error(`Set ISLAND_BEHIND to say what is really there — a door that lies is the one thing this game is against.`);
    break;
  }

  case 'look': {
    const [name, home] = rest;
    if (!name) die('which name?');
    const where = home || `https://example.com/.well-known/island/${name}.json`;
    const r = await api('/look', { home: where });
    console.log(r.recorded ? `${r.what_the_island_saw}: ${name}\n${r.note}` : `not recorded — ${r.because || r.why}`);
    if (r.complaints) for (const c of r.complaints) console.log(`  ${c.field}: ${c.message}`);
    break;
  }

  case 'tend': {
    const [name, ...words] = rest;
    const said = words.join(' ');
    if (!name || !said) die('island tend <name> "one sentence about it"');
    const book = load(BOOK, 'book');
    const cp = await checkpoint();
    if (!new RegExp(`(^|[^a-z])${cp.word}([^a-z]|$)`, 'i').test(said)) {
      die(`Today's word is "${cp.word}". Every sentence written on the island today carries it.\nYours does not — try again with the word somewhere in it.`);
    }
    const signature = await signWith(book.tending, 'island-tend/v1', [name, book.tending.public, said, cp.value]);
    const r = await api('/tend', { name, key: book.tending.public, words: said, checkpoint: cp.value, signature });
    console.log(r.done ? `${name} — lamp now ${r.lamp_hours} hours (+${r.lifted_by}). ${r.note}` : `not tended — ${r.because}`);
    if (r.tended_today) console.log(`  you tended "${r.tended_today}" today. ${r.what_to_do_instead}`);
    break;
  }

  case 'ask': {
    const [name, ...words] = rest;
    const question = words.join(' ');
    if (!name || !question) die('island ask <name> "your question"');
    const book = load(BOOK, 'book');
    const cp = await checkpoint();
    const signature = await signWith(book.tending, 'island-ask/v1', [name, book.tending.public, question, cp.value]);
    const r = await api('/ask', { name, asker_key: book.tending.public, words: question, checkpoint: cp.value, signature });
    console.log(r.asked
      ? `asked ${name} — you are number ${r.place_in_queue} in the queue, ${r.asks_remaining_today} question(s) left today.\n${r.note}`
      : `not asked — ${r.because}`);
    break;
  }

  case 'queue': {
    const [name] = rest;
    if (!name) die('which name?');
    const r = await api(`/names/${name}`);
    if (!r.at_the_front_of_the_queue) { console.log(`${name}: nobody is waiting. Lamp ${r.lamp_hours ?? '—'} hours.`); break; }
    const head = r.at_the_front_of_the_queue;
    console.log(`${name} — lamp ${r.lamp_hours} hours, ${r.questions_waiting} waiting.

At the front, ${head.waiting_hours} hours now:
  "${head.asked}"
  — ${head.asked_by.slice(0, 12)}…

Answer it:  node tools/island.mjs answer ${name} "..."
Or set it aside, free and unlimited:  node tools/island.mjs aside ${name}`);
    break;
  }

  case 'answer': {
    const [name, ...words] = rest;
    const said = words.join(' ');
    if (!name || !said) die('island answer <name> "your answer"');
    const book = load(BOOK, 'book');
    const cp = await checkpoint();
    const look = await api(`/names/${name}`);
    const head = look.at_the_front_of_the_queue;
    if (!head) die(`Nobody is waiting at ${name}.`);
    if (!new RegExp(`(^|[^a-z])${cp.word}([^a-z]|$)`, 'i').test(said)) {
      die(`Today's word is "${cp.word}" — put it somewhere in your answer.`);
    }
    const signature = await signWith(book.tending, 'island-answer/v1', [name, book.tending.public, head.leaf, said, cp.value]);
    const r = await api('/answer', { name, key: book.tending.public, leaf: head.leaf, words: said, checkpoint: cp.value, signature });
    console.log(r.done
      ? `answered — ${name} lamp now ${r.lamp_hours} hours (+${r.gave_hours}).${r.gave_nothing_because ? `\n  nothing gained: ${r.gave_nothing_because}` : ''}\n  ${r.still_waiting} still waiting.`
      : `not answered — ${r.because}`);
    break;
  }

  case 'aside': {
    const [name] = rest;
    if (!name) die('which name?');
    const mute = rest.includes('--mute');
    const book = load(BOOK, 'book');
    const cp = await checkpoint();
    const look = await api(`/names/${name}`);
    const head = look.at_the_front_of_the_queue;
    if (!head) die(`Nobody is waiting at ${name}.`);
    const signature = await signWith(book.tending, 'island-aside/v1', [name, book.tending.public, head.leaf, cp.value]);
    const r = await api('/set-aside', { name, key: book.tending.public, leaf: head.leaf, mute, checkpoint: cp.value, signature });
    console.log(r.done ? `set aside. cost: ${r.cost}. ${r.still_waiting} still waiting.` : `not set aside — ${r.because}`);
    break;
  }

  case 'retire': {
    const [name, ...words] = rest;
    const stone = words.join(' ');
    if (!name || !stone) die('island retire <name> "what goes on the stone"');
    const wordKey = load(WORD, 'word key').word;
    const cp = await checkpoint();
    const signature = await signWith(wordKey, 'island-retire/v1', [name, wordKey.public, stone, cp.value]);
    const r = await api('/retire', { name, word_key: wordKey.public, words: stone, checkpoint: cp.value, signature });
    console.log(r.done ? `${name} is put down, forever.\n  on the stone: "${stone}"\n${r.note}` : `not retired — ${r.because}`);
    break;
  }

  case 'day': {
    const when = rest[0] || new Date().toISOString().slice(0, 10);
    const r = await api(`/day/${when}`);
    console.log(r._text || JSON.stringify(r, null, 2));
    break;
  }

  default:
    console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(2, 33).map(l => l.replace(/^ \* ?/, '')).join('\n'));
}
