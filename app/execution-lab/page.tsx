import type {Metadata} from 'next';
import {ExecutionStressFixture} from '@/components/execution-stress-fixture';
export const metadata:Metadata={title:'Execution resource lab — Paperplay',robots:{index:false,follow:false}};
export default function ExecutionLabPage(){return <main style={{maxWidth:1100,width:'100%',minWidth:0,margin:'0 auto',padding:'24px 16px',overflowWrap:'anywhere'}}><a href="/">Back to reading</a><h1 style={{fontSize:'clamp(1.75rem,5vw,2.5rem)',lineHeight:1.2,marginBlock:20}}>Local execution lab</h1><ExecutionStressFixture/></main>;}
