'use client';
import { useState } from 'react';
import { createDynamicSequenceArtifact } from '@/lib/artifacts/fixtures/dynamic-sequence';
import { FigureArtifactPreview } from './figure-artifact-preview';
import { Button } from './ui/button';
export function GeneratedFigureExample(){const [example,setExample]=useState<Awaited<ReturnType<typeof createDynamicSequenceArtifact>>|null>(null),[error,setError]=useState('');return <section aria-label="Generated figure preview"><h3>Explore new interactions</h3><p>A locally computed dynamic sequence with source-linked items and inspectable values.</p><Button variant="outline" onClick={()=>{void createDynamicSequenceArtifact().then(setExample).catch(()=>setError('The example could not be checked.'));}}>Dynamic sequence</Button>{error&&<p role="alert">{error}</p>}{example&&<FigureArtifactPreview autoStart input={example.artifact} source={example.source} onClose={()=>setExample(null)}/>}</section>;}
