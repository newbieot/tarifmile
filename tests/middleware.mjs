import assert from 'node:assert/strict';
import { onRequest } from '../functions/_middleware.js';

const redirected = await onRequest({
  request: new Request('https://tarifmile.pages.dev/contoh/rute?mode=uji'),
  next() { throw new Error('Legacy host must not continue to static assets.'); },
});

assert.equal(redirected.status, 301);
assert.equal(redirected.headers.get('location'), 'https://tarif.posnew.com/contoh/rute?mode=uji');

let continued = false;
const canonical = await onRequest({
  request: new Request('https://tarif.posnew.com/contoh/rute?mode=uji'),
  next() {
    continued = true;
    return new Response('ok', { status: 200 });
  },
});

assert.equal(continued, true);
assert.equal(canonical.status, 200);
console.log('2 pemeriksaan middleware lulus.');
