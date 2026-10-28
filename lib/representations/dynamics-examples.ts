import { validateDocument } from '../../shared/schema';
import { validateRepresentationPlan } from '../../shared/representations';
import { createDefaultDynamicsSolver,dynamicsRequestSchema,type DynamicsRequest } from '../../shared/dynamics';
export const DYNAMICS_EXAMPLE_IDS=['decay','oscillator','reaction-chain','threshold-decay'] as const;
export type DynamicsExampleId=typeof DYNAMICS_EXAMPLE_IDS[number];
const rate=(value:number)=>({value,per:'s' as const,role:'decay-rate' as const});
const dimensionless=(value:number)=>({value,unit:'1' as const});
/** Authored engineering examples and analytic references, never paper measurements or held-out corpus content. */
export function createDynamicsExample(kind:DynamicsExampleId){
 let title:string,quote:string,request:DynamicsRequest;
 const interval={start:0,end:2,unit:'s' as const};
 if(kind==='decay'){
  title='Exponential decay';quote='This authored example integrates dx/dt = −kx with x(0) = 4 dimensionless and k = 1 s⁻¹. Its analytic half-value is x = 2 at t = ln(2) s. No experimental measurements are supplied.';
  request=dynamicsRequestSchema.parse({format:'paperplay-dynamics',schemaVersion:1,model:{id:'decay',initial:dimensionless(4),rate:rate(1)},interval,solver:createDefaultDynamicsSolver([{value:1e-9,unit:'1'}])});
 }else if(kind==='oscillator'){
  title='Damped oscillator';quote='This authored oscillator uses x′ = v and v′ = −2γv − ω₀²x, with γ = 1 s⁻¹, ω₀ = √2 rad/s, x(0) = 1 m and v(0) = 0 m/s. The analytic solution is x = e⁻ᵗ(cos t + sin t), v = −2e⁻ᵗ sin t; these numbers are mathematical examples, not observed motion.';
  request=dynamicsRequestSchema.parse({format:'paperplay-dynamics',schemaVersion:1,model:{id:'oscillator',position:{value:1,unit:'m'},velocity:{value:0,unit:'m/s'},damping:rate(1),angularFrequency:{value:Math.SQRT2,per:'s',role:'angular-frequency'}},interval:{...interval,end:8},solver:createDefaultDynamicsSolver([{value:1e-9,unit:'m'},{value:1e-9,unit:'m/s'}])});
 }else if(kind==='reaction-chain'){
  title='Coupled reaction chain';quote='This authored irreversible chain A → B → C uses first-order rates k₁ = 1 s⁻¹ and k₂ = 2 s⁻¹, with initial concentrations (1, 0, 0) mol/L. At t = ln(2) s, the analytic concentrations are (1/2, 1/4, 1/4) mol/L. It is a mathematical conservation example, not a biochemical experiment.';
  request=dynamicsRequestSchema.parse({format:'paperplay-dynamics',schemaVersion:1,model:{id:'reaction-chain',initial:[{value:1,unit:'mol/L'},{value:0,unit:'mol/L'},{value:0,unit:'mol/L'}],rates:[rate(1),rate(2)]},interval,solver:createDefaultDynamicsSolver([{value:1e-9,unit:'mol/L'},{value:1e-9,unit:'mol/L'},{value:1e-9,unit:'mol/L'}])});
 }else{
  title='Threshold, reset and mode change';quote='This authored hybrid example starts with x′ = −x and x(0) = 1. On the first downward crossing of x = 1/2 it resets x to 1 and switches once to x′ = −2x. The exact crossing is at ln(2) s; x = 1/4 at t = 2 ln(2) s. The discontinuity is not a smooth trajectory or an organism model.';
  request=dynamicsRequestSchema.parse({format:'paperplay-dynamics',schemaVersion:1,model:{id:'threshold-decay',initial:dimensionless(1),rate:rate(1),event:{threshold:dimensionless(.5),reset:dimensionless(1),rateAfter:rate(2),direction:'falling',terminal:false}},interval,solver:createDefaultDynamicsSolver([{value:1e-9,unit:'1'}])});
 }
 const source=validateDocument({schemaVersion:1,id:`authored-dynamics-${kind}`,sourceVersion:'authored-dynamics-v1',title:`Paperplay mathematical fixture: ${title}`,authors:['Paperplay'],source:{kind:'prepared'},pageCount:1,blocks:[{id:'model',kind:'paragraph',page:1,text:quote}],anchors:[{id:'model',blockId:'model',page:1,quote}],extractionWarnings:['Project-authored ODE/hybrid engineering fixture. No original research paper or experimental dataset is represented.','Analytic references check named mathematical cases only; no independent scientific validation or expert approval is implied.']});
 const plan=validateRepresentationPlan({format:'paperplay-representation',schemaVersion:1,id:`dynamics-${kind}`,title,source:{documentId:source.id,sourceVersion:source.sourceVersion},authorship:{kind:'prepared',label:'Paperplay-authored mathematical dynamics example'},objective:'Explore the relationship between a registered differential model, its numerical trajectory and its exact stored values.',anchors:[{id:'model',blockId:'model',page:1,quote}],claims:[{id:'fixture',kind:'source',text:quote,anchorIds:['model']}],assumptions:['Smooth, non-stiff ordinary differential equations on each continuous mode.','Parameters and initial conditions are authored examples, not inferred source measurements.','Local error estimates are not global error bounds, measurement uncertainty or scientific verification.','A threshold crossing can be missed between steps; this finite event policy does not certify arbitrary hybrid systems.'],requestedEvidence:'simplified-illustration',assets:[],quantities:[],execution:{kind:'local-computation',capabilities:[{id:'ode-rk4',version:'1.0.0'}],assetIds:[]},interactions:['widget-controls','select-time','inspect-data','return-source'],views:[{id:'dynamics',kind:'dynamics',dynamics:{title,anchorIds:['model'],request}}]},source);
 return {source,plan,assets:[]};
}
