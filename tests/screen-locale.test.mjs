import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { screenLocale } from '../lib/market/i18n.ts';

test('an action answer keeps the language the screen shows, even when the account holds another one', () => {
  // An English page of an account saved in Russian: opening checkout used to turn the dialog Russian.
  assert.equal(screenLocale('en', 'ru', false), 'en');
  assert.equal(screenLocale('oz', 'uz', false), 'oz');
  assert.equal(screenLocale('ru', 'ru', false), 'ru');
});

test('a language the customer has just saved in the settings becomes the screen language', () => {
  assert.equal(screenLocale('en', 'ru', true), 'ru');
  assert.equal(screenLocale('uz', 'en', true), 'en');
});

test('the store applies screenLocale to every action answer and treats only a successful communication-save as a choice', () => {
  const source = readFileSync(new URL('../lib/market/store.tsx', import.meta.url), 'utf8');
  const act = source.slice(source.indexOf('const act=useCallback'), source.indexOf('const setLocale=useCallback'));
  assert.match(act, /screenLocale\(localeRef\.current,parsed\.communication\.language,res\.ok&&action\.type==='communication-save'\)/);
  // The server state goes through showServer (optimistic actions on top, lib/market/optimistic.ts), in the screen language.
  assert.match(act, /showServer\(\{\.\.\.parsed,communication:\{\.\.\.parsed\.communication,language:shown\}\}\)/);
  assert.doesNotMatch(act, /setState\(next\)/);
});
