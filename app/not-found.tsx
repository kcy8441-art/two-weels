import Link from "next/link";
export default function NotFound() {
  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <h1>페이지를 찾을 수 없어요.</h1>
        <p>주소를 확인하거나 시작 화면으로 돌아가 주세요.</p>
        <Link className="button primary" href="/">
          시작 화면
        </Link>
      </section>
    </main>
  );
}
