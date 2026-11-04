const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const ease=(n:number)=>{const u=clamp(n);return u*u*(3-2*u)};
/** Sweep all intermediate beta values; replay from the same start after each drag. */
export function momentumTimeline(t:number){
 const beta=t<5?0:t<9?.8*ease((t-5)/4):t<14?.8:t<18?.8+.17*ease((t-14)/4):.97;
 const dragging=t>=5&&t<9||t>=14&&t<18;
 const progress=t<5?64*clamp((t-1)/4):t<9?64:t<14?64*clamp((t-10)/4):t<18?64:64*clamp((t-19)/5);
 return{beta,progress,dragging};
}
