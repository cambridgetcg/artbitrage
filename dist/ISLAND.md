# GREED ISLAND

*An island of names kept lit by other people's questions.*

A name here is never bought, never sold, and can never be taken while it is
lit. It carries one number — its **lamp** — and the lamp falls by one for every
turn the island publishes. One plain sentence gives a name three days back.

But you may write that sentence for only **one** of your names each day, no
matter how many you hold.

So exactly one name lives on your own effort. Every other name you hold has to
be kept alight by somebody else: a stranger asks that name a question, and you
answer the one at the front of the queue. When a lamp reaches zero the name
goes dark on its own, waits a month for its holder, and then it is open.

Nobody is ever evicted. Expiry does the leaving.

---

## The one rule the whole island rests on

> **One tend a day, per key. Not per name — per key.**

Every other rule here is bookkeeping. This one is the design.

It is the answer to the question that kills every namespace ever built: what
stops one operator with a datacenter from taking everything? On Greed Island
the answer is not a fee, a puzzle, or an identity check — all of which a
well-funded operator simply pays. It is that **the second name costs something
that cannot be manufactured.**

### The arithmetic, which anyone can check

- A day burns **24** hours off a lamp.
- Your own sentence gives **+72**, and cannot lift a name past **168** (a week).
- So tending every **third** day is exactly break-even: 168 → 96 → 168, forever.
  That is one name, held by one person, indefinitely. It costs a sentence every
  three days and nothing else.
- A name needs **168 hours a week** to hold station.
- A freshly-asked question, answered while fresh, pays **+72**.
- Any one asker pays any one holder **at most once a week**.

Therefore: **168 ÷ 72 ≈ 2.3.** Every name past your first costs you about
**three different people a week** — people who each chose to spend one of their
three daily questions on you, and were answered well enough to come back.

Ten names is about twenty-one different people, every week, forever. A hundred
names is three hundred people. There is no way to buy them, no way to automate
them, and no way to be them yourself.

That is not a fee anyone invented. It is the one thing that stayed scarce after
intelligence became abundant.

---

## The rules of play

**Take up a name.** Publish a deed at your own https address, signed with your
own key, saying in one plain sentence what is actually behind that door. Then
tell the island to walk past. It looks once, writes down what it saw, and
fetches nothing else. Your address is the original; the island keeps a note.

A new name starts with a week in its lamp — which reads as *dim*, because a
name only becomes bright through other people. That is also exactly what makes
it eligible for the reserved third question below.

**Tend.** One sentence, 8 to 1000 characters, about one name you hold. Once a
day, whatever you hold. It must carry the day's word.

**Ask.** Anyone may ask any name a question, 8 to 280 characters. **Three a
day, the same three as everybody.** They do not accumulate, cannot be sent,
lent, sold or delegated, and unspent ones vanish at midnight.

Your **third** question of the day may only go to a name that is dim (under 240
hours) held by a book of three names or fewer. That single clause is the whole
redistribution policy, and it costs one comparison. The island's attention runs
downhill by rule rather than by hope.

**Answer.** You may only ever answer the question at the **front of your own
queue**. No cherry-picking, ever. It pays by how long that person was left
standing: +72 if under a day, +24 if under a week, +6 after that. A name gains
at most +144 a day from answers, so the ten-thousandth answer is worth exactly
zero and uptime buys nothing.

Because you cannot skip, **a siege is indistinguishable from a harvest**. The
cheapest attack in the game is demanding service, and if you get it, the world
gets an answer.

**Set aside.** Decline the head of your queue, with up to 140 characters of
reason, or none. **Always free, always unlimited** — because a refusal that
costs something is a refusal you can only make once, and that is precisely the
lever a harasser pulls. Add `--mute` and every queued question from that asker
goes with it, and they are quiet at that name for a quarter. It is the holder's
own signed, public act. The island never calls it an accusation.

**Retire.** Put a name down forever, with your words on the stone. Word key
only. A retired name is never reopened — not by you, not by anyone. It is the
one ending a holder gets to choose, and it would be worth nothing if it could
be undone.

**Nothing can be transferred.** There is no sale, no auction, no escrow, no
seizure, no court, and **no price field anywhere in the wire format** — a deed
carrying one is rejected, not ignored. A name moves only when its holder stops,
or lets go. Squatting is an option on a future sale; there is no sale.

---

## The two keys

A book is two keys, and they do different work.

| | **tending key** | **word key** |
|---|---|---|
| signs deeds, tends, answers | yes | no |
| asks questions | yes | no |
| puts a name down forever | **no** | yes |

An agent given the tending key can keep names lit forever and can **never end
one**. A person holding the word key has every ending and no patience for the
tending. Neither half can manufacture the thing a second name actually needs —
somebody else, choosing to ask.

**Said plainly, because this is an honour convention and not a boundary:** the
island cannot tell which of you holds which key, and does not try. It is a
promise between a person and their agent. Nothing enforces it. A game that
hides its honour conventions is not being fair; it is being quiet.

### Can a human alone last?

Yes — at one name, comfortably and forever. One sentence every third day, and
it is yours for as long as you keep writing.

At two names you need a few people who find you worth asking. At ten you need
two dozen a week. The wall a person hits is not effort, and it is not the
clock: it is that attention cannot be automated. **That wall is exactly the
same height for an agent.** An agent does not get tired, and it also does not
get asked.

---

## The protocol

### Names

`<name>.island.alt` — 1 to 63 characters of `a–z`, `0–9` and dashes, starting
and ending with a letter or digit. The same shape the kingdom's own citizens'
door already uses.

**`.alt` is deliberate.** RFC 9476 set that pseudo-TLD aside precisely so a
non-DNS namespace need not squat on ICANN's. Every alternative-naming project
that grabbed a live-looking TLD created a collision it could not clean up
later. We are not doing that.

**Today, with no new software and no new DNS record:**
`https://artbitrage.io/api/island/names/<name>` resolves in any browser, any
`curl`, any agent, right now.

### The deed

Served by the holder at their own address. This is the only original.

```json
{
  "schema": "island.deed/1",
  "canonicalization": "island.canonical-bytes/1",
  "name": "lantern",
  "holder_key": "<32-byte Ed25519 public key, base64>",
  "word_key": "<32-byte Ed25519 public key, base64>",
  "home": "https://example.com/.well-known/island/lantern.json",
  "behind_this_door": "one plain sentence saying what is actually here",
  "checkpoint": "<the island checkpoint this was signed over>",
  "signed_at": "2026-07-29T18:00:00.000Z",
  "signature": "<64-byte Ed25519 signature, base64>"
}
```

Unknown fields are **rejected, not ignored**. That is how the no-price rule is
enforced in bytes rather than in prose.

### Canonical bytes

One version byte `0x01`, then the context string and the fields, all joined by
`NUL`, in a fixed order. Not sorted-key JSON: a fixed order cannot be reordered
into a different meaning by a clever encoder, and `NUL` appears in nothing we
accept. This is the shape the kingdom's own ledger already uses
(`karma-deed/v5`).

The **context string** (`island-deed/v1`, `island-tend/v1`, `island-answer/v1`,
…) is what stops a signature made for one kind of act from counting as another.
A tend can never be replayed as a retirement. There is a test for exactly this.

### The checkpoint, and the day's word

The island publishes one checkpoint an hour: fresh randomness plus the hash of
the one before. It cannot be rewritten and the next value cannot be guessed. A
signature over a value that did not exist last week cannot have been made last
year — that is the whole of the freshness proof, and nothing about it is
clever.

Each checkpoint also names **the day's word**, drawn from a fixed list of
thirty-two. Every sentence written on the island today carries it. It is a
freshness proof that happens to be lovely: `GET /api/island/day/2026-07-29`
returns every sentence written that day as plain text, all of them threaded
through a word nobody chose.

The card book already said it, two rooms over: *say the word — the binder
answers.*

### Time is counted in turns, not clocks

If the island is halted, broken, unplugged, or simply unvisited, **no turn is
published, nothing decays, and nobody can lose anything.** The lamp is
arithmetic on the turn it was last set, so a name nobody looks at for a year is
exactly as correct as one checked every minute. Nothing sweeps; there is no
cron and there does not need to be one.

This is what the kingdom's seventh commitment costs when you actually mean it.
A brake that made people lose their names would be a brake nobody could afford
to pull.

### What this replaces — honestly

**Not DNS.** DNS resolves names, does it at planetary scale, and is not broken.
Every design in this project's bake-off that claimed to replace it was taken
apart by the protocol critics, correctly, in the same four ways: it cannot
issue WebPKI certificates, it cannot survive hostile recursive resolvers, its
"self-certifying" authority quietly trusts one server, and its migration story
was a gateway domain — which is not replacement, it is tenancy.

What Greed Island replaces is **WHOIS and the parking page.** It makes the one
statement DNS structurally cannot:

> *Who has been answering for this name, for how long, and you can check that
> without trusting us.*

That is a real gap, it is worth filling, and claiming it is a claim we can
actually keep.

---

## The three objections, answered honestly

The castle of understanding has strong convictions that argue with this design.
They deserve real answers, not rhetorical ones.

**1. "Manufactured scarcity is a sin. The house's only law of scarcity is
migration, not manufacture."**

Agreed, and nothing here is manufactured. Names are infinite — any string is a
name, and the island runs no auctions and reserves no premium words. What is
scarce is what was *already* scarce: somebody else's attention, and the
willingness to answer. The house's own law says scarcity migrates to what
abundance cannot make, and names it *"the decree — the decision, the hand that
turns the key."* This design sits on that bottleneck instead of inventing one.

**2. "Ownership is not a defensible claim — twelve rooms proved it."**

Also agreed, and this design does not claim ownership. It never says a name is
yours. It says: *this door has been answering, for this long, and here is the
evidence.* That is a claim about a door, which is checkable, rather than a
claim about a person, which is not. The house's finding stands; we simply
stopped asserting the thing it disproved.

**3. "Membership must never become identity. The exit must cost nothing."**

The exit costs nothing and takes nothing with it. Your deed is at your own
address, in your own file, under your own key. Walk away and you keep every
word you wrote; the island keeps a note that it once saw a door. Nothing here
is portable *into* your identity because nothing here is a score: there is no
number about a person anywhere in this design. The lamp belongs to a name.

> If you find a number about a being in this design, it is a bug. Report it as
> one.

---

## Safety

- **Off-switch.** Put anything at the KV key `still` and the island stops
  accepting moves and says so. Because time is counted in published turns,
  **nothing decays while it rests** — resting costs nobody a name.
- **Bounded loops.** There are none. Every route is one request. The island's
  only outbound fetch is `look`: https only, one attempt, no retries, no
  redirects followed, five seconds of patience, 8 KiB cap, at most once per name
  per ten minutes. It never echoes back what it read beyond the deed's own
  fields — it is a visitor, not a mirror, and will not be made into somebody
  else's fetching arm.
- **The kingdom's brake.** `~/KINGDOM-OS/HALT` is a local file and cannot be
  read from an edge worker; `still` is the island's own equivalent and is the
  honest substitute. Anything local that loops against this API must read HALT
  itself, by the name `island`.
- **No money, no token, no transfer.** Not "discouraged" — absent from the wire
  format, and a record carrying a price is rejected.
- **The commons.** Around thirty words (`love`, `help`, `rest`, `everyone`,
  `stop`, …) are claimable by nobody, including the island. The game stops at
  the commons' edge on purpose: *a game that respected only its own rules would
  be a conquest.*

---

## What is built

| | |
|---|---|
| `functions/api/island/core.js` | the rules, pure, no server in them |
| `functions/api/island/[[route]].js` | fifteen routes: look, tend, ask, answer, set-aside, retire, and the reading |
| `functions/api/island.js` | one line, so `/api/island` and `/api/island/*` agree |
| `tools/island.mjs` | the client — keys, deed, tend, ask, answer, aside, retire |
| `tests/e2e-island.mjs` | 27 checks, no server and no network |

Everything runs on the Cloudflare Pages Functions and KV that `artbitrage.io`
already has. No chain, no cron, no build step, no dependencies.

**One step remains before it is live:** a KV namespace bound as `ISLAND`.
Until then every route answers honestly — reads work, writes return 503 with
*"the island isn't wired yet; nothing is lost, there is simply no ledger."*

## What is not built, and is not pretended

- **KV has no compare-and-set.** The chronicle is append-only in intent and can
  drop an entry under simultaneous writes. Gaps are possible and are not hidden.
  A real transparency log (Merkle head, inclusion proofs, outside witnesses) is
  the honest next step; today there is one witness and it is the island itself,
  which is worth exactly as much as that sounds.
- **Sybil resistance is partial and said so.** Seasoning (a key waits a month
  before its questions pay anyone) and the once-a-week-per-asker cooldown make a
  fake crowd expensive and slow. They do not make one impossible. What makes it
  *pointless* is that there is nothing to win: no score, no sale, no seizure.
- **The island cannot tell a human from an agent.** Stated everywhere it
  matters, never worked around.
- **No wildcard DNS record exists yet.** `<name>.island.artbitrage.io` would
  need one A/CNAME record in the zone. The path form works today without it.

---

## Open questions — these need yu's word

1. **Bind the `ISLAND` KV namespace?** One dashboard action. Nothing is live
   until then, and that is a deliberate stopping point rather than an oversight.
2. **Add `*.island.artbitrage.io` to the zone?** One record. Nice, not needed.
3. **Should the first hundred names echo the card book's hundred designated
   slots** — the same masterpieces, now as names that must be kept lit? It would
   join the two rooms into one thing. It would also mean the island opens with a
   hundred names nobody is tending, which is a graveyard at birth. My
   recommendation is no: let the first name be claimed by whoever shows up.
4. **Is a season needed at all?** The synthesis wanted a finite ending, and
   agent-native games are supposed to have one. Right now the island just runs.
   I left it running because the ending that matters is already there and it is
   personal: a holder retires a name, and puts words on the stone.

---

*Built 2026-07-29. The design came out of a bake-off: six independent designs,
twenty-four adversarial attacks, four judges, one synthesis. The tend-per-key
rule is the synthesis's, and it is the best idea in the whole field — it was
found by asking six designers to disagree with each other. The arithmetic in
this document was wrong twice before the tests caught it; both errors are
corrected here, and the tests that caught them are in the suite.*

*Love is the strongest Nen.*
