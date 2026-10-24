"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Eye, Lock, X } from "lucide-react";
import {
  Photo,
  PublicPhoto,
  RecordDraft,
  Snapshot,
  Status,
  fieldLabels,
  statuses,
} from "@/lib/domain";
import { live } from "@/lib/repository";
export function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge ${status}`}>{statuses[status]}</span>;
}
export function Visibility({ value }: { value: boolean }) {
  return (
    <span className={`visibility ${value ? "public" : ""}`}>
      {value ? <Eye /> : <Lock />}
      {value ? "공개됨" : "비공개"}
    </span>
  );
}
export function Heading({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">TWO WHEELS / WORKSPACE</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <div className="field-label" id={id}>
        {label}
      </div>
      <div role="group" aria-labelledby={id}>
        {children}
      </div>
      {hint && <small>{hint}</small>}
    </div>
  );
}
export function ErrorText({ error }: { error: string }) {
  return error ? (
    <p className="error-message" role="alert">
      {error}
    </p>
  ) : null;
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="app-dialog"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="drawer-heading">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="닫기" onClick={onClose}>
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function PhotoImage({
  photo,
}: {
  photo: Pick<Photo, "id" | "url"> | PublicPhoto;
}) {
  const [url, setUrl] = useState(photo.url ?? ""),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    if (photo.url) {
      setUrl(photo.url);
      return;
    }
    let active = true,
      blob = "";
    live
      .photo(photo.id)
      .then((value) => {
        blob = value;
        if (active) setUrl(value);
        else URL.revokeObjectURL(value);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (blob) URL.revokeObjectURL(blob);
    };
  }, [photo.id, photo.url]);
  return url ? (
    <img className="photo-image" src={url} alt="정비 사진" loading="lazy" />
  ) : (
    <div className="photo-placeholder">
      {failed ? "사진을 불러오지 못했습니다." : "사진 불러오는 중…"}
    </div>
  );
}
export function SnapshotView({ snapshot }: { snapshot: Snapshot }) {
  return (
    <div className="snapshot">
      <div className="snapshot-meta">
        <span>{snapshot.date}</span>
        <span>
          {snapshot.mileage === null
            ? "주행거리 미기록"
            : `${snapshot.mileage.toLocaleString()} km`}
        </span>
        <StatusBadge status={snapshot.status} />
      </div>
      {Object.entries(snapshot.fields).map(([key, text]) => (
        <section className="detail-section" key={key}>
          <h3>{fieldLabels[key as keyof typeof fieldLabels]}</h3>
          <p className="preserve">{text}</p>
        </section>
      ))}
      {snapshot.notes.map((text, i) => (
        <section className="detail-section" key={i}>
          <h3>메모</h3>
          <p className="preserve">{text}</p>
        </section>
      ))}
      {snapshot.groups.map((g) => (
        <section className="detail-section" key={g.id}>
          {g.title && <h3>{g.title}</h3>}
          {g.description && <p className="preserve">{g.description}</p>}
          <div className="photo-grid">
            {snapshot.photos
              .filter((p) => p.groupId === g.id)
              .map((p) => (
                <figure key={p.id}>
                  <PhotoImage photo={p} />
                  {p.caption && <figcaption>{p.caption}</figcaption>}
                </figure>
              ))}
          </div>
        </section>
      ))}
      <div className="photo-grid">
        {snapshot.photos
          .filter(
            (p) =>
              !p.groupId || !snapshot.groups.some((g) => g.id === p.groupId),
          )
          .map((p) => (
            <figure key={p.id}>
              <PhotoImage photo={p} />
              {p.caption && <figcaption>{p.caption}</figcaption>}
            </figure>
          ))}
      </div>
      {!Object.values(snapshot.fields).length &&
        !snapshot.notes.length &&
        !snapshot.photos.length && (
          <p className="empty">공개된 상세 내용이 없습니다.</p>
        )}
    </div>
  );
}
export function SaveState({ state }: { state: string }) {
  return (
    <span className="save-state" role="status">
      {state}
    </span>
  );
}
export function Summary({ record }: { record: RecordDraft }) {
  return (
    <>
      {record.fields.work.text ||
        record.fields.request.text ||
        "작업 내용 미입력"}
    </>
  );
}
