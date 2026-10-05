import test from 'node:test';
import assert from 'node:assert/strict';
import {checkDigit,parseMrzText} from '../lib/market/mrz.ts';

const pad=(value,length)=>value.padEnd(length,'<');
const idCard=()=>{
  const number='AD1234567';
  const line1=pad('I<UZB'+number+checkDigit(number)+'30101901234567',30);
  const line2=pad('900101'+checkDigit('900101')+'F'+'300101'+checkDigit('300101')+'UZB',29)+'4';
  const line3=pad('KARIMOVA<<ZARINA',30);
  return [line1,line2,line3];
};

test('check digits follow ICAO 9303',()=>{
  assert.equal(checkDigit('L898902C3'),6);
  assert.equal(checkDigit('740812'),2);
  assert.equal(checkDigit('120415'),9);
});

test('the Uzbek ID card (TD1, three lines of 30) is read from the back side',()=>{
  const fields=parseMrzText(['O\'ZBEKISTON RESPUBLIKASI',...idCard(),''].join('\n'));
  assert.deepEqual(fields,{lastName:'KARIMOVA',firstName:'ZARINA',passportNumber:'AD1234567',nationality:'UZB',birthDate:'1990-01-01',documentType:'id-card'});
});

test('OCR confusions in numeric fields are corrected by the check digits',()=>{
  const [line1,line2,line3]=idCard();
  const noisy=[line1.replace('AD1234567','AD12345G7').replace(/^I</,'I«'),line2.replace('900101','9OO1O1'),' '+line3+' '];
  const fields=parseMrzText(noisy.join('\n'));
  assert.equal(fields.passportNumber,'AD1234567');
  assert.equal(fields.birthDate,'1990-01-01');
  assert.equal(fields.lastName,'KARIMOVA');
});

test('a passport (TD3, two lines of 44) still works',()=>{
  const number='AA1234567';
  const line1=pad('P<UZBKARIMOV<<ALISHER',44);
  const line2=pad(number+checkDigit(number)+'UZB'+'850315'+checkDigit('850315')+'M'+'300315'+checkDigit('300315'),44);
  assert.deepEqual(parseMrzText(line1+'\n'+line2),{lastName:'KARIMOV',firstName:'ALISHER',passportNumber:'AA1234567',nationality:'UZB',birthDate:'1985-03-15',documentType:'passport'});
});

test('text without a machine-readable zone gives nothing',()=>{
  assert.deepEqual(parseMrzText('IDENTITY CARD\nSURNAME KARIMOVA'),{});
});

test('a real OCR read with collapsed fillers and a misread name line still gives the number and dates',()=>{
  // Tesseract's output for a synthetic ID back: fillers shortened to "<<", "<" in the name line read as K/L.
  const text='0ZBEKISTONRESPUBLIKASIAIDKARTA\n\nI<UZBAD1234567730101901234567<\n9001011F3001019UZB<<4\nKARIMOVA<<ZARINAKLLLLLLLLLLLLKL\n';
  const fields=parseMrzText(text);
  assert.equal(fields.documentType,'id-card');
  assert.equal(fields.passportNumber,'AD1234567');
  assert.equal(fields.birthDate,'1990-01-01');
  assert.equal(fields.nationality,'UZB');
  assert.equal(fields.lastName,'KARIMOVA');
  assert.equal(fields.firstName,'ZARINA');
});
