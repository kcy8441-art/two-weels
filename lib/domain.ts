export const statuses = {
  received: "입고",
  inspecting: "점검 중",
  working: "작업 중",
  completed: "작업 완료",
  delivered: "출고",
} as const;
export type Status = keyof typeof statuses;
export const fieldLabels = {
  request: "고객 증상 · 요청",
  diagnosis: "정비 판단 · 원인",
  work: "작업 내용 · 교환 부품",
  deferred: "미진행 작업과 사유",
  next: "다음 정비 기준",
} as const;
export type FieldKey = keyof typeof fieldLabels;
export type Field = { text: string; public: boolean };
export type Customer = { id: string; name: string; phone: string };
export type Vehicle = {
  id: string;
  customerId: string;
  make: string;
  model: string;
  year: string;
  plate: string;
  vin: string;
  nickname: string;
  ownershipId: string;
  linked: boolean;
};
export type Photo = {
  id: string;
  path: string;
  name: string;
  caption: string;
  public: boolean;
  captionPublic: boolean;
  groupId: string | null;
  url?: string;
  ready: boolean;
};
export type PhotoGroup = {
  id: string;
  title: string;
  description: string;
  descriptionPublic: boolean;
};
export type Note = { id: string; text: string; public: boolean };
export type RecordDraft = {
  id: string;
  vehicleId: string;
  date: string;
  mileage: number | null;
  status: Status;
  revision: number;
  fields: Record<FieldKey, Field>;
  notes: Note[];
  groups: PhotoGroup[];
  photos: Photo[];
};
export type PublicPhoto = {
  id: string;
  caption: string;
  groupId: string | null;
  url?: string;
};
export type Snapshot = {
  date: string;
  mileage: number | null;
  status: Status;
  fields: Partial<Record<FieldKey, string>>;
  notes: string[];
  groups: PhotoGroup[];
  photos: PublicPhoto[];
};
export type Publication = {
  id: string;
  recordId: string;
  vehicleId: string;
  ownershipId: string;
  version: number;
  publishedAt: string;
  snapshot: Snapshot;
};
export type Invite = {
  id: string;
  vehicleId: string;
  ownershipId: string;
  token?: string;
  status: "pending" | "used" | "revoked";
  transferId?: string;
};
export type Transfer = {
  id: string;
  vehicleId: string;
  customerId: string;
  status: "pending" | "completed" | "cancelled";
  snapshots: { recordId: string; snapshot: Snapshot }[];
  sourceVersions?: Record<string, number>;
};
export type Workspace = {
  customers: Customer[];
  vehicles: Vehicle[];
  records: RecordDraft[];
  publications: Publication[];
  invites: Invite[];
  transfers: Transfer[];
};
export const emptyWorkspace = (): Workspace => ({
  customers: [],
  vehicles: [],
  records: [],
  publications: [],
  invites: [],
  transfers: [],
});
export const id = () => crypto.randomUUID();
export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function newRecord(vehicleId: string): RecordDraft {
  return {
    id: id(),
    vehicleId,
    date: today(),
    mileage: null,
    status: "received",
    revision: 0,
    fields: Object.fromEntries(
      Object.keys(fieldLabels).map((k) => [k, { text: "", public: false }]),
    ) as Record<FieldKey, Field>,
    notes: [],
    groups: [],
    photos: [],
  };
}
export function publicSnapshot(record: RecordDraft): Snapshot {
  if (record.photos.some((p) => p.public && !p.ready))
    throw new Error("업로드가 끝나지 않은 사진은 공개할 수 없습니다.");
  const photos = record.photos
    .filter((p) => p.public && p.ready)
    .map((p) => ({
      id: p.id,
      caption: p.captionPublic ? p.caption : "",
      groupId: p.groupId,
      ...(p.url ? { url: p.url } : {}),
    }));
  const used = new Set(photos.map((p) => p.groupId));
  return {
    date: record.date,
    mileage: record.mileage,
    status: record.status,
    fields: Object.fromEntries(
      Object.entries(record.fields)
        .filter(([, v]) => v.public && v.text.trim())
        .map(([k, v]) => [k, v.text]),
    ),
    notes: record.notes
      .filter((n) => n.public && n.text.trim())
      .map((n) => n.text),
    groups: record.groups
      .filter((g) => used.has(g.id))
      .map((g) => ({
        ...g,
        title: g.descriptionPublic ? g.title : "",
        description: g.descriptionPublic ? g.description : "",
      })),
    photos,
  };
}
export function sortedHistory<T extends { snapshot: Snapshot; id: string }>(
  items: T[],
) {
  return [...items].sort(
    (a, b) =>
      b.snapshot.date.localeCompare(a.snapshot.date) ||
      b.id.localeCompare(a.id),
  );
}
export function safeNext(value: string | null) {
  return value && /^\/invite\/[a-zA-Z0-9_-]+$/.test(value) ? value : "/";
}
export function validateDraft(r: RecordDraft) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(r.date) ||
    Number.isNaN(Date.parse(r.date)) ||
    new Date(r.date).toISOString().slice(0, 10) !== r.date
  )
    throw new Error("정비 날짜를 입력해 주세요.");
  if (r.mileage !== null && (!Number.isInteger(r.mileage) || r.mileage < 0))
    throw new Error("주행거리는 0 이상의 정수로 입력해 주세요.");
  if (!(r.status in statuses)) throw new Error("작업 상태를 확인해 주세요.");
  for (const p of r.photos)
    if (p.groupId && !r.groups.some((g) => g.id === p.groupId))
      throw new Error("사진 묶음을 확인해 주세요.");
}
