// E2E: truth in distribution — every source must carry honest rights/attribution.
import assert from 'node:assert/strict';
import { ArtbitragePipeline } from '../functions/api/pipeline-lib.js';

const pipeline = new ArtbitragePipeline();
const originalFetch = globalThis.fetch;

function mockFetch(url) {
  url = String(url);
  // MET search → ids; MET object → rights fields
  if (url.includes('/search?hasImages=true')) {
    return Response.json({ total: 1, objectIDs: [101] });
  }
  if (url.includes('/public/collection/v1/objects/101')) {
    return Response.json({
      objectID: 101, title: 'Met Love', artistDisplayName: 'Met Artist',
      objectDate: '1900', medium: 'oil', department: 'European',
      primaryImageSmall: 'https://met.test/img.jpg', objectURL: 'https://met.test/101',
      isPublicDomain: true, creditLine: 'Gift of Truth, 1900', rightsAndReproduction: '',
    });
  }
  // ARTIC
  if (url.includes('api.artic.edu')) {
    assert.match(url, /is_public_domain,credit_line/, 'ARTIC must request rights fields');
    return Response.json({ pagination: { total: 1 }, data: [
      { id: 7, title: 'Artic Love', artist_title: 'Artic Artist', date_display: '1901',
        medium_display: 'ink', image_id: 'abc', is_public_domain: false, credit_line: 'Restricted Fund' },
    ]});
  }
  // CMA
  if (url.includes('clevelandart.org')) {
    return Response.json({ info: { total: 1 }, data: [
      { id: 9, title: 'CMA Love', creators: [{ description: 'CMA Artist' }], creation_date: '1902',
        technique: 'wash', images: { web: { url: 'https://cma.test/9.jpg' } },
        share_license_status: 'CC0', creditline: 'Rogers Fund', url: 'https://cma.test/9' },
    ]});
  }
  // Wikimedia
  if (url.includes('commons.wikimedia.org')) {
    return Response.json({ query: { pages: { '1': {
      pageid: 1, title: 'File:Wiki Love.jpg',
      imageinfo: [{ thumburl: 'https://wiki.test/t.jpg', url: 'https://wiki.test/f.jpg',
        descriptionurl: 'https://wiki.test/desc',
        extmetadata: {
          Artist: { value: 'Wiki Artist' },
          LicenseShortName: { value: 'CC BY-SA 4.0' },
          Credit: { value: 'Own work' },
          UsageTerms: { value: 'Creative Commons Attribution-Share Alike 4.0' },
        } }],
    }}}});
  }
  throw new Error('unexpected fetch: ' + url);
}

function assertRights(art, label) {
  assert.ok(art.rights, `${label}: rights object present`);
  assert.ok('public_domain' in art.rights, `${label}: has public_domain`);
  assert.ok('reusable' in art.rights, `${label}: has reusable`);
  assert.ok('license' in art.rights, `${label}: has license`);
  assert.ok('credit' in art.rights, `${label}: has credit`);
  assert.ok(art.rights.note, `${label}: has guidance note`);
}

try {
  globalThis.fetch = mockFetch;

  const met = await pipeline.searchSource('met', 'love', 1);
  assertRights(met.artworks[0], 'met');
  assert.equal(met.artworks[0].rights.public_domain, true);
  assert.equal(met.artworks[0].rights.reusable, true);
  assert.equal(met.artworks[0].rights.license, 'Public Domain');
  assert.match(met.artworks[0].rights.credit, /Gift of Truth/);

  const artic = await pipeline.searchSource('artic', 'love', 1);
  assertRights(artic.artworks[0], 'artic');
  assert.equal(artic.artworks[0].rights.public_domain, false);
  assert.equal(artic.artworks[0].rights.reusable, false);

  const cma = await pipeline.searchSource('cma', 'love', 1);
  assertRights(cma.artworks[0], 'cma');
  assert.equal(cma.artworks[0].rights.reusable, true);
  assert.match(cma.artworks[0].rights.license, /CC0/);

  const wiki = await pipeline.searchSource('wikimedia', 'love', 1);
  assertRights(wiki.artworks[0], 'wikimedia');
  assert.match(wiki.artworks[0].rights.license, /CC BY-SA/);
  // CC BY-SA is shareable-with-attribution; not flagged "public domain reusable" automatically
  assert.equal(wiki.artworks[0].rights.reusable, null);
  assert.equal(wiki.artworks[0].rights.reuse_with_attribution, true, 'CC BY-SA is reusable with attribution');
  assert.match(wiki.artworks[0].rights.note, /attribution/i);

  // Collect rollup across default sources (met, artic, cma, wikimedia)
  const collected = await pipeline.collect('love', 1, 'default', {});
  assert.ok(collected.rights_summary, 'collect has rights_summary');
  const sum = collected.rights_summary;
  assert.equal(sum.reusable, 2, 'met + cma reusable');
  assert.equal(sum.restricted, 1, 'artic restricted');
  assert.equal(sum.unverified, 1, 'wikimedia unverified-license');
  assert.equal(sum.reusable + sum.restricted + sum.unverified, collected.artworks_collected);

  console.log('artbitrage rights e2e passed');
} finally {
  globalThis.fetch = originalFetch;
}
