import test from 'node:test';
import assert from 'node:assert/strict';
import { caretAfterDigits, deleteAcrossSpace, editUzPhone, formatUzLocal, uzPhone, uzPhoneDigits } from '../lib/market/addresses.ts';

test('a stored "+998 …" number keeps only its local digits, even while typing', () => {
  // The checkout form stores "+998 9" after the first digit; reading it back used to show "99 89".
  assert.equal(uzPhoneDigits(uzPhone('9')), '9');
  assert.equal(uzPhoneDigits(uzPhone('901234567')), '901234567');
  assert.equal(uzPhoneDigits('+998901234567'), '901234567');
  assert.equal(uzPhoneDigits('998901234567'), '901234567');
  // A local number that starts with 99 8… is a real Ucell number, not a country code.
  assert.equal(uzPhoneDigits('998901234'), '998901234');
  assert.equal(uzPhoneDigits(''), '');
});

test('typing groups digits and keeps the caret after the same digit', () => {
  assert.deepEqual(editUzPhone('', '9', 1), { digits: '9', caret: 1 });
  assert.deepEqual(editUzPhone('9012', '90 1234', 7), { digits: '901234', caret: 6 });
  // A digit typed in the middle: "90 1|23" + 5 → caret stays after the 5.
  assert.deepEqual(editUzPhone('90123', '90 1523', 5), { digits: '901523', caret: 4 });
  // A tenth digit is ignored instead of pushing the last one out.
  assert.deepEqual(editUzPhone('901234567', '90 123 45 678', 13), { digits: '901234567', caret: 9 });
  // A pasted international number replaces the field.
  assert.deepEqual(editUzPhone('', '+998 93 111 22 33', 17), { digits: '931112233', caret: 9 });
  assert.equal(formatUzLocal('931112233'), '93 111 22 33');
  assert.equal(caretAfterDigits('93 111 22 33', 2), 2);
  assert.equal(caretAfterDigits('93 111 22 33', 3), 4);
  assert.equal(caretAfterDigits('93 111 22 33', 0), 0);
});

test('Backspace and Delete next to a group space remove the neighbouring digit', () => {
  // "90 |123": Backspace removes the 0, not just the space.
  assert.deepEqual(deleteAcrossSpace('90123', '90 123', 3, 'Backspace'), { digits: '9123', caret: 1 });
  // "90| 123": Delete removes the 1.
  assert.deepEqual(deleteAcrossSpace('90123', '90 123', 2, 'Delete'), { digits: '9023', caret: 2 });
  // Not next to a space: the browser handles it.
  assert.equal(deleteAcrossSpace('90123', '90 123', 5, 'Backspace'), null);
});
