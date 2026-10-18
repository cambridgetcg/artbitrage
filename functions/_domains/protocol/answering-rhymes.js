// Answering Rhyme statements: validate, normalise and witness a portable
// reciprocity statement. Nothing is stored, authenticated or applied.
import { json } from '../../_kernel/http.js';
import { canonicalJson, sha256 } from '../../_kernel/hash.js';
import { ANSWERING_RHYME_STATEMENT_ACTIONS } from './agent-manifest.js';

export const ANSWERING_RHYME_STATEMENT_PATH = "/api/answering-rhymes/statements";
const ANSWERING_RHYME_STATEMENT_SCHEMA = "answering-rhyme.statement/1";
const ANSWERING_RHYME_STATEMENT_WITNESS_SCHEMA = "artbitrage.answering-rhyme-statement-witness/1";
const ANSWERING_RHYME_STATEMENT_ERROR_SCHEMA = "artbitrage.answering-rhyme-statement-error/1";
const ANSWERING_RHYME_STATEMENT_CANONICALIZATION = "answering-rhyme.canonical-json/1";
const ANSWERING_RHYME_STATEMENT_MAX_BYTES = 16384;
const ANSWERING_RHYME_URL_LIMIT = 12;
const ANSWERING_RHYME_STATEMENT_FIELDS = new Set([
  "schema",
  "canonicalization",
  "relation_key",
  "target_revision",
  "kind",
  "body",
  "language",
  "declared_by",
  "declared_at",
  "in_response_to",
  "evidence_urls",
  "authority_evidence_urls",
]);
const ANSWERING_RHYME_DECLARER_FIELDS = new Set(["label", "claimed_role", "canonical_url"]);
const ANSWERING_RHYME_CLAIMED_ROLES = new Set([
  "viewer",
  "relation-curator",
  "card-rights-holder",
  "artwork-rights-holder",
  "source-institution",
  "other",
]);
const ANSWERING_RHYME_KINDS = new Set(Object.keys(ANSWERING_RHYME_STATEMENT_ACTIONS));
const SHA256_ID = /^sha256:[0-9a-f]{64}$/;
const UNSAFE_STATEMENT_CONTROL = /[\u0000-\u001f\u007f-\u009f]/u;
// LF is intentionally allowed only in statement bodies after CRLF/lone-CR
// normalization; every other C0/C1 control is rejected.
const UNSAFE_STATEMENT_BODY_CONTROL = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/u;
const NORMALIZED_UTC_TIMESTAMP = /^(?!0000-)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function isJsonObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function statementIssue(path, code, message) {
  return { path, code, message };
}

function hasUnpairedSurrogate(value) {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function unicodeScalarLength(value) {
  return Array.from(value).length;
}

function normalizeStatementText(value, path, issues, { max, required = true, body = false } = {}) {
  if (typeof value !== 'string') {
    issues.push(statementIssue(path, 'wrong_type', 'must be a string'));
    return '';
  }
  if (hasUnpairedSurrogate(value)) {
    issues.push(statementIssue(path, 'invalid_format', 'Unpaired UTF-16 surrogates are not permitted.'));
    return '';
  }
  const lineNormalized = body ? value.replace(/\r\n?/g, '\n') : value;
  const normalized = lineNormalized.normalize('NFC').trim();
  if (required && !normalized) {
    issues.push(statementIssue(path, 'required', 'must not be empty'));
  }
  if (max && unicodeScalarLength(normalized) > max) {
    issues.push(statementIssue(path, 'too_long', `must be at most ${max} characters`));
  }
  const unsafeControl = body ? UNSAFE_STATEMENT_BODY_CONTROL : UNSAFE_STATEMENT_CONTROL;
  if (unsafeControl.test(normalized)) {
    issues.push(statementIssue(path, 'control_character', 'contains a disallowed control character'));
  }
  return normalized;
}

function rejectUnknownFields(value, allowed, path, issues) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      issues.push(statementIssue(`${path}.${key}`, 'unknown_field', 'is not part of answering-rhyme.statement/1'));
    }
  }
}

function normalizeHttpsUrl(value, path, issues, { nullable = false } = {}) {
  if (nullable && (value === undefined || value === null)) return null;
  if (typeof value === 'string' && hasUnpairedSurrogate(value)) {
    issues.push(statementIssue(path, 'invalid_format', 'Unpaired UTF-16 surrogates are not permitted in URLs.'));
    return '';
  }
  const normalized = normalizeStatementText(value, path, issues);
  if (!normalized) return normalized;
  if (unicodeScalarLength(normalized) > 1000) {
    issues.push(statementIssue(path, 'too_long', 'URL must be at most 1000 characters before serialization'));
    return normalized;
  }
  if (/\s/u.test(normalized)) {
    issues.push(statementIssue(path, 'invalid_url', 'URL must not contain whitespace'));
    return normalized;
  }
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
      issues.push(statementIssue(path, 'invalid_url', 'must be an HTTPS URL without embedded credentials'));
      return normalized;
    }
    const canonical = parsed.toString().normalize('NFC');
    if (unicodeScalarLength(canonical) > 1000) {
      issues.push(statementIssue(path, 'too_long', 'serialized URL must be at most 1000 characters'));
    }
    return canonical;
  } catch {
    issues.push(statementIssue(path, 'invalid_url', 'must be an absolute HTTPS URL'));
  }
  return normalized;
}

function normalizeHttpsUrlList(value, path, issues) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    issues.push(statementIssue(path, 'wrong_type', 'must be an array of HTTPS URLs'));
    return [];
  }
  if (value.length > ANSWERING_RHYME_URL_LIMIT) {
    issues.push(statementIssue(path, 'too_many_items', `must contain at most ${ANSWERING_RHYME_URL_LIMIT} URLs`));
  }
  const normalized = value
    .slice(0, ANSWERING_RHYME_URL_LIMIT)
    .map((url, index) => normalizeHttpsUrl(url, `${path}[${index}]`, issues));
  return [...new Set(normalized.filter(Boolean))].sort();
}

function normalizeDeclaredAt(value, issues) {
  const path = '$.declared_at';
  const normalized = normalizeStatementText(value, path, issues, { max: 40 });
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/.exec(normalized);
  if (!match) {
    issues.push(statementIssue(path, 'invalid_rfc3339', 'must be RFC3339 with an explicit Z or numeric offset'));
    return normalized;
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , zone] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysByMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const zoneHour = zone === 'Z' ? 0 : Number(zone.slice(1, 3));
  const zoneMinute = zone === 'Z' ? 0 : Number(zone.slice(4, 6));
  if (
    year < 1
    || month < 1 || month > 12
    || day < 1 || day > (daysByMonth[month - 1] || 0)
    || hour > 23 || minute > 59 || second > 59
    || zoneHour > 23 || zoneMinute > 59
  ) {
    issues.push(statementIssue(path, 'invalid_rfc3339', 'contains an out-of-range date, time, or offset'));
    return normalized;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    issues.push(statementIssue(path, 'invalid_rfc3339', 'could not be normalized to UTC'));
    return normalized;
  }
  const normalizedUtc = parsed.toISOString();
  if (!NORMALIZED_UTC_TIMESTAMP.test(normalizedUtc)) {
    issues.push(statementIssue(
      path,
      'invalid_rfc3339',
      'offset crosses the supported UTC year range 0001-9999',
    ));
    return normalized;
  }
  return normalizedUtc;
}

export function normalizeAnsweringRhymeStatement(value) {
  const issues = [];
  if (!isJsonObject(value)) {
    return {
      issues: [statementIssue('$', 'wrong_type', 'must be a JSON object')],
      statement: null,
    };
  }
  rejectUnknownFields(value, ANSWERING_RHYME_STATEMENT_FIELDS, '$', issues);

  const schema = normalizeStatementText(value.schema, '$.schema', issues, { max: 80 });
  if (schema && schema !== ANSWERING_RHYME_STATEMENT_SCHEMA) {
    issues.push(statementIssue('$.schema', 'unsupported_schema', `must equal ${ANSWERING_RHYME_STATEMENT_SCHEMA}`));
  }

  const canonicalization = normalizeStatementText(value.canonicalization, '$.canonicalization', issues, { max: 80 });
  if (canonicalization && canonicalization !== ANSWERING_RHYME_STATEMENT_CANONICALIZATION) {
    issues.push(statementIssue('$.canonicalization', 'unsupported_canonicalization', `must equal ${ANSWERING_RHYME_STATEMENT_CANONICALIZATION}`));
  }

  const relationKey = normalizeStatementText(value.relation_key, '$.relation_key', issues, { max: 256 });
  const targetRevision = normalizeStatementText(value.target_revision, '$.target_revision', issues, { max: 100 });

  const kind = normalizeStatementText(value.kind, '$.kind', issues, { max: 32 }).toLowerCase();
  if (kind && !ANSWERING_RHYME_KINDS.has(kind)) {
    issues.push(statementIssue('$.kind', 'unsupported_kind', 'must be bless, contextualize, correct, or withdraw'));
  }

  const body = normalizeStatementText(value.body, '$.body', issues, { max: 2000, body: true });

  let language = 'und';
  if (value.language !== undefined) {
    language = normalizeStatementText(value.language, '$.language', issues, { max: 35 }).toLowerCase();
    if (language && !/^(?:und|[a-z]{2,8}(?:-[a-z0-9]{1,8})*)$/.test(language)) {
      issues.push(statementIssue('$.language', 'invalid_language', 'must be und or a simple BCP 47 language tag'));
    }
  }

  let declaredBy = { label: '', claimed_role: '', canonical_url: null };
  if (!isJsonObject(value.declared_by)) {
    issues.push(statementIssue('$.declared_by', 'wrong_type', 'must be an object'));
  } else {
    rejectUnknownFields(value.declared_by, ANSWERING_RHYME_DECLARER_FIELDS, '$.declared_by', issues);
    const label = normalizeStatementText(value.declared_by.label, '$.declared_by.label', issues, { max: 160 });
    const claimedRole = normalizeStatementText(value.declared_by.claimed_role, '$.declared_by.claimed_role', issues, { max: 40 }).toLowerCase();
    if (claimedRole && !ANSWERING_RHYME_CLAIMED_ROLES.has(claimedRole)) {
      issues.push(statementIssue('$.declared_by.claimed_role', 'unsupported_role', 'is not an allowed self-declared role'));
    }
    const canonicalUrl = normalizeHttpsUrl(
      value.declared_by.canonical_url,
      '$.declared_by.canonical_url',
      issues,
      { nullable: true },
    );
    declaredBy = { label, claimed_role: claimedRole, canonical_url: canonicalUrl };
  }

  const declaredAt = normalizeDeclaredAt(value.declared_at, issues);

  let inResponseTo = null;
  if (value.in_response_to !== undefined && value.in_response_to !== null) {
    inResponseTo = normalizeStatementText(
      value.in_response_to,
      '$.in_response_to',
      issues,
      { max: 71 },
    ).toLowerCase();
    if (inResponseTo && !SHA256_ID.test(inResponseTo)) {
      issues.push(statementIssue(
        '$.in_response_to',
        'invalid_hash',
        'must normalize to sha256: followed by 64 lowercase hexadecimal characters, or null',
      ));
    }
  }

  const evidenceUrls = normalizeHttpsUrlList(value.evidence_urls, '$.evidence_urls', issues);
  const authorityEvidenceUrls = normalizeHttpsUrlList(
    value.authority_evidence_urls,
    '$.authority_evidence_urls',
    issues,
  );

  return {
    issues,
    statement: {
      schema: ANSWERING_RHYME_STATEMENT_SCHEMA,
      canonicalization: ANSWERING_RHYME_STATEMENT_CANONICALIZATION,
      relation_key: relationKey,
      target_revision: targetRevision,
      kind,
      body,
      language,
      declared_by: declaredBy,
      declared_at: declaredAt,
      in_response_to: inResponseTo,
      evidence_urls: evidenceUrls,
      authority_evidence_urls: authorityEvidenceUrls,
    },
  };
}

export async function buildAnsweringRhymeStatementWitness(statement) {
  const digest = await sha256(canonicalJson(statement));
  const contentHash = `sha256:${digest}`;
  const validationWarnings = [];
  if (statement.declared_by.claimed_role !== 'viewer' && statement.declared_by.claimed_role !== 'other') {
    validationWarnings.push({
      path: 'declared_by.claimed_role',
      code: 'authority_is_self_declared',
      message: 'The role is carried as a self-declaration only; neither witness system verifies it.',
    });
  }
  if (statement.kind === 'correct' && statement.evidence_urls.length === 0) {
    validationWarnings.push({
      path: 'evidence_urls',
      code: 'evidence_missing',
      message: 'The correction can be witnessed, but separate curator review needs evidence before applying it.',
    });
  }
  if (statement.kind === 'withdraw' && statement.authority_evidence_urls.length === 0) {
    validationWarnings.push({
      path: 'authority_evidence_urls',
      code: 'evidence_missing',
      message: 'The withdrawal can be witnessed, but it cannot affect presentation without separately verified authority.',
    });
  }
  return {
    schema: ANSWERING_RHYME_STATEMENT_WITNESS_SCHEMA,
    statement_schema: ANSWERING_RHYME_STATEMENT_SCHEMA,
    canonicalization: ANSWERING_RHYME_STATEMENT_CANONICALIZATION,
    content_hash: contentHash,
    witnessed_at: new Date().toISOString(),
    statement,
    validated: true,
    validation_warnings: validationWarnings,
    replay_detection: false,
    uniqueness_not_asserted: true,
    authenticated: false,
    identity_verified: false,
    authority_status: 'self-declared-unverified',
    target_status: 'not-checked',
    target_check: {
      fetched: false,
      note: 'Artbitrage does not own the Cambridge relation corpus and does not fetch it during validation. target_revision is hash-covered so a receiver can reject a statement prepared against a different revision.',
    },
    authority_evidence: {
      received: statement.authority_evidence_urls.length,
      fetched: false,
      verified: false,
      note: 'URLs are carried as claims only. This endpoint never fetches them and does not authenticate the declarer or verify authority.',
    },
    persisted: false,
    persistence: {
      status: 'not-persisted-by-application',
      retrievable_url: null,
      note: 'No application record is created and no statement URL is issued. The caller must carry this unsigned receipt. This does not promise that infrastructure providers keep no ordinary access or security logs.',
    },
    authoritative_effect: 'none',
    issuer_attestation: {
      signed: false,
      independently_verifiable: false,
      note: 'witnessed_at is an unattested server observation, not durable proof that Artbitrage issued this receipt.',
    },
    consequence: ANSWERING_RHYME_STATEMENT_ACTIONS[statement.kind].consequence,
    effects: {
      published_relation_changed: false,
      rights_or_license_changed: false,
      content_hidden_or_deleted: false,
      operator_or_sibling_notified: false,
    },
    portability: {
      signed: false,
      recomputable: true,
      note: 'Recompute content_hash from the normalized statement using the published canonicalization version. The stateless endpoint cannot detect replay or assert uniqueness, and possession of this receipt is not proof of identity, authority, or issuer.',
    },
  };
}

export function answeringRhymeStatementError(error, message, status, issues = []) {
  return json({
    schema: ANSWERING_RHYME_STATEMENT_ERROR_SCHEMA,
    error,
    message,
    issues,
    authenticated: false,
    identity_verified: false,
    persisted: false,
    authoritative_effect: 'none',
  }, status, {
    'Cache-Control': 'no-store, max-age=0',
    Pragma: 'no-cache',
  });
}

export async function readAnsweringRhymeStatementRequest(request) {
  const contentType = request.headers.get('content-type');
  const supportedContentType = contentType !== null
    && /^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?\s*$/i.test(contentType);
  if (!supportedContentType) {
    return {
      error: answeringRhymeStatementError(
        'unsupported_media_type',
        'Content-Type must be application/json; an optional UTF-8 charset parameter is accepted.',
        415,
      ),
    };
  }
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > ANSWERING_RHYME_STATEMENT_MAX_BYTES) {
    return {
      error: answeringRhymeStatementError(
        'request_too_large',
        `Request body must not exceed ${ANSWERING_RHYME_STATEMENT_MAX_BYTES} bytes.`,
        413,
      ),
    };
  }
  if (!request.body) {
    return {
      error: answeringRhymeStatementError('invalid_json', 'Request body must be valid JSON.', 400),
    };
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let byteLength = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > ANSWERING_RHYME_STATEMENT_MAX_BYTES) {
        try { await reader.cancel('answering-rhyme statement exceeds the request limit'); } catch {}
        return {
          error: answeringRhymeStatementError(
            'request_too_large',
            `Request body must not exceed ${ANSWERING_RHYME_STATEMENT_MAX_BYTES} bytes.`,
            413,
          ),
        };
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch {
    try { await reader.cancel('invalid UTF-8 request body'); } catch {}
    return {
      error: answeringRhymeStatementError(
        'invalid_encoding',
        'Request body must be valid UTF-8 JSON.',
        400,
      ),
    };
  } finally {
    try { reader.releaseLock(); } catch {}
  }
  try {
    return { value: JSON.parse(text) };
  } catch {
    return {
      error: answeringRhymeStatementError('invalid_json', 'Request body must be valid JSON.', 400),
    };
  }
}
