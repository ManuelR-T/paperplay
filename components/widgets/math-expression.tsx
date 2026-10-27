import type { Expression } from '@/shared/widgets';
import { expressionText } from '@/lib/widgets/expression';

/** Render validated arithmetic as React elements, without executable markup. */
export function MathExpression({ expression }: { expression: Expression }) {
  function render(value: Expression): React.ReactNode {
    if (value.op === 'number') return <span>{value.value}</span>;
    if (value.op === 'variable') return <i>{value.name}</i>;
    if (value.op === 'dot') return <span>[{value.left.map((term, index) => <span key={index}>{index ? ', ' : ''}{render(term)}</span>)}] · [{value.right.map((term, index) => <span key={index}>{index ? ', ' : ''}{render(term)}</span>)}]</span>;
    const grouped = (term: Expression) => term.op === 'add' || term.op === 'sub' ? <span>({render(term)})</span> : render(term);
    if ('left' in value) {
      if (value.op === 'div') return <span className="widget-fraction"><span>{render(value.left)}</span><span>{render(value.right)}</span></span>;
      if (value.op === 'pow') return <span>{value.left.op === 'number' && value.left.value >= 0 || value.left.op === 'variable' ? render(value.left) : <span>({render(value.left)})</span>}<sup>{render(value.right)}</sup></span>;
      if (value.op === 'mul') return <span>{grouped(value.left)} × {grouped(value.right)}</span>;
      return <span>{render(value.left)} {value.op === 'add' ? '+' : '−'} {value.op === 'sub' ? grouped(value.right) : render(value.right)}</span>;
    }
    if (value.op === 'neg') return <span>−({render(value.arg)})</span>;
    if (value.op === 'sqrt') return <span>√({render(value.arg)})</span>;
    if (value.op === 'abs') return <span>|{render(value.arg)}|</span>;
    return <span>{value.op}({render(value.arg)})</span>;
  }
  return <div className="widget-formula" role="region" tabIndex={0} aria-label={expressionText(expression)}><span aria-hidden="true">{render(expression)}</span></div>;
}
