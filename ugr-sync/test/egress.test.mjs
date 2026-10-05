import test from 'node:test';
import assert from 'node:assert/strict';
import { urlEgressCampusPermitida } from '../lib/egress.mjs';

test('egress: permite virtual.ugr.edu.ar', () => {
  const url = urlEgressCampusPermitida('https://virtual.ugr.edu.ar/mod/assign/view.php?id=1');
  assert.ok(url?.includes('virtual.ugr.edu.ar'));
});

test('egress: bloquea redirect a terceros', () => {
  assert.equal(urlEgressCampusPermitida('https://evil.example/phish'), null);
});
