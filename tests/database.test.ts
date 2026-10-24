import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { id, newRecord, publicSnapshot, type Workspace } from "../lib/domain";
test("DB 통합: 실제 마이그레이션의 RLS·초대·공개·차량 양도", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;grant usage on schema public,auth,storage to authenticated;grant insert on storage.objects to authenticated;`,
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202610240001_initial.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const admin = id(),
      a = id(),
      b = id(),
      c = id();
    for (const user of [admin, a, b, c])
      await db.query("insert into auth.users values($1)", [user]);
    await db.query("insert into private.admin_users values($1)", [admin]);
    async function as<T>(user: string, sql: string, args: unknown[] = []) {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        user,
      ]);
      await db.exec("set role authenticated");
      return db.query<T>(sql, args);
    }
    async function call<T>(user: string, fn: string, args: unknown[] = []) {
      const r = await as<{ value: T }>(
        user,
        `select public.${fn}(${args.map((_, i) => "$" + (i + 1)).join(",")}) as value`,
        args,
      );
      return r.rows[0]?.value;
    }
    const customerA = {
        id: id(),
        name: "이전 고객 개인정보",
        phone: "010-secret",
      },
      customerB = { id: id(), name: "새 고객", phone: "010-new" };
    for (const customer of [customerA, customerB])
      await call(admin, "save_customer", [JSON.stringify(customer)]);
    const vehicle = {
      id: id(),
      customerId: customerA.id,
      make: "Honda",
      model: "PCX",
      year: "2023",
      plate: "서울 가 1234",
      vin: "PRIVATE-VIN",
      nickname: "",
      ownershipId: id(),
      linked: false,
    };
    await call(admin, "save_vehicle", [JSON.stringify(vehicle)]);
    let r = newRecord(vehicle.id);
    r.fields.work = { text: "엔진오일 교환", public: true };
    r.fields.diagnosis = { text: "절대 노출 안 되는 내부 메모", public: false };
    r.notes = [{ id: id(), text: "내부 메모2", public: false }];
    r.revision = await call<number>(admin, "save_record_draft", [
      JSON.stringify(r),
    ]);
    const photo = id();
    await db.exec("reset role");
    await db.query(
      "insert into storage.objects(bucket_id,name,metadata) values('service-photos',$1,'{\"size\":100}')",
      [`${r.id}/${photo}`],
    );
    await call(admin, "register_photo", [
      photo,
      r.id,
      `${r.id}/${photo}`,
      "test.jpg",
    ]);
    r.photos = [
      {
        id: photo,
        path: `${r.id}/${photo}`,
        name: "test.jpg",
        caption: "내부 사진 설명",
        public: true,
        captionPublic: false,
        groupId: null,
        ready: true,
      },
    ];
    r.revision = await call<number>(admin, "save_record_draft", [
      JSON.stringify(r),
    ]);
    await call(admin, "publish_record", [r.id, r.revision]);
    const token = await call<string>(admin, "create_vehicle_invite", [
      vehicle.id,
      null,
    ]);
    await t.test("로그인하지 않은 수락·고객의 관리자 작업은 차단", async () => {
      await assert.rejects(call("", "accept_vehicle_invite", [token]));
      await assert.rejects(call(a, "get_admin_workspace"));
      await assert.rejects(
        call(a, "save_customer", [JSON.stringify(customerA)]),
      );
    });
    await call(a, "accept_vehicle_invite", [token]);
    await t.test("다른 계정은 같은 링크를 재사용할 수 없다", async () => {
      await assert.rejects(call(b, "accept_vehicle_invite", [token]));
      await call(a, "accept_vehicle_invite", [token]);
    });
    await t.test(
      "고객 응답에서 비공개 데이터와 고객 개인정보를 제외",
      async () => {
        const w = await call<Workspace>(a, "get_my_workspace");
        const raw = JSON.stringify(w);
        assert.equal(w.vehicles.length, 1);
        assert.equal(w.records.length, 0);
        assert.equal(w.customers.length, 0);
        assert.equal(w.publications[0].snapshot.fields.work, "엔진오일 교환");
        assert(!raw.includes("절대 노출"));
        assert(!raw.includes("이전 고객 개인정보"));
        assert(!raw.includes("010-secret"));
        assert(!raw.includes("PRIVATE-VIN"));
        assert(!raw.includes("내부 사진 설명"));
      },
    );
    await t.test(
      "직접 테이블 조회로 작성본·다른 차량·공개본을 우회할 수 없다",
      async () => {
        assert.equal(
          (await as(a, "select * from public.service_records")).rows.length,
          0,
        );
        assert.equal(
          (await as(a, "select * from public.record_publications")).rows.length,
          0,
        );
        assert.equal(
          (await call<Workspace>(b, "get_my_workspace")).vehicles.length,
          0,
        );
        assert.equal(
          (await as(a, "select * from public.vehicle_invites")).rows.length,
          0,
        );
        await assert.rejects(
          as(a, "insert into private.admin_users values($1)", [a]),
        );
      },
    );
    await t.test("사진 접근도 현재 연결 권한을 검사", async () => {
      assert.equal(
        await call(a, "authorized_photo_path", [photo]),
        `${r.id}/${photo}`,
      );
      await assert.rejects(call(b, "authorized_photo_path", [photo]));
    });
    await t.test(
      "작성본을 수정해도 기존 공개본은 유지되고 충돌 저장은 실패",
      async () => {
        const old = structuredClone(r);
        r.fields.work.text = "공개하지 않은 변경";
        r.revision = await call<number>(admin, "save_record_draft", [
          JSON.stringify(r),
        ]);
        await assert.rejects(
          call(admin, "save_record_draft", [JSON.stringify(old)]),
        );
        assert.equal(
          (await call<Workspace>(a, "get_my_workspace")).publications[0]
            .snapshot.fields.work,
          "엔진오일 교환",
        );
      },
    );
    const workspace = await call<Workspace>(a, "get_my_workspace");
    const snap = workspace.publications[0].snapshot;
    snap.fields.work = "검토된 공개 작업 내용";
    const tid = await call<string>(admin, "prepare_vehicle_transfer", [
      vehicle.id,
      customerB.id,
      JSON.stringify([{ recordId: r.id, snapshot: snap }]),
    ]);
    const transferToken = await call<string>(admin, "create_vehicle_invite", [
      vehicle.id,
      tid,
    ]);
    await call(b, "accept_vehicle_invite", [transferToken]);
    await t.test(
      "차량 양도는 이전 차주의 데이터·사진 접근을 해제",
      async () => {
        assert.equal(
          (await call<Workspace>(a, "get_my_workspace")).vehicles.length,
          0,
        );
        await assert.rejects(call(a, "authorized_photo_path", [photo]));
        const newOwner = await call<Workspace>(b, "get_my_workspace");
        assert.equal(newOwner.vehicles.length, 1);
        assert.equal(
          newOwner.publications[0].snapshot.fields.work,
          "검토된 공개 작업 내용",
        );
        assert.equal(
          await call(b, "authorized_photo_path", [photo]),
          `${r.id}/${photo}`,
        );
        assert(!JSON.stringify(newOwner).includes("이전 고객 개인정보"));
      },
    );
    await t.test("양도 초대도 다른 계정의 재사용을 차단", async () => {
      await assert.rejects(call(c, "accept_vehicle_invite", [transferToken]));
    });
    await t.test(
      "양도 검토 이후 공개본이 변경되면 재검토를 요구한다",
      async () => {
        const current = (await call<Workspace>(b, "get_my_workspace"))
          .publications[0];
        const nextTransfer = await call<string>(
          admin,
          "prepare_vehicle_transfer",
          [
            vehicle.id,
            customerA.id,
            JSON.stringify([{ recordId: r.id, snapshot: current.snapshot }]),
          ],
        );
        const nextToken = await call<string>(admin, "create_vehicle_invite", [
          vehicle.id,
          nextTransfer,
        ]);
        await call(admin, "publish_record", [r.id, r.revision]);
        await assert.rejects(call(c, "accept_vehicle_invite", [nextToken]));
        assert.equal(
          (await call<Workspace>(b, "get_my_workspace")).vehicles.length,
          1,
        );
        assert.equal(
          (await call<Workspace>(c, "get_my_workspace")).vehicles.length,
          0,
        );
        await call(admin, "cancel_vehicle_transfer", [nextTransfer]);
        await assert.rejects(call(c, "accept_vehicle_invite", [nextToken]));
      },
    );
    await t.test("비로그인 역할은 업무 RPC 실행 권한이 없다", async () => {
      await db.exec("reset role;set role anon");
      await assert.rejects(db.query("select public.get_admin_workspace()"));
      await assert.rejects(db.query("select public.get_my_workspace()"));
    });
  } finally {
    await db.close();
  }
});
