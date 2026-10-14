import { describe, expect, it } from 'vitest';
import { compileIndicatorFormula, displayIndicatorFormula } from './indicator-formula.utils';

const indicators = [
  { id: 'a', code: 'ABC.IND.001', obsolete: false },
  { id: 'b', code: 'ABC.IND.002', obsolete: false },
  { id: 'old', code: 'ABC.IND.003', obsolete: true },
];

describe('composite indicator formulas', () => {
  it('keeps precedence and parentheses in the stored calculation', () => {
    expect(compileIndicatorFormula('({ABC.IND.001} + 2) / {ABC.IND.002}', indicators)).toEqual([
      { kind: 'indicator', id: 'a' },
      { kind: 'number', value: 2 },
      { kind: 'operator', value: '+' },
      { kind: 'indicator', id: 'b' },
      { kind: 'operator', value: '/' },
    ]);
  });

  it('uses current codes when reopening a formula after a process code change', () => {
    const tokens = compileIndicatorFormula('{ABC.IND.001} * 100', indicators);
    expect(displayIndicatorFormula(tokens, [{ id: 'a', code: 'XYZ.IND.001' }])).toBe(
      '({XYZ.IND.001} * 100)',
    );
  });

  it('rejects invalid, obsolete, and self references', () => {
    expect(() => compileIndicatorFormula('{ABC.IND.003} + 1', indicators)).toThrow();
    expect(() => compileIndicatorFormula('{ABC.IND.001} + 1', indicators, 'a')).toThrow();
    expect(() => compileIndicatorFormula('{ABC.IND.001} /', indicators)).toThrow();
  });
});
