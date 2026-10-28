import { customDesignRecipes } from './design-recipes';
import { CUSTOM_LIMITS, CUSTOM_RUNTIME_VERSION } from '../../shared/custom-widget';
import { widgetCatalog, WIDGET_CATALOG_VERSION } from './catalog';
import { createWidgetPreset } from './presets';
import type { WidgetKind } from '../../shared/widgets';

/** Shared hook for the Meta prompt and capability discovery; no source or credentials. */
export function getWidgetDesignCapabilities() {
  const catalog=widgetCatalog.filter(c=>c.format==='paperplay-widget');
  return {
    format:'paperplay-widget-design-capabilities',version:2,catalogVersion:WIDGET_CATALOG_VERSION,catalog,
    representationDiscovery:{path:'/api/representation-capabilities',activeProposalFormat:'paperplay-widget',genericPlanGenerationEnabled:false},
    templates:catalog.map(c=>({kind:c.kind,spec:createWidgetPreset(c.kind as WidgetKind)})),
    customRuntime:{
      version:CUSTOM_RUNTIME_VERSION,limits:CUSTOM_LIMITS,canvas:{width:600,height:320},
      sceneShapes:['circle','rect','ellipse','line','arrow','text','label'],
      sceneOptions:{opacity:'Optional Expression in [0,1]; zero hides a mark.',layout:'Optional {fit:"content"|"canvas",padding:16..64}. Content fit uses all frames; canvas preserves the 600×320 stage.'},
      recipes:customDesignRecipes(),
      composition:['One visual question per widget; one main scene, 2–4 metrics and at most 4 useful parameters.','Prefer content fit with padding 24–40. Leave at least 32 units between independent objects and 24 units between text baselines.','Labels wrap at about 28 characters. Place them outside nodes, arrows and trajectories; reserve room across every frame.','ellipse x/y is its center; width/height are full diameters. rect x/y is the top-left. text displays label + numeric value; label displays plain text.','Layer backgrounds first, connectors next, foreground shapes next, labels last. Avoid decorative clutter.'],
      expressionGrammar:{number:'{op:"number",value:number}',variable:'{op:"variable",name:string}',binary:'{op:"add"|"sub"|"mul"|"div"|"pow",left:Expression,right:Expression}',unary:'{op:"neg"|"abs"|"sqrt"|"sin"|"cos"|"exp"|"log",arg:Expression}',dot:'{op:"dot",left:Expression[],right:Expression[]}'},
      semantics:'Initializers see parameters only. All register updates see the same previous state and previous step. Metrics use current registers. Scene/plot expressions may also use current metrics. step is reserved. Parameters are dimensionless. Primitive colors are palette tokens, not CSS or code.',
      permissions:{network:false,filesystem:false,generatedCode:false,scientificVerification:false},
    },
  };
}
