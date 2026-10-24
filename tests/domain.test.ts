import { test } from "node:test";
import assert from "node:assert/strict";
import {
  id,
  newRecord,
  publicSnapshot,
  safeNext,
  sortedHistory,
} from "../lib/domain";
import { publishIn, saveDraftIn, seed } from "../lib/demo";
test("공개본은 비공개 필드·사진·메모를 포함하지 않고 공개 후 수정과 분리된다", () => {
  const r = newRecord(id());
  r.fields.work = { text: "오일 교환", public: true };
  r.fields.diagnosis = { text: "정비사 전용 판단", public: false };
  r.notes = [{ id: id(), text: "내부 메모", public: false }];
  r.photos = [
    {
      id: id(),
      name: "내부.jpg",
      path: "private",
      caption: "비공개 사진",
      public: false,
      captionPublic: true,
      groupId: null,
      ready: true,
    },
  ];
  const snapshot = publicSnapshot(r);
  r.fields.work.text = "작성 중 변경";
  assert.deepEqual(snapshot.fields, { work: "오일 교환" });
  assert.deepEqual(snapshot.photos, []);
  assert.deepEqual(snapshot.notes, []);
});
test("공개 사진이라도 비공개 개별 설명과 묶음 설명은 숨긴다", () => {
  const r = newRecord(id()),
    g = id();
  r.groups = [
    {
      id: g,
      title: "내부 제목",
      description: "내부 설명",
      descriptionPublic: false,
    },
  ];
  r.photos = [
    {
      id: id(),
      name: "x.jpg",
      path: "x",
      caption: "내부",
      public: true,
      captionPublic: false,
      groupId: g,
      ready: true,
    },
  ];
  const s = publicSnapshot(r);
  assert.equal(s.photos[0].caption, "");
  assert.equal(s.groups[0].title, "");
  assert.equal(s.groups[0].description, "");
});
test("미완료 업로드 공개와 잘못된 주행거리는 거부한다", () => {
  const w = seed(),
    r = w.records[0];
  r.photos = [
    {
      id: id(),
      path: "",
      name: "x",
      caption: "",
      public: true,
      captionPublic: false,
      groupId: null,
      ready: false,
    },
  ];
  assert.throws(() => publicSnapshot(r));
  r.mileage = -1;
  assert.throws(() => saveDraftIn(w, r));
});
test("작성 버전 충돌을 감지하고 기존 공개본을 보존한다", () => {
  let w = seed();
  const r = structuredClone(w.records[0]);
  w = saveDraftIn(w, r);
  assert.throws(() => saveDraftIn(w, r));
  const next = w.records[0];
  w = publishIn(w, next);
  const pub = w.publications.at(-1)!;
  next.fields.work.text = "공개하지 않은 새 내용";
  assert.notEqual(pub.snapshot.fields.work, next.fields.work.text);
});
test("과거 이력은 등록 순서가 아닌 정비 날짜순으로 정렬한다", () => {
  const s = publicSnapshot(newRecord(id()));
  const list = sortedHistory([
    { id: "1", snapshot: { ...s, date: "2026-01-01" } },
    { id: "2", snapshot: { ...s, date: "2025-11-01" } },
  ]);
  assert.equal(list[0].id, "1");
});
test("인증 복귀는 내부 초대 경로만 허용한다", () => {
  assert.equal(safeNext("https://evil.example"), "/");
  assert.equal(safeNext("//evil.example"), "/");
  assert.equal(safeNext("/invite/token123"), "/invite/token123");
  assert.equal(safeNext("/admin"), "/");
});
test("존재하지 않는 정비 날짜는 거부한다", () => {
  const w = seed(),
    r = w.records[0];
  r.date = "2026-02-30";
  assert.throws(() => saveDraftIn(w, r));
});
