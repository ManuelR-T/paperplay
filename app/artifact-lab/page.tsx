import type { Metadata } from 'next';
import { ArtifactQualityLab } from '@/components/artifact-quality-lab';
export const metadata:Metadata={title:'Figure quality lab — Paperplay',robots:{index:false,follow:false}};
export default function ArtifactLabPage(){return <ArtifactQualityLab/>;}
