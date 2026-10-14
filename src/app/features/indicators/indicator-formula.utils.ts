import type { Indicator, IndicatorFormulaToken } from '@core/models/database';

const precedence: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };

/** Compile a readable expression into tokens evaluated by the database. */
export function compileIndicatorFormula(
  expression: string,
  indicators: Pick<Indicator, 'id' | 'code' | 'obsolete'>[],
  editingId?: string,
): IndicatorFormulaToken[] {
  const byCode = new Map(
    indicators.filter((item) => !item.obsolete).map((item) => [item.code, item.id]),
  );
  const output: IndicatorFormulaToken[] = [];
  const operators: string[] = [];
  const pattern = /\s*(\{[A-Z]{3}\.IND\.[0-9]{3,}\}|[0-9]+(?:\.[0-9]+)?|[()+*/-])/gy;
  let position = 0;
  let expectsOperand = true;
  let usesIndicator = false;

  while (position < expression.length) {
    if (!expression.slice(position).trim()) break;
    pattern.lastIndex = position;
    const match = pattern.exec(expression);
    if (!match) throw new Error(`Símbolo inválido na fórmula, posição ${position + 1}`);
    position = pattern.lastIndex;
    const token = match[1];
    if (token.startsWith('{')) {
      if (!expectsOperand) throw new Error('Falta um operador na fórmula');
      const id = byCode.get(token.slice(1, -1));
      if (!id || id === editingId) throw new Error('Selecione outro indicador ativo da lista');
      output.push({ kind: 'indicator', id });
      usesIndicator = true;
      expectsOperand = false;
    } else if (/^[0-9]/.test(token)) {
      if (!expectsOperand) throw new Error('Falta um operador na fórmula');
      output.push({ kind: 'number', value: Number(token) });
      expectsOperand = false;
    } else if (token === '(') {
      if (!expectsOperand) throw new Error('Falta um operador antes do parêntese');
      operators.push(token);
    } else if (token === ')') {
      if (expectsOperand) throw new Error('Parênteses incompletos na fórmula');
      while (operators.length && operators.at(-1) !== '(') {
        output.push({ kind: 'operator', value: operators.pop() as '+' | '-' | '*' | '/' });
      }
      if (operators.pop() !== '(') throw new Error('Parênteses não correspondem');
    } else {
      if (expectsOperand) throw new Error('Falta um valor antes do operador');
      while (operators.length && precedence[operators.at(-1)!] >= precedence[token]) {
        output.push({ kind: 'operator', value: operators.pop() as '+' | '-' | '*' | '/' });
      }
      operators.push(token);
      expectsOperand = true;
    }
  }
  if (expectsOperand || !usesIndicator) throw new Error('Informe uma fórmula com indicadores');
  while (operators.length) {
    const token = operators.pop()!;
    if (token === '(') throw new Error('Parênteses não correspondem');
    output.push({ kind: 'operator', value: token as '+' | '-' | '*' | '/' });
  }
  return output;
}

export function displayIndicatorFormula(
  tokens: IndicatorFormulaToken[],
  indicators: Pick<Indicator, 'id' | 'code'>[],
): string {
  const codes = new Map(indicators.map((item) => [item.id, item.code]));
  const stack: string[] = [];
  for (const token of tokens) {
    if (token.kind === 'indicator') {
      stack.push(`{${codes.get(token.id) ?? token.id}}`);
    } else if (token.kind === 'number') {
      stack.push(String(token.value));
    } else {
      const right = stack.pop();
      const left = stack.pop();
      if (!left || !right) return '';
      stack.push(`(${left} ${token.value} ${right})`);
    }
  }
  return stack.length === 1 ? stack[0] : '';
}
