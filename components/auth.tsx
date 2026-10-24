"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Bike, Link2 } from "lucide-react";
import { safeNext } from "@/lib/domain";
import { supabase } from "@/lib/supabase/browser";
import { useWorkspace } from "./store";
import { ErrorText } from "./ui";
export function AuthScreen({
  mode,
  configured,
  allowDemo,
}: {
  mode: string;
  configured: boolean;
  allowDemo: boolean;
}) {
  const router = useRouter(),
    query = useSearchParams();
  const next = safeNext(query.get("next"));
  const [error, setError] = useState(
      query.get("error") ? "재설정 링크가 만료되었거나 올바르지 않습니다." : "",
    ),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const title =
    mode === "signup"
      ? "회원가입"
      : mode === "forgot-password"
        ? "비밀번호 찾기"
        : mode === "reset-password"
          ? "새 비밀번호 설정"
          : "로그인";
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!configured) {
      setError(
        "Supabase 프로젝트 연결 후 사용할 수 있습니다. 아래 데모에서 화면을 확인해 주세요.",
      );
      return;
    }
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget),
      email = String(f.get("email") ?? ""),
      password = String(f.get("password") ?? "");
    try {
      const client = supabase();
      if (mode === "signup" || mode === "reset-password") {
        if (password !== f.get("confirm"))
          throw new Error("비밀번호가 일치하지 않습니다.");
        if (password.length < 8)
          throw new Error("비밀번호는 8자 이상 입력해 주세요.");
      }
      if (mode === "signup") {
        const { data, error } = await client.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session)
          throw new Error(
            "가입 확인이 필요합니다. 운영자는 Supabase 이메일 인증 설정을 확인해 주세요.",
          );
      } else if (mode === "forgot-password") {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${location.origin}/auth/confirm?type=recovery`,
        });
        if (error) throw error;
        setMessage(
          "입력한 이메일에 계정이 있다면 비밀번호 재설정 안내가 전송됩니다.",
        );
        return;
      } else if (mode === "reset-password") {
        const {
          data: { user },
        } = await client.auth.getUser();
        if (!user) throw new Error("재설정 링크를 다시 열어 주세요.");
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        setMessage("비밀번호가 변경되었습니다.");
      } else {
        const { error } = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
      router.push(next);
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error ? translate(e.message) : "요청에 실패했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <Link href="/" className="auth-brand">
          tw↗ <span>TWO WHEELS</span>
        </Link>
        <h1>{title}</h1>
        <p>
          {mode === "signup"
            ? "이메일로 가입하고 차량 초대 링크를 연결하세요."
            : "내 차량의 정비 이력을 확인하세요."}
        </p>
        {!configured && (
          <div className="setup-notice">
            실제 인증은 Supabase 연결 후 활성화됩니다.
          </div>
        )}
        <form onSubmit={submit}>
          {mode !== "reset-password" && (
            <div className="field">
              <label htmlFor="email">이메일</label>
              <input
                type="email"
                id="email"
                name="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </div>
          )}
          {mode !== "forgot-password" && (
            <div className="field">
              <label htmlFor="password">비밀번호</label>
              <input
                type="password"
                id="password"
                name="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                minLength={mode === "login" ? undefined : 8}
                required
              />
            </div>
          )}
          {["signup", "reset-password"].includes(mode) && (
            <div className="field">
              <label htmlFor="confirm">비밀번호 확인</label>
              <input
                type="password"
                id="confirm"
                name="confirm"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
          )}
          <ErrorText error={error} />
          {message && (
            <p className="success-message" role="status">
              {message}
            </p>
          )}
          <button className="button primary auth-submit" disabled={busy}>
            {busy ? "처리 중…" : title}
          </button>
        </form>
        <div className="auth-links">
          {mode === "login" ? (
            <>
              <Link
                href={
                  "/signup" +
                  (next !== "/" ? `?next=${encodeURIComponent(next)}` : "")
                }
              >
                회원가입
              </Link>
              <Link href="/forgot-password">비밀번호 찾기</Link>
            </>
          ) : (
            <Link
              href={
                "/login" +
                (next !== "/" ? `?next=${encodeURIComponent(next)}` : "")
              }
            >
              로그인으로 돌아가기
            </Link>
          )}
        </div>
        {allowDemo && (
          <Link className="button secondary auth-submit" href="/admin?demo=1">
            개발 데모로 확인하기
          </Link>
        )}
      </section>
    </main>
  );
}
function translate(text: string) {
  if (text.includes("Invalid login"))
    return "이메일 또는 비밀번호를 확인해 주세요.";
  if (text.includes("already registered"))
    return "이미 가입된 이메일입니다. 로그인해 주세요.";
  if (text.includes("rate limit"))
    return "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
  return text;
}
export function InviteScreen({
  token,
  configured,
}: {
  token: string;
  configured: boolean;
}) {
  const { demo, accept } = useWorkspace(),
    router = useRouter();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function connect() {
    setBusy(true);
    setError("");
    try {
      if (!demo) {
        if (!configured)
          throw new Error("Supabase 프로젝트 연결 후 사용할 수 있습니다.");
        const {
          data: { user },
        } = await supabase().auth.getUser();
        if (!user) {
          router.push(`/login?next=${encodeURIComponent("/invite/" + token)}`);
          return;
        }
      }
      await accept(token);
      router.push("/my/vehicles" + (demo ? "?demo=1" : ""));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "연결에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <div className="invite-symbol">
          <Bike />
        </div>
        <div className="eyebrow">VEHICLE INVITATION</div>
        <h1>내 차량 연결</h1>
        <p>
          정비사에게 직접 받은 초대 링크인가요?
          <br />
          가입 또는 로그인 후 차량을 연결할 수 있습니다.
        </p>
        <div className="setup-notice">
          <Link2 /> 연결하면 공개된 정비 이력을 확인할 수 있어요.
        </div>
        {demo && (
          <p className="demo-banner">
            로컬 데모입니다. 실제 계정과 연결하지 않습니다.
          </p>
        )}
        <ErrorText error={error} />
        <button
          className="button primary auth-submit"
          disabled={busy}
          onClick={connect}
        >
          {busy ? "연결 중…" : demo ? "데모 차량 연결" : "로그인하고 차량 연결"}
        </button>
        <Link
          className="text-button"
          href={"/signup?next=" + encodeURIComponent("/invite/" + token)}
        >
          계정이 없나요? 회원가입
        </Link>
      </section>
    </main>
  );
}
