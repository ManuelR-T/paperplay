import type { Expression } from '@/shared/widgets';
import { expressionText } from '@/lib/widgets/expression';

/** Render validated arithmetic as React elements, without executable markup. */
export function MathExpression({ expression }: { expression: Expression }) {
  function render(value: Expression): React.ReactNode {
    if (value.op === 'number') return <span>{value.value}</span>;
    if (value.op === 'variable') return <i>{greekSymbol(value.name)}</i>;
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

const GREEK: Record<string, string> = { alpha:'α', beta:'β', gamma:'γ', delta:'δ', epsilon:'ε', eta:'η', theta:'θ', kappa:'κ', lambda:'λ', mu:'μ', nu:'ν', pi:'π', rho:'ρ', sigma:'σ', tau:'τ', phi:'φ', chi:'χ', psi:'ψ', omega:'ω', Gamma:'Γ', Delta:'Δ', Theta:'Θ', Lambda:'Λ', Sigma:'Σ', Phi:'Φ', Psi:'Ψ', Omega:'Ω' };
/** Display-only: a variable named "lambda" or "lambda_i" reads as λ or λᵢ; its identity is unchanged. */
export function greekSymbol(name: string) {
  const match = /^([A-Za-z]+)(?:_?([0-9a-z]))?$/.exec(name);
  if (!match) return name;
  if (!GREEK[match[1]]) return match[1].length === 1 && match[2] && /[0-9]/.test(match[2]) ? match[1] + '₀₁₂₃₄₅₆₇₈₉'[Number(match[2])] : name;
  const sub: Record<string, string> = { 0:'₀',1:'₁',2:'₂',3:'₃',4:'₄',5:'₅',6:'₆',7:'₇',8:'₈',9:'₉',i:'ᵢ',j:'ⱼ',k:'ₖ',t:'ₜ',n:'ₙ' };
  return GREEK[match[1]] + (match[2] ? sub[match[2]] ?? `_${match[2]}` : '');
}
