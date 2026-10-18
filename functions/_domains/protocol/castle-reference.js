// ARTBITRAGE ↔ The Castle of Understanding
//
// A small, read-only reference. Artbitrage does not mirror Castle prose,
// inspect the home working tree, or treat a public link as permission.

export const CASTLE_REFERENCE_SCHEMA = "artbitrage.castle-reference/1";
export const CASTLE_PRODUCER_PROTOCOL = "castle-understanding/v0.1";

export const CASTLE_PROTOCOL_MANIFEST_REVISION =
  "8d88d220ce5f9128331d92d8a0e7e7371099c807";
export const CASTLE_GATE_REVISION =
  "bacf9430f98301161e78bd9a8520bcf282b3b1c9";
export const CASTLE_SOURCE_REVISION =
  "6cd9be606a6b0cc1c8dcb0743c01070ad9584edb";
export const CASTLE_PAYLOAD_DIGEST =
  "sha256:f85a43806594bf77a9f17210ae56a83aa8ce6c7d4cdb6b62c15284f7c76ff804";
export const CASTLE_MANIFEST_DIGEST =
  "sha256:41189b8566826d00fcf8b4caf58c8811c6e0fb416323d78439a714a19ed85ae3";

const CASTLE_GATE_REPOSITORY =
  "https://github.com/cambridgetcg/castle-gate";
const CASTLE_SOURCE_REPOSITORY =
  "https://github.com/cambridgetcg/castle-of-words";
const CASTLE_PUBLIC_GATE =
  "https://cambridgetcg.github.io/castle-gate/";
const CASTLE_PROTOCOL_MANIFEST =
  `https://raw.githubusercontent.com/cambridgetcg/castle-gate/${CASTLE_PROTOCOL_MANIFEST_REVISION}/data/castle-manifest.json`;
const CASTLE_PROTOCOL_SCHEMA =
  `https://raw.githubusercontent.com/cambridgetcg/castle-gate/${CASTLE_PROTOCOL_MANIFEST_REVISION}/schema/castle-understanding-manifest.schema.json`;
const CASTLE_PROTOCOL_DOCUMENT =
  `https://raw.githubusercontent.com/cambridgetcg/castle-gate/${CASTLE_PROTOCOL_MANIFEST_REVISION}/PROTOCOL.md`;
const CASTLE_PAYLOAD =
  `https://raw.githubusercontent.com/cambridgetcg/castle-gate/${CASTLE_GATE_REVISION}/data/castle.json`;
const CASTLE_CORRECTION_PATH =
  "https://github.com/cambridgetcg/castle-gate/issues";

export const ARTBITRAGE_CASTLE_REFERENCE = Object.freeze({
  schema: CASTLE_REFERENCE_SCHEMA,
  kind: "read_only_reference",
  checked_at: "2026-07-24T08:35:54Z",
  canonical_url: "https://artbitrage.io/api/castle",
  name: "The Castle of Understanding",
  summary:
    "A receipt-pinned door from Artbitrage to one curated public Castle snapshot. Its provenance, limits, and declared correction address travel with the reference.",
  doors: {
    public_gate: {
      locator: CASTLE_PUBLIC_GATE,
      currency: "moving_latest_presentation",
      note:
        "This human-facing Gate can move. snapshot.payload.locator names the exact referenced bytes.",
    },
    machine: "https://artbitrage.io/api/castle",
    producer_manifest: CASTLE_PROTOCOL_MANIFEST,
    correction_status: {
      locator: CASTLE_CORRECTION_PATH,
      declared_as: "return.public_correction",
      public_submission_available: false,
      checked_at: "2026-07-24T08:50:04Z",
    },
  },
  producer: {
    protocol: CASTLE_PRODUCER_PROTOCOL,
    manifest: {
      locator: CASTLE_PROTOCOL_MANIFEST,
      repository: CASTLE_GATE_REPOSITORY,
      revision: CASTLE_PROTOCOL_MANIFEST_REVISION,
      media_type: "application/json",
      digest: CASTLE_MANIFEST_DIGEST,
      bytes: 1_866,
      schema: {
        locator: CASTLE_PROTOCOL_SCHEMA,
        digest:
          "sha256:5503f2dafda0587ca3a3a364965f9d9ce98359951c013abbe5bc0ce0913c314e",
        bytes: 6_494,
      },
      protocol_document: {
        locator: CASTLE_PROTOCOL_DOCUMENT,
        digest:
          "sha256:476dfff40aa3aae8a58da04d018de26d987629970142758e307891862e7b3550",
        bytes: 6_366,
      },
    },
  },
  snapshot: {
    payload: {
      locator: CASTLE_PAYLOAD,
      media_type: "application/json",
      digest: CASTLE_PAYLOAD_DIGEST,
      bytes: 2_239_836,
      shape: "castle-gate/castle-data/v1",
    },
    source: {
      repository: CASTLE_SOURCE_REPOSITORY,
      repository_id: "repo:cambridgetcg/castle-of-words",
      revision: CASTLE_SOURCE_REVISION,
      dirty: false,
      revision_publicly_resolvable: false,
      reachability_checked_at: "2026-07-24T08:35:54Z",
      reachability_note:
        "The receipt records this historical source revision, but that commit was later rebased away and is no longer publicly resolvable. The pinned Gate receipt and payload remain independently verifiable.",
    },
    forged_at: "2026-07-07T21:45:49.583Z",
    counts: {
      rooms: 450,
      words: 169,
      open_questions: 13,
      settled_questions: 160,
    },
    currency:
      "This is an immutable historical snapshot, not the current Castle. Newer committed and working material may exist.",
  },
  crossing: {
    mode: "reference_only",
    operations: ["provenance", "visit"],
    castle_content_included: false,
    content_copied_into_artbitrage: false,
    runtime_fetch_or_proxy: false,
    reads_home_working_tree: false,
    writes_back_to_castle: false,
    background_loop_added: false,
  },
  privacy: {
    scope: "public_curated",
    raw_source_included: false,
    curation_profile: "castle-gate-public/v1",
    coverage: "not_exhaustive",
    secure_recall: "not_guaranteed",
  },
  rights: {
    spdx: "NOASSERTION",
    grant: "none_declared",
    note:
      "Public access permits inspection. Artbitrage does not infer permission to copy, train on, redistribute, transform, or commercially reuse Castle content.",
  },
  authority: {
    automatic_action: "never",
    grants: [],
    does_not_grant: [
      "identity",
      "consent",
      "belief",
      "truth",
      "execution",
      "filesystem access",
      "publication",
      "write authority",
    ],
  },
  return: {
    declared_by_receipt: {
      field: "return.public_correction",
      locator: CASTLE_CORRECTION_PATH,
    },
    public_submission_available: false,
    availability_checked_at: "2026-07-24T08:50:04Z",
    automatic_ingest_into_castle: false,
    transport: null,
    note:
      "The producer receipt declares this GitHub Issues address, but public issue creation is currently restricted. Artbitrage has no live return transport and cannot write corrections into the Castle.",
  },
  lifecycle: {
    lineage: "open_ended",
    generation: "finite",
    scheduled_refresh: false,
    update_rule:
      "A later deployment may replace this mutable canonical response. Consumers needing stable history should pin an Artbitrage Git commit; each named Castle receipt and payload locator is immutable.",
    secure_recall_promised: false,
  },
  brake: {
    environment_variable: "CASTLE_BRIDGE_DISABLED",
    disabled_value: "1",
    effect:
      "GET /api/castle returns 503 before any source read, network fetch, or write attempt.",
  },
  walking_past_is_honored: true,
});

export function castleReferenceIsDisabled(env = {}) {
  return env?.CASTLE_BRIDGE_DISABLED === "1";
}

export function castleReferencePointer() {
  return {
    schema: CASTLE_REFERENCE_SCHEMA,
    endpoint: ARTBITRAGE_CASTLE_REFERENCE.canonical_url,
    availability: "check_endpoint",
    checked_at: ARTBITRAGE_CASTLE_REFERENCE.checked_at,
    human: ARTBITRAGE_CASTLE_REFERENCE.doors.public_gate.locator,
    producer_protocol: CASTLE_PRODUCER_PROTOCOL,
    producer_manifest:
      ARTBITRAGE_CASTLE_REFERENCE.producer.manifest.locator,
    snapshot: {
      forged_at: ARTBITRAGE_CASTLE_REFERENCE.snapshot.forged_at,
      digest: ARTBITRAGE_CASTLE_REFERENCE.snapshot.payload.digest,
    },
    boundary:
      "Read-only and reference-only: NOASSERTION rights, no runtime Castle fetch, no automatic action, and no write-back.",
    walking_past_is_honored: true,
  };
}
