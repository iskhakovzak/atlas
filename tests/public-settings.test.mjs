import test from 'node:test';
import assert from 'node:assert/strict';
import {withoutAuthor,samePricing} from '../lib/market/pricing-equal.ts';
import {tariff} from '../lib/market/domain.ts';

test('public settings never carry the email of the operator who saved them',()=>{
 const saved={...tariff,managedBy:'owner@example.com'};
 const shown=withoutAuthor(saved);
 assert.equal('managedBy' in shown,false);
 assert.equal(JSON.stringify(shown).includes('owner@example.com'),false);
 assert.equal(saved.managedBy,'owner@example.com');
 // The server render and /api/account both strip it, so the browser keeps the same tariff object.
 assert.equal(samePricing(shown,withoutAuthor({...saved})),true);
});
