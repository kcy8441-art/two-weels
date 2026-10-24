"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bike, Check, Copy, Link2, Plus, Users } from "lucide-react";
import {
  Customer,
  Publication,
  Snapshot,
  Vehicle,
  fieldLabels,
  id,
} from "@/lib/domain";
import { useWorkspace } from "./store";
import { NewRecordLink, RecordsTable, useHref } from "./application";
import { ErrorText, Heading, Modal, SnapshotView } from "./ui";
function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "처리하지 못했습니다.";
}
export function Customers() {
  const { data } = useWorkspace(),
    href = useHref();
  const [editing, setEditing] = useState<Customer | null>(null),
    [search, setSearch] = useState("");
  const list = data.customers.filter((c) =>
    `${c.name} ${c.phone}`.includes(search),
  );
  return (
    <>
      <Heading
        title="고객 관리"
        description="회원가입 전에도 고객과 차량을 먼저 등록하세요."
      >
        <button
          className="button primary"
          onClick={() => setEditing({ id: id(), name: "", phone: "" })}
        >
          <Plus />
          고객 등록
        </button>
      </Heading>
      <div className="toolbar">
        <label htmlFor="customer-search">고객 이름 · 연락처</label>
        <input
          id="customer-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름 또는 연락처로 찾기"
        />
      </div>
      <div className="customer-grid">
        {list.map((c) => (
          <section className="panel customer-card" key={c.id}>
            <div className="avatar">{c.name[0]}</div>
            <h2>{c.name}</h2>
            <p>{c.phone || "연락처 미등록"}</p>
            {data.vehicles
              .filter((v) => v.customerId === c.id)
              .map((v) => (
                <Link
                  key={v.id}
                  href={href(`/admin/vehicles/${v.id}`)}
                  className="customer-bike"
                >
                  <strong>
                    {v.make} {v.model}
                  </strong>
                  <small>{v.plate || "번호판 미등록"}</small>
                </Link>
              ))}
            <button className="button secondary" onClick={() => setEditing(c)}>
              고객 정보 수정
            </button>
          </section>
        ))}
      </div>
      {!list.length && (
        <div className="panel empty">
          등록된 고객이 없습니다. 고객을 먼저 추가해 주세요.
        </div>
      )}
      {editing && (
        <CustomerForm value={editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
function CustomerForm({
  value,
  onClose,
}: {
  value: Customer;
  onClose: () => void;
}) {
  const { saveCustomer, notify } = useWorkspace();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      await saveCustomer({
        ...value,
        name: String(f.get("name")).trim(),
        phone: String(f.get("phone")).trim(),
      });
      notify("고객 정보를 저장했어요.");
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="고객 정보" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="customer-name">고객 이름 · 필수</label>
          <input
            id="customer-name"
            name="name"
            defaultValue={value.name}
            required
            maxLength={100}
          />
        </div>
        <div className="field">
          <label htmlFor="customer-phone">연락처 · 선택</label>
          <input
            id="customer-phone"
            name="phone"
            type="tel"
            defaultValue={value.phone}
            maxLength={40}
          />
        </div>
        <p className="helper">
          이 정보는 정비사 관리용이며, 로그인 계정과 별개입니다.
        </p>
        <ErrorText error={error} />
        <div className="drawer-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            취소
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? "저장 중…" : "고객 저장"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function Vehicles() {
  const { data } = useWorkspace(),
    href = useHref();
  const [adding, setAdding] = useState(false),
    [search, setSearch] = useState("");
  const list = data.vehicles.filter((v) =>
    `${v.make} ${v.model} ${v.plate} ${data.customers.find((c) => c.id === v.customerId)?.name}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <Heading
        title="차량 관리"
        description="차량 정보와 현재 고객 연결 상태를 관리하세요."
      >
        <button
          className="button primary"
          disabled={!data.customers.length}
          onClick={() => setAdding(true)}
        >
          <Plus />
          차량 등록
        </button>
      </Heading>
      {!data.customers.length && (
        <div className="setup-notice">
          차량 등록 전에 고객을 먼저 등록해 주세요.{" "}
          <Link href={href("/admin/customers")}>고객 관리</Link>
        </div>
      )}
      <div className="toolbar">
        <label htmlFor="vehicle-search">차량 · 번호판 · 고객</label>
        <input
          id="vehicle-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="차량 찾기"
        />
      </div>
      <div className="customer-grid">
        {list.map((v) => (
          <Link
            key={v.id}
            href={href(`/admin/vehicles/${v.id}`)}
            className="panel customer-card vehicle-card"
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
              <strong>
                {data.customers.find((c) => c.id === v.customerId)?.name}
              </strong>
              <small>
                {v.linked ? "고객 계정 연결됨" : "고객 계정 미연결"}
              </small>
            </div>
          </Link>
        ))}
      </div>
      {!list.length && (
        <div className="panel empty">등록된 차량이 없습니다.</div>
      )}
      {adding && <VehicleForm onClose={() => setAdding(false)} />}
    </>
  );
}
function VehicleForm({
  value,
  onClose,
}: {
  value?: Vehicle;
  onClose: () => void;
}) {
  const { data, saveVehicle, notify } = useWorkspace();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const v: Vehicle = {
      id: value?.id ?? id(),
      ownershipId: value?.ownershipId ?? id(),
      linked: value?.linked ?? false,
      customerId: value?.customerId ?? String(f.get("customerId")),
      make: String(f.get("make")).trim(),
      model: String(f.get("model")).trim(),
      year: String(f.get("year")).trim(),
      plate: String(f.get("plate")).trim(),
      vin: String(f.get("vin")).trim().toUpperCase(),
      nickname: String(f.get("nickname")).trim(),
    };
    try {
      await saveVehicle(v);
      notify("차량 정보를 저장했어요.");
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={value ? "차량 정보 수정" : "차량 등록"} onClose={onClose}>
      <form onSubmit={submit}>
        {!value && (
          <div className="field">
            <label htmlFor="vehicle-customer">소유 고객 · 필수</label>
            <select id="vehicle-customer" name="customerId" required>
              {data.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.phone}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="form-grid">
          {[
            ["make", "제조사", false],
            ["model", "모델명", true],
            ["year", "연식", false],
            ["plate", "번호판", false],
            ["vin", "차대번호", false],
            ["nickname", "차량 별명", false],
          ].map(([name, label, required]) => (
            <div className="field" key={String(name)}>
              <label htmlFor={`vehicle-${name}`}>
                {label}
                {required ? " · 필수" : " · 선택"}
              </label>
              <input
                id={`vehicle-${name}`}
                name={String(name)}
                defaultValue={(value?.[name as keyof Vehicle] as string) ?? ""}
                required={Boolean(required)}
                maxLength={100}
              />
            </div>
          ))}
        </div>
        <ErrorText error={error} />
        <div className="drawer-actions">
          <button className="button secondary" type="button" onClick={onClose}>
            취소
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? "저장 중…" : "차량 저장"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function VehicleDetail({ vehicleId }: { vehicleId: string }) {
  const { data, invite, revoke, notify, demo } = useWorkspace(),
    href = useHref();
  const [editing, setEditing] = useState(false),
    [link, setLink] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const vehicle = data.vehicles.find((v) => v.id === vehicleId);
  if (!vehicle) return <div className="empty">차량을 찾을 수 없습니다.</div>;
  const v = vehicle,
    c = data.customers.find((c) => c.id === v.customerId);
  async function createInvite() {
    setBusy(true);
    setError("");
    try {
      const token = await invite(v.id);
      setLink(`${location.origin}/invite/${token}${demo ? "?demo=1" : ""}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify("복사했어요.");
    } catch {
      notify("복사하지 못했습니다. 내용을 직접 선택해 복사해 주세요.");
    }
  }
  return (
    <>
      <Heading
        title={`${v.make} ${v.model}`}
        description={`${c?.name} · ${v.plate || "번호판 미등록"}`}
      >
        <button className="button secondary" onClick={() => setEditing(true)}>
          차량 수정
        </button>
        <NewRecordLink vehicleId={v.id} />
      </Heading>
      <section className="panel detail-panel">
        <div className="detail-title">
          <h2>차량 정보</h2>
          <span className={`connection-tag ${v.linked ? "connected" : ""}`}>
            {v.linked ? <Check /> : <Link2 />}
            {v.linked ? "고객 계정 연결됨" : "고객 계정 미연결"}
          </span>
        </div>
        <dl className="vehicle-details">
          <div>
            <dt>소유 고객</dt>
            <dd>{c?.name}</dd>
          </div>
          <div>
            <dt>연식</dt>
            <dd>{v.year || "미등록"}</dd>
          </div>
          <div>
            <dt>번호판</dt>
            <dd>{v.plate || "미등록"}</dd>
          </div>
          <div>
            <dt>차대번호</dt>
            <dd className="vin">
              <span>{v.vin || "미등록"}</span>
              {v.vin && (
                <button
                  className="icon-button"
                  onClick={() => copy(v.vin)}
                  aria-label="차대번호 복사"
                >
                  <Copy />
                </button>
              )}
            </dd>
          </div>
        </dl>
        <div className="action-row">
          {!v.linked && (
            <button
              className="button primary"
              onClick={createInvite}
              disabled={busy}
            >
              <Link2 />
              {busy ? "생성 중…" : "차량 연결 초대 링크 생성"}
            </button>
          )}
          <Link
            className="button secondary"
            href={href(`/admin/vehicles/${v.id}/transfer`)}
          >
            차량 양도
          </Link>
        </div>
        <ErrorText error={error} />
        {link && (
          <div className="link-result">
            <label htmlFor="invite-link">
              확인된 고객에게 직접 보내주세요. 1회 연결용 링크입니다.
            </label>
            <div>
              <input id="invite-link" readOnly value={link} />
              <button className="button secondary" onClick={() => copy(link)}>
                <Copy />
                복사
              </button>
            </div>
            <Link href={link} className="text-button">
              {demo ? "데모에서 링크 열기" : "초대 화면 확인"}
            </Link>
          </div>
        )}
        {data.invites
          .filter((i) => i.vehicleId === v.id && i.status === "pending")
          .map((i) => (
            <div className="pending-invite" key={i.id}>
              <span>사용 대기 중인 초대 링크</span>
              <button
                className="text-button danger-text"
                onClick={async () => {
                  try {
                    await revoke(i.id);
                    setLink("");
                    notify("링크를 폐기했어요.");
                  } catch (e) {
                    setError(errorMessage(e));
                  }
                }}
              >
                링크 폐기
              </button>
            </div>
          ))}
      </section>
      <div className="section-gap">
        <RecordsTable vehicleId={v.id} />
      </div>
      {editing && <VehicleForm value={v} onClose={() => setEditing(false)} />}
    </>
  );
}
export function TransferScreen({ vehicleId }: { vehicleId: string }) {
  const { data, transfer, invite, cancelTransfer, demo } = useWorkspace(),
    href = useHref();
  const [customerId, setCustomerId] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [link, setLink] = useState("");
  const v = data.vehicles.find((v) => v.id === vehicleId);
  const pubs = data.publications
    .filter(
      (p) => p.vehicleId === vehicleId && p.ownershipId === v?.ownershipId,
    )
    .sort((a, b) => b.version - a.version)
    .filter((p, i, a) => a.findIndex((q) => q.recordId === p.recordId) === i);
  const [review, setReview] = useState<
    { recordId: string; snapshot: Snapshot }[]
  >(() =>
    pubs.map((p) => ({
      recordId: p.recordId,
      snapshot: structuredClone(p.snapshot),
    })),
  );
  if (!v) return <div className="empty">차량을 찾을 수 없습니다.</div>;
  const current = v;
  const pending = data.transfers.find(
    (t) => t.vehicleId === vehicleId && t.status === "pending",
  );
  function update(index: number, fn: (s: Snapshot) => Snapshot) {
    setConfirmed(false);
    setReview((list) =>
      list.map((item, i) =>
        i === index ? { ...item, snapshot: fn(item.snapshot) } : item,
      ),
    );
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const tid =
        pending?.id ?? (await transfer(vehicleId, customerId, review));
      const token = await invite(vehicleId, tid);
      setLink(`${location.origin}/invite/${token}${demo ? "?demo=1" : ""}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        title="차량 양도"
        description={`${v.make} ${v.model}의 공개 이력을 검토하고 새 차주에게 연결하세요.`}
      >
        <Link
          href={href(`/admin/vehicles/${v.id}`)}
          className="button secondary"
        >
          차량으로 돌아가기
        </Link>
      </Heading>
      <div className="setup-notice">
        새 차주가 링크를 수락하면 소유 고객이 변경되고 이전 차주는 더 이상
        접근할 수 없습니다. 이전 고객의 개인정보가 메모·사진에 남아 있지 않은지
        확인해 주세요.
      </div>
      <form className="panel detail-panel" onSubmit={submit}>
        {pending ? (
          <div className="pending-invite">
            <span>
              양도 준비됨 ·{" "}
              {data.customers.find((c) => c.id === pending.customerId)?.name}
            </span>
            <button
              type="button"
              className="button secondary"
              onClick={async () => {
                try {
                  await cancelTransfer(pending.id);
                  setLink("");
                } catch (e) {
                  setError(errorMessage(e));
                }
              }}
            >
              양도 취소
            </button>
          </div>
        ) : (
          <>
            <div className="field">
              <label htmlFor="new-owner">새 소유 고객 · 필수</label>
              <select
                id="new-owner"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
              >
                <option value="">고객 선택</option>
                {data.customers
                  .filter((c) => c.id !== current.customerId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
              <small>
                목록에 없다면 고객 관리에서 새 고객을 먼저 등록해 주세요.
              </small>
            </div>
            <h2 className="transfer-title">새 차주에게 넘길 이력 검토</h2>
            {review.length ? (
              review.map((item, index) => (
                <section className="review-record" key={item.recordId}>
                  <h3>{item.snapshot.date}</h3>
                  {Object.entries(item.snapshot.fields).map(([key, text]) => (
                    <div className="field" key={key}>
                      <label htmlFor={`transfer-${index}-${key}`}>
                        {fieldLabels[key as keyof typeof fieldLabels]}
                      </label>
                      <textarea
                        id={`transfer-${index}-${key}`}
                        value={text}
                        onChange={(e) =>
                          update(index, (s) => ({
                            ...s,
                            fields: { ...s.fields, [key]: e.target.value },
                          }))
                        }
                      />
                    </div>
                  ))}
                  {item.snapshot.notes.map((text, n) => (
                    <div className="field" key={n}>
                      <label htmlFor={`transfer-note-${index}-${n}`}>
                        메모
                      </label>
                      <textarea
                        id={`transfer-note-${index}-${n}`}
                        value={text}
                        onChange={(e) =>
                          update(index, (s) => ({
                            ...s,
                            notes: s.notes.map((v, i) =>
                              i === n ? e.target.value : v,
                            ),
                          }))
                        }
                      />
                    </div>
                  ))}
                  {item.snapshot.groups.map((group) => (
                    <section className="field" key={group.id}>
                      <label htmlFor={`transfer-group-${group.id}`}>
                        사진 묶음 이름
                      </label>
                      <input
                        id={`transfer-group-${group.id}`}
                        value={group.title}
                        onChange={(e) =>
                          update(index, (s) => ({
                            ...s,
                            groups: s.groups.map((g) =>
                              g.id === group.id
                                ? { ...g, title: e.target.value }
                                : g,
                            ),
                          }))
                        }
                      />
                      <label htmlFor={`transfer-group-note-${group.id}`}>
                        사진 묶음 설명
                      </label>
                      <textarea
                        id={`transfer-group-note-${group.id}`}
                        value={group.description}
                        onChange={(e) =>
                          update(index, (s) => ({
                            ...s,
                            groups: s.groups.map((g) =>
                              g.id === group.id
                                ? { ...g, description: e.target.value }
                                : g,
                            ),
                          }))
                        }
                      />
                    </section>
                  ))}
                  <SnapshotView
                    snapshot={{
                      ...item.snapshot,
                      fields: {},
                      notes: [],
                    }}
                  />
                  {item.snapshot.photos.map((p, i) => (
                    <div className="review-photo" key={p.id}>
                      <label>
                        사진 설명
                        <input
                          aria-label={`이전 사진 ${i + 1} 설명`}
                          value={p.caption}
                          onChange={(e) =>
                            update(index, (s) => ({
                              ...s,
                              photos: s.photos.map((x) =>
                                x.id === p.id
                                  ? { ...x, caption: e.target.value }
                                  : x,
                              ),
                            }))
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="text-button danger-text"
                        onClick={() =>
                          update(index, (s) => ({
                            ...s,
                            photos: s.photos.filter((x) => x.id !== p.id),
                          }))
                        }
                      >
                        이 사진 제외
                      </button>
                    </div>
                  ))}
                </section>
              ))
            ) : (
              <p className="empty">
                이전할 공개 이력이 없습니다. 차량 소유 고객만 변경합니다.
              </p>
            )}
            <label className="check-label">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                required
              />
              이전 고객의 개인정보가 포함되지 않았는지 확인했습니다.
            </label>
          </>
        )}
        <ErrorText error={error} />
        <div className="drawer-actions">
          <button
            className="button primary"
            disabled={busy || (!pending && (!confirmed || !customerId))}
          >
            {busy
              ? "준비 중…"
              : pending
                ? "양도 링크 다시 생성"
                : "양도 초대 링크 생성"}
          </button>
        </div>
        {link && (
          <div className="link-result">
            <label htmlFor="transfer-link">
              새 차주에게 직접 전달해 주세요.
            </label>
            <input id="transfer-link" readOnly value={link} />
            <div className="action-row">
              <button
                type="button"
                className="button secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                  } catch {
                    setError("복사하지 못했습니다. 링크를 직접 선택해 주세요.");
                  }
                }}
              >
                <Copy />
                복사
              </button>
              <Link className="button secondary" href={link}>
                초대 화면 열기
              </Link>
            </div>
          </div>
        )}
      </form>
    </>
  );
}
