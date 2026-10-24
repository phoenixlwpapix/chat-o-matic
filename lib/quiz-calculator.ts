/** Arithmetic only: no variables, JavaScript execution or external access. */
export function calculateQuizExpression(expression: string): number {
  if (expression.length > 300 || !/^[\d\s.eE+*/^()-]+$/.test(expression)) throw new Error("只支持数字、括号和 + - * / ^ 运算");
  const tokens = expression.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[()+*/^-]/g) ?? [];
  if (!tokens.length || tokens.length > 150) throw new Error("表达式为空或过长");
  if (tokens.join("") !== expression.replace(/\s/g, "")) throw new Error("表达式包含无效数字");
  let position = 0;
  function atom(): number {
    const token = tokens[position++];
    if (token === "(") {
      const value = sum();
      if (tokens[position++] !== ")") throw new Error("括号不匹配");
      return value;
    }
    if (token === undefined || !/^(?:\d|\.)/.test(token)) throw new Error("缺少数字");
    return Number(token);
  }
  function power(): number {
    const value = atom();
    if (tokens[position] !== "^") return value;
    position++;
    const exponent = unary();
    if (Math.abs(exponent) > 1000) throw new Error("指数过大");
    return value ** exponent;
  }
  function unary(): number {
    if (tokens[position] === "+") { position++; return unary(); }
    if (tokens[position] === "-") { position++; return -unary(); }
    return power();
  }
  function product(): number {
    let value = unary();
    while (tokens[position] === "*" || tokens[position] === "/") {
      const operator = tokens[position++];
      const right = unary();
      if (operator === "/" && right === 0) throw new Error("不能除以零");
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  }
  function sum(): number {
    let value = product();
    while (tokens[position] === "+" || tokens[position] === "-") {
      const operator = tokens[position++];
      const right = product();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }
  const result = sum();
  if (position !== tokens.length || !Number.isFinite(result) || Math.abs(result) > 1e15) throw new Error("表达式无效或结果超出范围");
  return result;
}
