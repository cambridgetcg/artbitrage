// Truth in distribution: every record must carry honest rights/attribution.
// Loving distribution names its sources; it never quietly appropriates.
// One copy, used by search, the pipeline and the museum catalogue.
import { compactText } from './params.js';

export function buildRights({ publicDomain = null, license = '', credit = '', statement = '' } = {}) {
  const lic = compactText(license, 80);
  const freelyReusable = publicDomain === true
    || /^(cc0|public domain|pd|no known copyright)/i.test(lic);
  const ccAttribution = /cc[ -]?by/i.test(lic);
  let note;
  if (freelyReusable) {
    note = 'Open/public-domain per source; still attribute the creator and source out of care.';
  } else if (ccAttribution) {
    note = `Reusable under ${lic} with attribution (and share-alike if noted); credit the creator and source.`;
  } else if (publicDomain === false) {
    note = 'Rights restricted per source — do not reuse without permission; link to the source instead.';
  } else {
    note = 'Rights unverified — check the source URL before reuse.';
  }
  return {
    public_domain: publicDomain,
    license: lic || (publicDomain === true ? 'Public Domain' : ''),
    credit: compactText(credit, 240),
    rights_statement: compactText(statement, 240),
    reusable: freelyReusable ? true : (publicDomain === false ? false : null),
    reuse_with_attribution: ccAttribution || freelyReusable,
    note,
  };
}

export function normalizeCatalogRights(record) {
  const original = record.rights && typeof record.rights === 'object' ? record.rights : {};
  const declaredLicense = compactText(original.license || record.license || '', 120);
  const declaredPublicDomain = typeof original.public_domain === 'boolean'
    ? original.public_domain
    : (/^(?:cc0)(?:\b|\s*\/)/i.test(declaredLicense)
      || /^public domain(?:\b|\s*\/)/i.test(declaredLicense)
      ? true
      : null);
  const normalized = buildRights({
    publicDomain: declaredPublicDomain,
    license: declaredLicense,
    credit: original.credit || '',
    statement: original.rights_statement || '',
  });
  return {
    ...original,
    ...normalized,
    status: declaredLicense ? 'source-declared' : 'unverified',
    license_verified: false,
    source_url: record.url || null,
    note: declaredLicense
      ? 'License label is preserved from the source catalogue and has not been independently verified by Artbitrage; confirm it at the source URL before reuse.'
      : 'No license is recorded. Public visibility permits viewing only and does not grant reuse, remix, training, or commercial permission.',
  };
}
