"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <h1>화면을 불러오지 못했어요.</h1>
        <p>연결 상태를 확인하고 다시 시도해 주세요.</p>
        <button className="button primary" onClick={reset}>
          다시 시도
        </button>
      </section>
    </main>
  );
}
