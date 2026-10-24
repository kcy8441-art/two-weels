import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Two Wheels · 정비 이력 관리",
  description: "정비의 과정을 기록하고 내 차량의 이력을 확인하세요.",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
