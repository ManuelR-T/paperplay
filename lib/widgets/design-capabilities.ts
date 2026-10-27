import { CUSTOM_LIMITS, CUSTOM_RUNTIME_VERSION } from '../../shared/custom-widget';
import { widgetCatalog, WIDGET_CATALOG_VERSION } from './catalog';
import { createWidgetPreset } from './presets';
import type { WidgetKind } from '../../shared/widgets';

/** Shared hook for the Meta prompt and capability discovery; no source or credentials. */
export function getWidgetDesignCapabilities() {
  const catalog=widgetCatalog.filter(c=>c.format==='paperplay-widget');
  return {
    format:'paperplay-widget-design-capabilities',version:1,catalogVersion:WIDGET_CATALOG_VERSION,catalog,
    templates:catalog.map(c=>({kind:c.kind,spec:createWidgetPreset(c.kind as WidgetKind)})),
    customRuntime:{
      version:CUSTOM_RUNTIME_VERSION,limits:CUSTOM_LIMITS,canvas:{width:600,height:320},
      expressionGrammar:{number:'{op:"number",value:number}',variable:'{op:"variable",name:string}',binary:'{op:"add"|"sub"|"mul"|"div"|"pow",left:Expression,right:Expression}',unary:'{op:"neg"|"abs"|"sqrt"|"sin"|"cos"|"exp"|"log",arg:Expression}',dot:'{op:"dot",left:Expression[],right:Expression[]}'},
      semantics:'Initializers see parameters only. All register updates see the same previous state and previous step. Metrics use current registers. Scene/plot expressions may also use current metrics. step is reserved. Parameters are dimensionless. Primitive colors are palette tokens, not CSS or code.',
      permissions:{network:false,filesystem:false,generatedCode:false,scientificVerification:false},
    },
  };
}
