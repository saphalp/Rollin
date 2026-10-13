const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

const code = ts.transpileModule(fs.readFileSync('lib/profile/validate-driver-fields.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const sandbox = { exports: {} };
vm.runInNewContext(code, sandbox);
const { validateDriverFields, isDriverFieldsEmpty } = sandbox.exports;

const valid = {
  vehicleMake: 'Honda',
  vehicleModel: 'Civic',
  vehicleYear: '2021',
  vehicleColor: 'Blue',
  licensePlateNumber: 'ABC-1234',
};

test('a fully valid vehicle passes with no error', () => {
  assert.equal(validateDriverFields(valid), null);
});

test('isDriverFieldsEmpty is true only when every field is blank or whitespace', () => {
  assert.equal(isDriverFieldsEmpty({
    vehicleMake: '', vehicleModel: '  ', vehicleYear: '', vehicleColor: '\t', licensePlateNumber: '',
  }), true);
  assert.equal(isDriverFieldsEmpty({ ...valid, vehicleColor: '' }), false);
});

test('each required field reports its own missing-field message', () => {
  assert.match(validateDriverFields({ ...valid, vehicleMake: '  ' }), /vehicle make/i);
  assert.match(validateDriverFields({ ...valid, vehicleModel: '' }), /vehicle model/i);
  assert.match(validateDriverFields({ ...valid, vehicleColor: '' }), /vehicle color/i);
  assert.match(validateDriverFields({ ...valid, licensePlateNumber: '' }), /license plate number/i);
});

test('vehicle year must be a whole number', () => {
  assert.match(validateDriverFields({ ...valid, vehicleYear: '' }), /valid vehicle year/i);
  assert.match(validateDriverFields({ ...valid, vehicleYear: 'abcd' }), /valid vehicle year/i);
  assert.match(validateDriverFields({ ...valid, vehicleYear: '2021.5' }), /valid vehicle year/i);
});

test('vehicle year is bounded between 1900 and next year', () => {
  const nextYear = new Date().getFullYear() + 1;
  assert.equal(validateDriverFields({ ...valid, vehicleYear: '1900' }), null);
  assert.equal(validateDriverFields({ ...valid, vehicleYear: String(nextYear) }), null);
  assert.match(validateDriverFields({ ...valid, vehicleYear: '1899' }), /between 1900/i);
  assert.match(validateDriverFields({ ...valid, vehicleYear: String(nextYear + 1) }), /between 1900/i);
});

test('license plate allows letters, numbers, spaces, and dashes only', () => {
  assert.equal(validateDriverFields({ ...valid, licensePlateNumber: 'ABC 123' }), null);
  assert.equal(validateDriverFields({ ...valid, licensePlateNumber: 'abc-1234' }), null);
  assert.match(validateDriverFields({ ...valid, licensePlateNumber: 'ABC#123' }), /letters, numbers, spaces, and dashes/i);
  assert.match(validateDriverFields({ ...valid, licensePlateNumber: "O'Brien1" }), /letters, numbers, spaces, and dashes/i);
});

test('checks fields in a fixed order so only the first problem is reported', () => {
  // Missing make should be reported even though model, year, color, and plate are also missing.
  assert.match(
    validateDriverFields({ vehicleMake: '', vehicleModel: '', vehicleYear: '', vehicleColor: '', licensePlateNumber: '' }),
    /vehicle make/i,
  );
});
