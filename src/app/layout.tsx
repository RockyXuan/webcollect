import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'WebCollect | 个人网页收藏墙',
    template: '%s | WebCollect',
  },
  description: '一个美观、可拖拽的网页收藏与导览门户，把喜欢的网站像便签一样贴在墙上。',
  keywords: ['网页收藏', '导航门户', '书签管理', 'WebCollect'],
  authors: [{ name: 'WebCollect' }],
  openGraph: {
    title: 'WebCollect | 个人网页收藏墙',
    description: '把喜欢的网站像便签一样贴在墙上',
    locale: 'zh_CN',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
