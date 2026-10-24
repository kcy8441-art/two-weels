"use client";
import Link from "next/link";
import { Bike, ChevronRight, Link2 } from "lucide-react";
import { sortedHistory } from "@/lib/domain";
import { useWorkspace } from "./store";
import { useHref } from "./application";
import { Heading, SnapshotView, StatusBadge } from "./ui";
export function CustomerPortal({ route }: { route: string }) {
  const { data } = useWorkspace(),
    href = useHref();
  const parts = route.split("/");
  const vehicles = data.vehicles.filter((v) => v.linked);
  const vehicle =
    parts[2] === "vehicles" && parts[3]
      ? vehicles.find((v) => v.id === parts[3])
      : undefined;
  const publications = sortedHistory(
    data.publications
      .filter((p) =>
        vehicles.some(
          (v) => v.id === p.vehicleId && v.ownershipId === p.ownershipId,
        ),
      )
      .sort((a, b) => b.version - a.version)
      .filter((p, i, a) => a.findIndex((q) => q.recordId === p.recordId) === i),
  );
  if (parts[2] === "records" && parts[3]) {
    const p = publications.find((p) => p.recordId === parts[3]);
    if (!p)
      return (
        <div className="empty">공개된 기록이 없거나 접근할 수 없습니다.</div>
      );
    const v = vehicles.find((v) => v.id === p.vehicleId);
    return (
      <>
        <Heading
          title={`${v?.make} ${v?.model}`}
          description="정비사가 공개한 정비 기록입니다."
        >
          <Link
            className="button secondary"
            href={href(`/my/vehicles/${p.vehicleId}`)}
          >
            목록으로
          </Link>
        </Heading>
        <section className="panel detail-panel">
          <SnapshotView snapshot={p.snapshot} />
        </section>
      </>
    );
  }
  if (parts[3] && !vehicle)
    return (
      <div className="empty">연결된 차량이 없거나 접근할 수 없습니다.</div>
    );
  if (vehicle) {
    const history = publications.filter((p) => p.vehicleId === vehicle.id);
    return (
      <>
        <Heading
          title={`${vehicle.make} ${vehicle.model}`}
          description={`${vehicle.plate || "번호판 미등록"} · ${vehicle.year || "연식 미등록"}`}
        >
          <Link className="button secondary" href={href("/my/vehicles")}>
            내 차량 목록
          </Link>
        </Heading>
        <section className="panel">
          <div className="panel-header">
            <h2 className="panel-title">
              정비 이력 <span className="count-pill">{history.length}건</span>
            </h2>
          </div>
          {history.length ? (
            history.map((p) => (
              <Link
                key={p.id}
                className="history-item"
                href={href(`/my/records/${p.recordId}`)}
              >
                <div>
                  <div className="eyebrow">{p.snapshot.date}</div>
                  <h3>{p.snapshot.fields.work || "정비 기록"}</h3>
                  <p>{p.snapshot.mileage?.toLocaleString() ?? "—"} km</p>
                </div>
                <div className="history-side">
                  <StatusBadge status={p.snapshot.status} />
                  <ChevronRight />
                </div>
              </Link>
            ))
          ) : (
            <div className="empty">아직 공개된 정비 이력이 없습니다.</div>
          )}
        </section>
      </>
    );
  }
  return (
    <>
      <Heading
        title="내 차량"
        description="내 바이크의 정비 이력을 한곳에서 확인하세요."
      />
      {vehicles.length ? (
        <div className="customer-grid">
          {vehicles.map((v) => (
            <Link
              key={v.id}
              className="panel customer-card vehicle-card"
              href={href(`/my/vehicles/${v.id}`)}
            >
              <span className="vehicle-symbol">
                <Bike />
              </span>
              <p>
                {v.make} · {v.year || "연식 미등록"}
              </p>
              <h2>{v.model}</h2>
              <p>{v.plate || "번호판 미등록"}</p>
              <div className="customer-bike">
                공개된 정비 이력{" "}
                {publications.filter((p) => p.vehicleId === v.id).length}건{" "}
                <ChevronRight />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <section className="panel empty">
          <Link2 size={32} />
          <h2>연결된 차량이 없습니다.</h2>
          <p>정비사가 보내준 초대 링크를 열면 차량이 연결됩니다.</p>
        </section>
      )}
    </>
  );
}
