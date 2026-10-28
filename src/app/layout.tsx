import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { Providers } from './providers';

const siteName = '콘티룸';
const description = '곡과 콘티를 편집하고 라이브 가사 화면을 준비하는 공간, 콘티룸';

export const metadata: Metadata = {
  applicationName: siteName,
  title: siteName,
  description,
  manifest: '/site.webmanifest',
  icons: {
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon.ico' },
    ],
  },
  openGraph: {
    title: siteName,
    description,
    siteName,
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: siteName,
    description,
  },
};

const suite = localFont({
  src: './fonts/SUITE-Variable.woff2',
  variable: '--font-suite',
  weight: '300 900',
  display: 'swap',
});

const RootLayout = ({ children }: Readonly<{ children: React.ReactNode }>) => {
  return (
    <html lang="ko" data-theme="dark" className={`${suite.className} ${suite.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
};

export default RootLayout;
