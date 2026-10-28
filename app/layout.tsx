import type { Metadata } from 'next';
import './globals.css';
import './dayflow.css';
export const metadata: Metadata = {
  title: '序日 Dayflow · 个人待办',
  description: '专注当下，让每一天更有条理。个人任务、日历与专注工作台。',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
