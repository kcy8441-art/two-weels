"use client";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Camera,
  Eye,
  FolderPlus,
  Lock,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import {
  Photo,
  RecordDraft,
  Snapshot,
  fieldLabels,
  id,
  newRecord,
  publicSnapshot,
  statuses,
} from "@/lib/domain";
import { live } from "@/lib/repository";
import { useWorkspace } from "./store";
import { useHref } from "./application";
import { ErrorText, Heading, Modal, PhotoImage, SnapshotView } from "./ui";
async function preparePhoto(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error(
      `${file.name}: JPG, PNG, WebP 사진을 선택해 주세요. HEIC는 JPG로 변환 후 추가해 주세요.`,
    );
  if (file.size > 10 * 1024 * 1024)
    throw new Error(`${file.name}: 사진은 10MB 이하만 추가할 수 있습니다.`);
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("사진을 읽을 수 없습니다."));
      img.src = url;
    });
    const ratio = Math.min(
      1,
      1600 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * ratio);
    canvas.height = Math.round(image.naturalHeight * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("이미지 변환을 사용할 수 없습니다.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error("사진 변환에 실패했습니다.")),
        "image/jpeg",
        0.88,
      ),
    );
    return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
      type: "image/jpeg",
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
async function dataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("사진을 읽을 수 없습니다."));
    r.readAsDataURL(file);
  });
}
export function RecordEditor({
  recordId,
  preview = false,
}: {
  recordId: string;
  preview?: boolean;
}) {
  const { data, demo, saveRecord, publish, notify } = useWorkspace(),
    href = useHref(),
    query = useSearchParams(),
    router = useRouter();
  const existing = data.records.find((r) => r.id === recordId);
  const [draft, setDraft] = useState<RecordDraft>(() =>
    existing
      ? structuredClone(existing)
      : newRecord(query.get("vehicle") ?? data.vehicles[0]?.id ?? ""),
  );
  const latest = useRef(draft),
    epoch = useRef(0),
    savedEpoch = useRef(0),
    queue = useRef<Promise<unknown>>(Promise.resolve());
  const [change, setChange] = useState(0),
    [saveState, setSaveState] = useState(existing ? "저장됨" : "새 기록"),
    [error, setError] = useState(""),
    [uploading, setUploading] = useState(false),
    [busy, setBusy] = useState(false),
    [previewSnapshot, setPreviewSnapshot] = useState<Snapshot | null>(
      preview ? publicSnapshot(draft) : null,
    ),
    [selected, setSelected] = useState<string[]>([]),
    [groupTitle, setGroupTitle] = useState("");
  const camera = useRef<HTMLInputElement>(null),
    gallery = useRef<HTMLInputElement>(null);
  const [readOnlyPreview, setReadOnlyPreview] = useState(false);
  function edit(fn: (r: RecordDraft) => RecordDraft) {
    latest.current = fn(latest.current);
    epoch.current++;
    setDraft(latest.current);
    setChange(epoch.current);
    setSaveState("저장 대기");
  }
  async function persist(force = false): Promise<RecordDraft> {
    const operation = queue.current
      .catch(() => {})
      .then(async () => {
        if (!latest.current.vehicleId)
          throw new Error("먼저 차량을 선택해 주세요.");
        if (
          !force &&
          savedEpoch.current === epoch.current &&
          latest.current.revision > 0
        )
          return latest.current;
        const value = structuredClone(latest.current),
          captured = epoch.current;
        setSaveState("저장 중…");
        const revision = await saveRecord(value);
        latest.current = { ...latest.current, revision };
        savedEpoch.current = captured;
        setDraft(latest.current);
        setSaveState(
          savedEpoch.current === epoch.current ? "저장됨" : "저장 대기",
        );
        return latest.current;
      });
    queue.current = operation;
    return operation;
  }
  useEffect(() => {
    if (change === 0 || preview) return;
    const timer = setTimeout(() => {
      void persist().catch((e) => {
        setSaveState("저장 실패");
        setError(e instanceof Error ? e.message : "저장하지 못했습니다.");
      });
    }, 1100);
    return () => clearTimeout(timer);
  }, [change]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (epoch.current !== savedEpoch.current || uploading) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [uploading]);
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const a = (event.target as Element).closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (
        !a ||
        a.target === "_blank" ||
        event.ctrlKey ||
        event.metaKey ||
        a.origin !== location.origin
      )
        return;
      if (epoch.current === savedEpoch.current && !uploading) return;
      event.preventDefault();
      event.stopPropagation();
      if (uploading) {
        setError("사진 저장이 끝난 뒤 이동해 주세요.");
        return;
      }
      void persist()
        .then(() => router.push(a.pathname + a.search))
        .catch((e) => {
          setSaveState("저장 실패");
          setError(
            e instanceof Error ? e.message : "이동 전 저장에 실패했습니다.",
          );
        });
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [uploading]); // eslint-disable-line react-hooks/exhaustive-deps
  if (recordId !== "new" && !existing)
    return <div className="empty">정비 기록을 찾을 수 없습니다.</div>;
  const vehicle = data.vehicles.find((v) => v.id === draft.vehicleId),
    customer = data.customers.find((c) => c.id === vehicle?.customerId);
  const currentPub = data.publications
    .filter(
      (p) => p.recordId === draft.id && p.ownershipId === vehicle?.ownershipId,
    )
    .sort((a, b) => b.version - a.version)[0];
  async function save() {
    setError("");
    try {
      await persist(true);
      notify("정비 기록을 저장했어요.");
    } catch (e) {
      setSaveState("저장 실패");
      setError(e instanceof Error ? e.message : "저장하지 못했습니다.");
    }
  }
  async function showPreview() {
    setBusy(true);
    setError("");
    setReadOnlyPreview(false);
    try {
      const r = await persist();
      setPreviewSnapshot(publicSnapshot(r));
    } catch (e) {
      setError(e instanceof Error ? e.message : "미리보기를 열지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  async function publishNow() {
    setBusy(true);
    setError("");
    try {
      const r = await persist();
      await publish(r);
      setPreviewSnapshot(null);
      notify("선택한 내용을 고객에게 공개했어요.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "공개하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setUploading(true);
    setError("");
    try {
      if (latest.current.photos.length + files.length > 40)
        throw new Error("정비 건당 사진은 최대 40장까지 추가할 수 있습니다.");
      await persist();
      for (const original of files) {
        const file = await preparePhoto(original),
          photoId = id();
        let photo: Photo = {
          id: photoId,
          path: "",
          name: file.name,
          caption: "",
          public: false,
          captionPublic: false,
          groupId: null,
          ready: true,
        };
        if (demo) photo = { ...photo, url: await dataUrl(file) };
        else
          photo = {
            ...photo,
            path: await live.upload(latest.current.id, file, photoId),
          };
        edit((r) => ({ ...r, photos: [...r.photos, photo] }));
        await persist();
      }
      notify(`${files.length}장의 사진을 추가했어요.`);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "사진을 추가하지 못했습니다. 이미 추가한 사진은 유지됩니다.",
      );
    } finally {
      setUploading(false);
    }
  }
  function updatePhoto(photoId: string, values: Partial<Photo>) {
    edit((r) => ({
      ...r,
      photos: r.photos.map((p) => (p.id === photoId ? { ...p, ...values } : p)),
    }));
  }
  function move(index: number, direction: number) {
    edit((r) => {
      const photos = [...r.photos];
      const target = index + direction;
      if (target < 0 || target >= photos.length) return r;
      [photos[index], photos[target]] = [photos[target], photos[index]];
      return { ...r, photos };
    });
  }
  function createGroup() {
    if (!selected.length || !groupTitle.trim()) return;
    const groupId = id();
    edit((r) => ({
      ...r,
      groups: [
        ...r.groups,
        {
          id: groupId,
          title: groupTitle.trim(),
          description: "",
          descriptionPublic: false,
        },
      ],
      photos: r.photos.map((p) =>
        selected.includes(p.id) ? { ...p, groupId } : p,
      ),
    }));
    setSelected([]);
    setGroupTitle("");
  }
  return (
    <>
      <Heading
        title={
          recordId === "new"
            ? "새 정비 기록"
            : `${vehicle?.model ?? "차량"} 정비 기록`
        }
        description="사진을 먼저 모으고, 작업이 끝난 뒤 내용을 정리하세요."
      >
        <Link className="button secondary" href={href("/admin/records")}>
          목록
        </Link>
        <button
          className="button secondary"
          onClick={save}
          disabled={uploading || busy}
        >
          <Save />
          저장
        </button>
        <button
          className="button primary"
          onClick={showPreview}
          disabled={uploading || busy || !draft.vehicleId}
        >
          <Eye />
          공개 미리보기
        </button>
      </Heading>
      <div className="editor-status">
        <span
          className={`save-state ${saveState === "저장 실패" ? "danger-text" : ""}`}
          role="status"
        >
          {saveState}
        </span>
        <span>
          {currentPub
            ? `고객 공개본 v${currentPub.version} · 수정 내용은 다시 공개할 때 반영됩니다.`
            : "아직 고객에게 공개되지 않았습니다."}
        </span>
        {draft.revision > 0 && recordId === "new" && (
          <Link href={href(`/admin/records/${draft.id}`)}>
            저장된 기록 주소
          </Link>
        )}
      </div>
      <ErrorText error={error} />
      <div className="editor-layout">
        <div>
          <section className="panel detail-panel">
            <div className="detail-title">
              <h2>작업 사진</h2>
              <span className="count-pill">{draft.photos.length}장</span>
            </div>
            <p className="helper">
              새 사진은 정비사 전용입니다. 설명 없이 먼저 저장해도 돼요.
            </p>
            <div className="action-row">
              <button
                className="button primary"
                onClick={() => camera.current?.click()}
                disabled={uploading || !draft.vehicleId}
              >
                <Camera />
                {uploading ? "사진 저장 중…" : "사진 촬영"}
              </button>
              <button
                className="button secondary"
                onClick={() => gallery.current?.click()}
                disabled={uploading || !draft.vehicleId}
              >
                <Plus />
                사진첩에서 추가
              </button>
            </div>
            <input
              ref={camera}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              hidden
              onChange={upload}
            />
            <input
              ref={gallery}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              onChange={upload}
            />
            <p className="helper">
              JPG·PNG·WebP / 원본 10MB 이하 / 최대 40장. HEIC는 JPG로 변환해
              주세요.
            </p>
            {!draft.photos.length && (
              <div className="photo-empty">
                <Camera />
                <strong>작업 사진을 모아보세요.</strong>
                <p>
                  모바일에서는 촬영하고, 데스크톱에서는 파일을 추가할 수 있어요.
                </p>
              </div>
            )}
            {selected.length > 0 && (
              <div className="group-toolbar">
                <span>{selected.length}장 선택</span>
                <input
                  aria-label="새 사진 묶음 이름"
                  placeholder="묶음 이름"
                  value={groupTitle}
                  onChange={(e) => setGroupTitle(e.target.value)}
                />
                <button
                  className="button secondary"
                  disabled={!groupTitle.trim()}
                  onClick={createGroup}
                >
                  <FolderPlus />
                  묶기
                </button>
                <button className="text-button" onClick={() => setSelected([])}>
                  선택 해제
                </button>
              </div>
            )}
            <div className="photo-editor-grid">
              {draft.photos.map((photo, index) => (
                <article className="photo-editor-card" key={photo.id}>
                  <div className="photo-top">
                    <label className="photo-select">
                      <input
                        type="checkbox"
                        aria-label={`사진 ${index + 1} 선택`}
                        checked={selected.includes(photo.id)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, photo.id]
                              : selected.filter((x) => x !== photo.id),
                          )
                        }
                      />
                      <span>{index + 1}</span>
                    </label>
                    <PhotoImage photo={photo} />
                  </div>
                  <div className="photo-body">
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={photo.public}
                        onChange={(e) =>
                          updatePhoto(photo.id, { public: e.target.checked })
                        }
                      />
                      사진 고객 공개
                    </label>
                    <div className="field">
                      <label htmlFor={`caption-${photo.id}`}>사진별 설명</label>
                      <textarea
                        id={`caption-${photo.id}`}
                        value={photo.caption}
                        onChange={(e) =>
                          updatePhoto(photo.id, { caption: e.target.value })
                        }
                        placeholder="이 사진의 설명"
                      />
                    </div>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={photo.captionPublic}
                        onChange={(e) =>
                          updatePhoto(photo.id, {
                            captionPublic: e.target.checked,
                          })
                        }
                      />
                      설명 고객 공개
                    </label>
                    <select
                      aria-label={`사진 ${index + 1} 묶음`}
                      value={photo.groupId ?? ""}
                      onChange={(e) =>
                        updatePhoto(photo.id, {
                          groupId: e.target.value || null,
                        })
                      }
                    >
                      <option value="">묶음 없음</option>
                      {draft.groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.title || "이름 없는 묶음"}
                        </option>
                      ))}
                    </select>
                    <div className="photo-actions">
                      <button
                        className="icon-button"
                        aria-label={`사진 ${index + 1} 앞으로`}
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`사진 ${index + 1} 뒤로`}
                        disabled={index === draft.photos.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown />
                      </button>
                      <button
                        className="text-button danger-text"
                        onClick={() => {
                          edit((r) => ({
                            ...r,
                            photos: r.photos.filter((p) => p.id !== photo.id),
                          }));
                          setSelected((s) => s.filter((x) => x !== photo.id));
                        }}
                      >
                        <Trash2 />
                        기록에서 제외
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {draft.groups.map((group) => (
              <section className="photo-group-editor" key={group.id}>
                <div className="detail-title">
                  <h3>사진 묶음</h3>
                  <button
                    className="text-button"
                    onClick={() =>
                      edit((r) => ({
                        ...r,
                        photos: r.photos.map((p) =>
                          p.groupId === group.id ? { ...p, groupId: null } : p,
                        ),
                        groups: r.groups.filter((g) => g.id !== group.id),
                      }))
                    }
                  >
                    묶음 해제
                  </button>
                </div>
                <input
                  aria-label="사진 묶음 이름"
                  value={group.title}
                  onChange={(e) =>
                    edit((r) => ({
                      ...r,
                      groups: r.groups.map((g) =>
                        g.id === group.id ? { ...g, title: e.target.value } : g,
                      ),
                    }))
                  }
                />
                <textarea
                  aria-label="사진 묶음 설명"
                  placeholder="여러 사진에 공통으로 적용할 설명"
                  value={group.description}
                  onChange={(e) =>
                    edit((r) => ({
                      ...r,
                      groups: r.groups.map((g) =>
                        g.id === group.id
                          ? { ...g, description: e.target.value }
                          : g,
                      ),
                    }))
                  }
                />
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={group.descriptionPublic}
                    onChange={(e) =>
                      edit((r) => ({
                        ...r,
                        groups: r.groups.map((g) =>
                          g.id === group.id
                            ? { ...g, descriptionPublic: e.target.checked }
                            : g,
                        ),
                      }))
                    }
                  />
                  묶음 이름 · 설명 고객 공개
                </label>
                <div className="action-row">
                  <button
                    className="button secondary"
                    onClick={() =>
                      edit((r) => ({
                        ...r,
                        photos: r.photos.map((p) =>
                          p.groupId === group.id
                            ? { ...p, public: true, captionPublic: true }
                            : p,
                        ),
                        groups: r.groups.map((g) =>
                          g.id === group.id
                            ? { ...g, descriptionPublic: true }
                            : g,
                        ),
                      }))
                    }
                  >
                    묶음 전체 공개 선택
                  </button>
                  <button
                    className="button secondary"
                    onClick={() =>
                      edit((r) => ({
                        ...r,
                        photos: r.photos.map((p) =>
                          p.groupId === group.id
                            ? { ...p, public: false, captionPublic: false }
                            : p,
                        ),
                        groups: r.groups.map((g) =>
                          g.id === group.id
                            ? { ...g, descriptionPublic: false }
                            : g,
                        ),
                      }))
                    }
                  >
                    전체 정비사 전용
                  </button>
                </div>
              </section>
            ))}
          </section>
          <section className="panel detail-panel section-gap">
            <h2>정비 내용</h2>
            {Object.entries(fieldLabels).map(([key, label]) => {
              const k = key as keyof typeof fieldLabels;
              return (
                <div className="record-field" key={key}>
                  <div className="field">
                    <label htmlFor={`record-${key}`}>{label}</label>
                    <textarea
                      id={`record-${key}`}
                      value={draft.fields[k].text}
                      onChange={(e) =>
                        edit((r) => ({
                          ...r,
                          fields: {
                            ...r.fields,
                            [k]: { ...r.fields[k], text: e.target.value },
                          },
                        }))
                      }
                    />
                  </div>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={draft.fields[k].public}
                      onChange={(e) =>
                        edit((r) => ({
                          ...r,
                          fields: {
                            ...r.fields,
                            [k]: { ...r.fields[k], public: e.target.checked },
                          },
                        }))
                      }
                    />
                    {draft.fields[k].public ? <Eye /> : <Lock />}고객 공개
                    대상으로 선택
                  </label>
                </div>
              );
            })}
            <div className="detail-title section-gap">
              <h3>추가 메모</h3>
              <button
                className="button secondary"
                onClick={() =>
                  edit((r) => ({
                    ...r,
                    notes: [...r.notes, { id: id(), text: "", public: false }],
                  }))
                }
              >
                <Plus />
                메모 추가
              </button>
            </div>
            {draft.notes.map((n) => (
              <div className="record-field" key={n.id}>
                <textarea
                  aria-label="추가 메모 내용"
                  value={n.text}
                  onChange={(e) =>
                    edit((r) => ({
                      ...r,
                      notes: r.notes.map((x) =>
                        x.id === n.id ? { ...x, text: e.target.value } : x,
                      ),
                    }))
                  }
                />
                <div className="detail-title">
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={n.public}
                      onChange={(e) =>
                        edit((r) => ({
                          ...r,
                          notes: r.notes.map((x) =>
                            x.id === n.id
                              ? { ...x, public: e.target.checked }
                              : x,
                          ),
                        }))
                      }
                    />
                    고객 공개
                  </label>
                  <button
                    className="text-button danger-text"
                    onClick={() =>
                      edit((r) => ({
                        ...r,
                        notes: r.notes.filter((x) => x.id !== n.id),
                      }))
                    }
                  >
                    메모 제외
                  </button>
                </div>
              </div>
            ))}
          </section>
        </div>
        <aside className="editor-aside">
          <section className="panel detail-panel">
            <h2>기본 정보</h2>
            <div className="field">
              <label htmlFor="record-vehicle">차량 · 필수</label>
              <select
                id="record-vehicle"
                value={draft.vehicleId}
                disabled={draft.revision > 0}
                onChange={(e) =>
                  edit((r) => ({ ...r, vehicleId: e.target.value }))
                }
              >
                <option value="">차량 선택</option>
                {data.vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.make} {v.model} · {v.plate}
                  </option>
                ))}
              </select>
              {!data.vehicles.length && (
                <Link className="text-button" href={href("/admin/vehicles")}>
                  차량 먼저 등록하기
                </Link>
              )}
            </div>
            {vehicle && (
              <div className="vehicle-context">
                <p>
                  {customer?.name} · {vehicle.plate || "번호판 미등록"}
                </p>
                {vehicle.vin && (
                  <button
                    className="text-button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(vehicle.vin);
                        notify("차대번호를 복사했어요.");
                      } catch {
                        notify(
                          "복사하지 못했습니다. 차량 상세에서 확인해 주세요.",
                        );
                      }
                    }}
                  >
                    차대번호 복사
                  </button>
                )}
              </div>
            )}
            <div className="field">
              <label htmlFor="record-date">정비 날짜 · 필수</label>
              <input
                id="record-date"
                type="date"
                value={draft.date}
                onChange={(e) => edit((r) => ({ ...r, date: e.target.value }))}
              />
              <small>과거 정비 이력도 등록할 수 있습니다.</small>
            </div>
            <div className="field">
              <label htmlFor="record-mileage">입고 시 주행거리 · 선택</label>
              <input
                id="record-mileage"
                type="number"
                min="0"
                step="1"
                placeholder="km"
                value={draft.mileage ?? ""}
                onChange={(e) =>
                  edit((r) => ({
                    ...r,
                    mileage:
                      e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="record-status">작업 상태</label>
              <select
                id="record-status"
                value={draft.status}
                onChange={(e) =>
                  edit((r) => ({
                    ...r,
                    status: e.target.value as RecordDraft["status"],
                  }))
                }
              >
                {Object.entries(statuses).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </section>
          <section className="guide-panel section-gap">
            <div className="guide-top">
              <Lock />
              기록과 공개는 별개예요.
            </div>
            <p>
              자동 저장한 내용은 정비사만 확인할 수 있습니다. 공개 미리보기에서
              확인한 뒤 버튼을 눌러 반영해 주세요.
            </p>
          </section>
          {currentPub && (
            <button
              className="button secondary auth-submit"
              onClick={() => {
                setReadOnlyPreview(true);
                setPreviewSnapshot(currentPub.snapshot);
              }}
            >
              현재 고객 공개본 보기
            </button>
          )}
        </aside>
      </div>
      {previewSnapshot && (
        <Modal
          title={readOnlyPreview ? "현재 고객 공개본" : "고객 화면 미리보기"}
          onClose={() => setPreviewSnapshot(null)}
        >
          <p className="helper">
            {vehicle?.make} {vehicle?.model} · 고객에게 표시될 내용입니다.
          </p>
          <SnapshotView snapshot={previewSnapshot} />
          <ErrorText error={error} />
          <div className="drawer-actions">
            <button
              className="button secondary"
              onClick={() => setPreviewSnapshot(null)}
            >
              닫기
            </button>
            {!readOnlyPreview && (
              <button
                className="button primary"
                disabled={busy || uploading}
                onClick={publishNow}
              >
                {busy
                  ? "공개 중…"
                  : currentPub
                    ? "변경 내용 공개"
                    : "고객에게 공개"}
              </button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
