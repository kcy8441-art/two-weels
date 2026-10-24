import {
  Customer,
  Invite,
  Publication,
  RecordDraft,
  Snapshot,
  Transfer,
  Vehicle,
  Workspace,
  emptyWorkspace,
  id,
  newRecord,
  publicSnapshot,
  validateDraft,
} from "./domain";
const database = "two-wheels-demo-v1";
async function db() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(database, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("workspace");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(new Error("브라우저 저장소를 열 수 없습니다."));
  });
}
export async function saveDemo(data: Workspace) {
  const d = await db();
  try {
    await new Promise<void>((resolve, reject) => {
      const t = d.transaction("workspace", "readwrite");
      t.objectStore("workspace").put(data, "data");
      t.oncomplete = () => resolve();
      t.onerror = () =>
        reject(new Error("저장 공간이 부족하거나 저장에 실패했습니다."));
    });
  } finally {
    d.close();
  }
}
export async function loadDemo() {
  const d = await db();
  let result: Workspace | undefined;
  try {
    result = await new Promise((resolve, reject) => {
      const r = d.transaction("workspace").objectStore("workspace").get("data");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } finally {
    d.close();
  }
  if (result) return result;
  const data = seed();
  await saveDemo(data);
  return data;
}
export function seed(): Workspace {
  const w = emptyWorkspace();
  const bikes = [
    ["Honda", "PCX 125", "김민준", "서울 마 4821"],
    ["Yamaha", "NMAX 155", "이서연", "서울 바 7392"],
    ["BMW", "R nineT", "박지훈", "경기 사 1058"],
    ["Honda", "Super Cub", "최유진", "서울 아 3206"],
  ];
  bikes.forEach(([make, model, name, plate], i) => {
    const customer = { id: id(), name, phone: `010-0000-000${i + 1}` };
    w.customers.push(customer);
    const v: Vehicle = {
      id: id(),
      customerId: customer.id,
      make,
      model,
      plate,
      year: "2023",
      vin: `DEMO${String(i + 1).padStart(13, "0")}`,
      nickname: "",
      ownershipId: id(),
      linked: i === 3,
    };
    w.vehicles.push(v);
    const r = newRecord(v.id);
    r.status = (["working", "inspecting", "completed", "delivered"] as const)[
      i
    ];
    r.mileage = [18420, 24810, 12650, 8930][i];
    r.fields.request.text = "정기 점검과 소모품 교환 요청";
    r.fields.work = {
      text: [
        "엔진오일 교환 · 구동계 점검",
        "앞 브레이크 패드 교환",
        "엔진오일 · 오일필터 교환",
        "체인 장력 조정 · 타이어 점검",
      ][i],
      public: true,
    };
    r.fields.diagnosis.text = "마모 상태를 확인하고 고객에게 안내함.";
    r.fields.next = { text: "현재 주행거리에서 3,000km 후 점검", public: true };
    r.revision = 1;
    w.records.push(r);
    if (i === 3)
      w.publications.push({
        id: id(),
        recordId: r.id,
        vehicleId: v.id,
        ownershipId: v.ownershipId,
        version: 1,
        publishedAt: new Date().toISOString(),
        snapshot: publicSnapshot(r),
      });
  });
  return w;
}
export function saveDraftIn(w: Workspace, r: RecordDraft) {
  validateDraft(r);
  const existing = w.records.find((x) => x.id === r.id);
  if (existing && existing.revision !== r.revision)
    throw new Error("다른 화면에서 수정한 내용이 있습니다. 다시 열어 주세요.");
  const next = { ...r, revision: r.revision + 1 };
  return { ...w, records: [...w.records.filter((x) => x.id !== r.id), next] };
}
export function publishIn(w: Workspace, r: RecordDraft) {
  const vehicle = w.vehicles.find((v) => v.id === r.vehicleId);
  if (!vehicle) throw new Error("차량을 찾을 수 없습니다.");
  const latest = w.publications.filter(
    (p) => p.recordId === r.id && p.ownershipId === vehicle.ownershipId,
  );
  const p: Publication = {
    id: id(),
    recordId: r.id,
    vehicleId: r.vehicleId,
    ownershipId: vehicle.ownershipId,
    version: latest.length + 1,
    publishedAt: new Date().toISOString(),
    snapshot: publicSnapshot(r),
  };
  return { ...w, publications: [...w.publications, p] };
}
export function acceptIn(w: Workspace, token: string) {
  const invite = w.invites.find(
    (i) => i.token === token && i.status === "pending",
  );
  if (!invite) throw new Error("이미 사용했거나 폐기된 초대 링크입니다.");
  const next = structuredClone(w);
  const v = next.vehicles.find((v) => v.id === invite.vehicleId);
  if (!v) throw new Error("차량을 찾을 수 없습니다.");
  if (invite.transferId) {
    const t = next.transfers.find(
      (t) => t.id === invite.transferId && t.status === "pending",
    );
    if (!t) throw new Error("취소된 양도입니다.");
    if (t.sourceVersions) {
      const versions: Record<string, number> = {};
      for (const p of w.publications.filter(
        (p) => p.vehicleId === v.id && p.ownershipId === v.ownershipId,
      ))
        versions[p.recordId] = Math.max(versions[p.recordId] ?? 0, p.version);
      if (
        JSON.stringify(Object.entries(versions).sort()) !==
        JSON.stringify(Object.entries(t.sourceVersions).sort())
      )
        throw new Error(
          "공개 이력이 변경되었습니다. 양도를 취소한 뒤 다시 검토해 주세요.",
        );
    }
    v.customerId = t.customerId;
    v.ownershipId = id();
    t.status = "completed";
    for (const s of t.snapshots)
      next.publications.push({
        id: id(),
        recordId: s.recordId,
        vehicleId: v.id,
        ownershipId: v.ownershipId,
        version: 1,
        publishedAt: new Date().toISOString(),
        snapshot: s.snapshot,
      });
  } else if (v.linked) throw new Error("이미 계정에 연결된 차량입니다.");
  v.linked = true;
  next.invites = next.invites.map((i) =>
    i.id === invite.id ? { ...i, status: "used" } : i,
  );
  return next;
}
export type { Customer, Invite, RecordDraft, Snapshot, Transfer, Vehicle };
