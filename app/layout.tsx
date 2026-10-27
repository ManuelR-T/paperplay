import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
export const metadata: Metadata = {
  title: 'Paperplay — Make research tangible',
  description: 'Explore ideas from research papers through source-linked interactive figures. An open source workspace powered by Meta AI.',
  icons: { icon: '/icon.svg' },
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
