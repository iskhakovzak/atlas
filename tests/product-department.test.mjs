import test from 'node:test';
import assert from 'node:assert/strict';
import { withoutDepartment, departmentInName, departmentLabel } from '../lib/market/product-name.ts';

test('the department word leaves the shown title, after the brand or at the start', () => {
  assert.equal(withoutDepartment('adidas men Core Provisional Pants', 'adidas'), 'adidas Core Provisional Pants');
  assert.equal(withoutDepartment('adidas women Swift Run 1.0 Shoes', 'adidas'), 'adidas Swift Run 1.0 Shoes');
  assert.equal(withoutDepartment("Women's Ultraboost 22"), 'Ultraboost 22');
  assert.equal(withoutDepartment('adidas Originals Trefoil Hoodie', 'adidas'), 'adidas Originals Trefoil Hoodie');
  assert.equal(withoutDepartment('Menorca Sandals'), 'Menorca Sandals', 'only a whole word');
  assert.equal(withoutDepartment('adidas men', 'adidas'), 'adidas men', 'a title is never emptied');
});

test('the label comes from the facets first, else from the title', () => {
  assert.equal(departmentInName('adidas men Core Pants', 'adidas'), 'men');
  assert.equal(departmentInName('Kids Superstar'), 'kids');
  assert.equal(departmentLabel({ name: 'adidas men Core Pants', brand: 'adidas' }, 'ru'), 'Мужское');
  assert.equal(departmentLabel({ name: 'Core Pants', facets: { department: 'women' } }, 'uz'), 'Ayollar uchun');
  assert.equal(departmentLabel({ name: 'Anker Charger' }, 'en'), '');
});
