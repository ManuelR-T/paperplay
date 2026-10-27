import type { Metadata } from 'next';
import { ExploreLibrary } from '@/components/explore-library';
import './explore.css';

export const metadata: Metadata = { title: 'Explore research — Paperplay', description: 'Discover arXiv papers, save a reading list and open research in Paperplay.' };
export default function ExplorePage() { return <ExploreLibrary />; }
