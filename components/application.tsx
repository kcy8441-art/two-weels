"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bike,
  ChevronRight,
  Grid2X2,
  Home,
  Layers,
  LogOut,
  Menu,
  Plus,
  ShieldCheck,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { StoreProvider, useWorkspace } from "./store";
import { Heading, StatusBadge, Summary, Visibility } from "./ui";
import { AuthScreen, InviteScreen } from "./auth";
import {
  Customers,
  Vehicles,
  VehicleDetail,
  TransferScreen,
} from "./management";
import { RecordEditor } from "./record-editor";
import { CustomerPortal } from "./customer";
import { supabase } from "@/lib/supabase/browser";
import { statuses } from "@/lib/domain";
export function useHref() {
  const { demo } = useWorkspace();
  return (path: string) => path + (demo ? "?demo=1" : "");
}
export function Application({
  route,
  demo,
  configured,
  allowDemo,
}: {
  route: string;
  demo: boolean;
  configured: boolean;
  allowDemo: boolean;
}) {
  if (route.startsWith("/invite/"))
    return (
      <StoreProvider demo={demo} customer>
        <InviteScreen token={route.split("/")[2]} configured={configured} />
      </StoreProvider>
    );
  if (
    ["/login", "/signup", "/forgot-password", "/reset-password"].includes(route)
  )
    return (
      <AuthScreen
        mode={route.slice(1)}
        configured={configured}
        allowDemo={allowDemo}
      />
    );
  if (route === "/" || (!configured && !demo))
    return (
      <main className="auth-wrap">
        <section className="auth-card welcome">
          <div className="eyebrow">TWO WHEELS</div>
          <h1>정비의 과정을 기록하다.</h1>
          <p>
            정비사는 간편하게 기록하고,
            <br />
            고객은 내 차량의 이력을 확인하세요.
          </p>
          {configured ? (
            <>
              <Link className="button primary" href="/login">
                로그인
              </Link>
              <Link className="button secondary" href="/signup">
                회원가입
              </Link>
            </>
          ) : (
            <div className="setup-notice">
              Supabase 연결 전입니다. 실제 계정과 고객 데이터는 아직 사용할 수
              없습니다.
            </div>
          )}
          {allowDemo && (
            <div className="demo-entry">
              <strong>개발 데모</strong>
              <p>
                가상 데이터는 이 브라우저에만 저장됩니다.
                <br />
                실제 고객 개인정보는 입력하지 마세요.
              </p>
              <Link className="button primary" href="/admin?demo=1">
                정비사 데모 시작
              </Link>
              <Link className="button secondary" href="/my/vehicles?demo=1">
                고객 데모 보기
              </Link>
            </div>
          )}
        </section>
      </main>
    );
  return (
    <StoreProvider demo={demo} customer={route.startsWith("/my")}>
      <Frame route={route}>
        <Content route={route} />
      </Frame>
    </StoreProvider>
  );
}
function Frame({ route, children }: { route: string; children: ReactNode }) {
  const { demo } = useWorkspace(),
    href = useHref(),
    router = useRouter();
  const [menu, setMenu] = useState(false);
  const customer = route.startsWith("/my");
  const items = customer
    ? [["/my/vehicles", "내 차량", Bike] as const]
    : ([
        ["/admin", "정비 현황", Grid2X2],
        ["/admin/records", "정비 이력", Wrench],
        ["/admin/customers", "고객 관리", Users],
        ["/admin/vehicles", "차량 관리", Bike],
      ] as const);
  const active = items.find(([path]) =>
    path === "/admin" ? route === path : route.startsWith(path),
  );
  async function logout() {
    if (!demo) await supabase().auth.signOut();
    router.push("/");
    router.refresh();
  }
  return (
    <div className="app">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <Link
          href={href(customer ? "/my/vehicles" : "/admin")}
          className="brand"
          onClick={() => setMenu(false)}
        >
          <span className="brand-symbol">
            tw<span>↗</span>
          </span>
          <span>
            TWO WHEELS<small>정비 이력 워크스페이스</small>
          </span>
        </Link>
        <div className="workspace">
          <span className="workspace-icon">W</span>
          <div>
            {customer ? "내 바이크" : "나의 정비소"}
            <small>
              {demo
                ? "브라우저 로컬 데모"
                : customer
                  ? "고객 계정"
                  : "개인 워크스페이스"}
            </small>
          </div>
          <span className="online" />
        </div>
        <div className="nav-label">{customer ? "MY GARAGE" : "WORKSPACE"}</div>
        <nav>
          {items.map(([path, label, Icon]) => (
            <Link
              key={path}
              href={href(path)}
              onClick={() => setMenu(false)}
              className={`nav-item ${active?.[0] === path ? "active" : ""}`}
              aria-current={active?.[0] === path ? "page" : undefined}
            >
              <Icon />
              {label}
            </Link>
          ))}
        </nav>
        {demo && (
          <div className="demo-switch">
            <span>데모 화면 전환</span>
            <Link
              href={href(customer ? "/admin" : "/my/vehicles")}
              onClick={() => setMenu(false)}
            >
              {customer ? "정비사로 보기" : "고객으로 보기"}
              <ChevronRight />
            </Link>
          </div>
        )}
        <div className="profile">
          <div className="avatar">{customer ? "고" : "정"}</div>
          <div>
            {customer ? "고객" : "정비사"}
            <small>
              {demo ? "개발 데모" : customer ? "고객 계정" : "관리자 계정"}
            </small>
          </div>
          <button
            className="icon-button"
            aria-label="로그아웃"
            onClick={logout}
          >
            <LogOut />
          </button>
        </div>
      </aside>
      {menu && (
        <button
          className="scrim"
          aria-label="메뉴 닫기"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              id="menu"
              className="icon-button mobile-menu"
              aria-label={menu ? "메뉴 닫기" : "메뉴 열기"}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
            <Home className="breadcrumb-home" />
            <span className="slash">/</span>
            <span>{active?.[1] ?? "정비 기록"}</span>
          </div>
          <div className="topbar-right">
            <span className="demo-label">
              <i />
              {demo ? "로컬 데모" : "정비 워크스페이스"}
            </span>
            <div className="avatar small">{customer ? "고" : "정"}</div>
          </div>
        </header>
        {demo && (
          <div className="demo-banner">
            개발 데모 · 입력 내용은 이 브라우저에만 저장돼요. 실제 고객에게
            전달되지 않습니다.
          </div>
        )}
        <main>{children}</main>
        <footer>
          <span>TWO WHEELS / 정비의 과정을 기록하다.</span>
          <span>
            {demo ? "로컬 데모 · Supabase 미연결" : "내 차량의 정비 이력"}
          </span>
        </footer>
      </div>
    </div>
  );
}
function Content({ route }: { route: string }) {
  const { loading, error, reload } = useWorkspace();
  if (loading)
    return (
      <div className="empty" role="status">
        기록을 불러오는 중…
      </div>
    );
  if (error)
    return (
      <section className="panel empty">
        <h2>기록을 불러오지 못했어요.</h2>
        <p className="error-message" role="alert">
          {error}
        </p>
        <button className="button secondary" onClick={reload}>
          다시 시도
        </button>
      </section>
    );
  const parts = route.split("/").filter(Boolean);
  if (parts[0] === "my") return <CustomerPortal route={route} />;
  if (route === "/admin") return <Dashboard />;
  if (route === "/admin/customers") return <Customers />;
  if (route === "/admin/vehicles") return <Vehicles />;
  if (parts[1] === "vehicles" && parts[2])
    return parts[3] === "transfer" ? (
      <TransferScreen vehicleId={parts[2]} />
    ) : (
      <VehicleDetail vehicleId={parts[2]} />
    );
  if (parts[1] === "records" && parts[2])
    return (
      <RecordEditor
        key={parts[2]}
        recordId={parts[2]}
        preview={parts[3] === "preview"}
      />
    );
  if (route === "/admin/records")
    return (
      <>
        <Heading
          title="정비 이력"
          description="실제 정비 날짜 기준으로 작업 내용을 확인하세요."
        >
          <NewRecordLink />
        </Heading>
        <RecordsTable />
      </>
    );
  if (route === "/admin/design") return <DesignSystem />;
  return <div className="empty">목록에서 항목을 선택해 주세요.</div>;
}
export function NewRecordLink({ vehicleId }: { vehicleId?: string }) {
  const href = useHref();
  const base = href("/admin/records/new");
  return (
    <Link
      className="button primary"
      href={
        base +
        (vehicleId
          ? `${base.includes("?") ? "&" : "?"}vehicle=${vehicleId}`
          : "")
      }
    >
      <Plus />새 정비 기록
    </Link>
  );
}
function Dashboard() {
  const { data } = useWorkspace(),
    href = useHref();
  const inProgress = data.records.filter((r) =>
    ["received", "inspecting", "working"].includes(r.status),
  ).length;
  const completed = data.records.filter((r) => r.status === "completed");
  const unpublished = completed.filter(
    (r) => !data.publications.some((p) => p.recordId === r.id),
  );
  return (
    <>
      <Heading
        title="정비 현황"
        description="오늘의 작업을 확인하고, 정비의 흐름을 이어가세요."
      >
        <NewRecordLink />
      </Heading>
      <section className="stats">
        {[
          [inProgress, "진행 중인 작업", "입고 · 점검 중 · 작업 중", Wrench],
          [
            completed.length,
            "작업 완료",
            "출고 전 작업을 확인하세요",
            ShieldCheck,
          ],
          [
            unpublished.length,
            "공개 대기 기록",
            "완료된 기록 중 비공개 상태",
            Layers,
          ],
          [
            data.vehicles.length,
            "등록된 차량",
            `고객 ${data.customers.length}명의 차량 관리`,
            Bike,
          ],
        ].map(([n, label, desc, Icon], i) => {
          const I = Icon as typeof Wrench;
          return (
            <article
              className={`stat ${i === 0 ? "accent" : ""}`}
              key={String(label)}
            >
              <div className="stat-top">
                {String(label)}
                <span className="stat-icon">
                  <I />
                </span>
              </div>
              <div className="stat-value">
                {String(n)}
                <span>{i === 3 ? "대" : "건"}</span>
              </div>
              <div className="stat-foot">
                <i className="tiny-dot" />
                {String(desc)}
              </div>
            </article>
          );
        })}
      </section>
      <RecordsTable limit={8} />
      <div className="bottom-strip">
        <ShieldCheck />
        <div className="strip-text">
          공개는 한 번 더 확인하고
          <small>
            사진과 메모는 기본 비공개입니다. 미리보기 후 공개해 주세요.
          </small>
        </div>
      </div>
    </>
  );
}
export function RecordsTable({
  vehicleId,
  limit,
}: {
  vehicleId?: string;
  limit?: number;
}) {
  const { data } = useWorkspace(),
    href = useHref();
  const [filter, setFilter] = useState("all");
  const all = data.records
    .filter((r) => !vehicleId || r.vehicleId === vehicleId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const list = all
    .filter((r) => filter === "all" || r.status === filter)
    .slice(0, limit ?? all.length);
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">
            {vehicleId ? "차량 정비 이력" : "최근 정비 이력"}
            <span className="count-pill">{all.length}건</span>
          </h2>
          <p className="panel-subtitle">
            작업 상태와 고객 공개 여부를 확인하세요.
          </p>
        </div>
      </div>
      <div className="filters" role="group" aria-label="작업 상태">
        {[["all", "전체"], ...Object.entries(statuses)].map(([key, label]) => (
          <button
            key={key}
            className={`filter ${filter === key ? "active" : ""}`}
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {label}
            <span>
              {all.filter((r) => key === "all" || r.status === key).length}
            </span>
          </button>
        ))}
      </div>
      {list.length ? (
        <table className="record-table">
          <thead>
            <tr>
              <th>차량 정보</th>
              <th>고객</th>
              <th className="work-column">작업 내용</th>
              <th>상태</th>
              <th>고객 공개</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const v = data.vehicles.find((v) => v.id === r.vehicleId),
                c = data.customers.find((c) => c.id === v?.customerId);
              const pub = data.publications.some(
                (p) => p.recordId === r.id && p.ownershipId === v?.ownershipId,
              );
              return (
                <tr className="record-row" key={r.id}>
                  <td className="bike-cell">
                    <Link
                      className="record-link bike-name"
                      href={href(`/admin/records/${r.id}`)}
                    >
                      {v?.make} {v?.model}
                    </Link>
                    <span className="subline">
                      {v?.plate || "번호판 미등록"}
                    </span>
                  </td>
                  <td className="customer-cell">{c?.name}</td>
                  <td className="mobile-record-summary">
                    <Summary record={r} />
                    <span className="subline">
                      {r.date} · {r.mileage?.toLocaleString() ?? "—"} km
                    </span>
                  </td>
                  <td className="work-column">
                    <div className="work-title ellipsis">
                      <Summary record={r} />
                    </div>
                    <span className="subline">
                      {r.date} · {r.mileage?.toLocaleString() ?? "—"} km
                    </span>
                  </td>
                  <td className="status-cell">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="visibility-cell">
                    <Visibility value={pub} />
                  </td>
                  <td className="arrow-cell">
                    <Link
                      href={href(`/admin/records/${r.id}`)}
                      aria-label={`${v?.model} 상세`}
                    >
                      <ChevronRight className="chevron" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <div className="empty">
          {all.length
            ? "해당 상태의 기록이 없습니다."
            : "아직 정비 기록이 없습니다."}
        </div>
      )}
      <div className="table-footer">
        {list.length}건 표시 / 전체 {all.length}건
      </div>
    </section>
  );
}
function DesignSystem() {
  return (
    <>
      <Heading
        title="디자인 시스템"
        description="밝은 배경, 선명한 텍스트, 절제된 청록색으로 정보를 정돈합니다."
      />
      <div className="system-grid">
        <section className="panel">
          <h2>컬러 토큰</h2>
          <p className="system-description">
            주요 동작에만 강조색을 사용합니다.
          </p>
          <div className="swatches">
            {[
              ["Primary", "#0F766E"],
              ["Canvas", "#F5F7FA"],
              ["Surface", "#FFFFFF"],
              ["Text", "#172B3A"],
              ["Secondary", "#526477"],
              ["Border", "#E3E8EE"],
            ].map(([label, color]) => (
              <div className="swatch" key={label}>
                <div className="swatch-color" style={{ background: color }} />
                <strong>{label}</strong>
                <code>{color}</code>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2>상태와 공개 범위</h2>
          <p className="system-description">
            색상뿐 아니라 이름과 아이콘으로 구분합니다.
          </p>
          <div className="component-row">
            {Object.keys(statuses).map((s) => (
              <StatusBadge key={s} status={s as keyof typeof statuses} />
            ))}
          </div>
          <div className="component-row">
            <Visibility value />
            <Visibility value={false} />
          </div>
          <div className="component-row">
            <button className="button primary">주요 버튼</button>
            <button className="button secondary">보조 버튼</button>
            <button className="button secondary" disabled>
              비활성
            </button>
          </div>
        </section>
        <section className="panel system-wide">
          <h2>반응형 레이아웃</h2>
          <div className="rules">
            <div className="rule">
              <strong>데스크톱</strong>
              <p>
                사이드바와 표로 정보를 비교하고, 넓은 화면을 효율적으로
                사용합니다.
              </p>
            </div>
            <div className="rule">
              <strong>태블릿</strong>
              <p>입력 폼과 요약 카드를 화면에 맞춰 재배치합니다.</p>
            </div>
            <div className="rule">
              <strong>모바일</strong>
              <p>
                접이식 메뉴와 카드형 정비 목록으로 주요 기능을 모두 제공합니다.
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
