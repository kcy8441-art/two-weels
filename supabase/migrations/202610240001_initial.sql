create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table private.admin_users(user_id uuid primary key references auth.users(id),singleton boolean not null default true unique check(singleton));
create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from private.admin_users where user_id=auth.uid())$$;
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$select private.is_admin()$$;
create function private.require_admin() returns void language plpgsql security definer set search_path='' as $$begin if not private.is_admin() then raise exception '정비사 권한이 필요합니다.';end if;end$$;

create table public.customers(id uuid primary key default gen_random_uuid(),name text not null check(length(trim(name)) between 1 and 100),phone text not null default '' check(length(phone)<=40),created_at timestamptz not null default now());
create table public.vehicles(id uuid primary key default gen_random_uuid(),make text not null,model text not null check(length(trim(model)) between 1 and 100),year text not null default '',plate text not null default '',vin text not null default '',nickname text not null default '',created_at timestamptz not null default now());
create table public.vehicle_ownerships(id uuid primary key default gen_random_uuid(),vehicle_id uuid not null references public.vehicles(id),customer_id uuid not null references public.customers(id),started_at timestamptz not null default now(),ended_at timestamptz,unique(id,vehicle_id));
create unique index one_current_owner on public.vehicle_ownerships(vehicle_id) where ended_at is null;
create table public.vehicle_access(ownership_id uuid primary key references public.vehicle_ownerships(id),user_id uuid not null references auth.users(id),created_at timestamptz not null default now());
create index access_user on public.vehicle_access(user_id);
create table public.service_records(id uuid primary key default gen_random_uuid(),vehicle_id uuid not null references public.vehicles(id),ownership_id uuid not null references public.vehicle_ownerships(id),service_date date not null,mileage integer check(mileage>=0),status text not null check(status in ('received','inspecting','working','completed','delivered')),revision integer not null default 1,draft jsonb not null,updated_at timestamptz not null default now());
create index record_history on public.service_records(vehicle_id,service_date desc,id desc);
create table public.photos(id uuid primary key,record_id uuid not null references public.service_records(id),path text not null unique,name text not null,created_at timestamptz not null default now());
create table public.record_publications(id uuid primary key default gen_random_uuid(),record_id uuid not null references public.service_records(id),vehicle_id uuid not null references public.vehicles(id),ownership_id uuid not null references public.vehicle_ownerships(id),version integer not null,snapshot jsonb not null,published_at timestamptz not null default now(),unique(record_id,ownership_id,version));
create index publication_history on public.record_publications(ownership_id,record_id,version desc);
create table public.publication_photos(publication_id uuid not null references public.record_publications(id),photo_id uuid not null references public.photos(id),primary key(publication_id,photo_id));
create table public.vehicle_transfers(id uuid primary key default gen_random_uuid(),vehicle_id uuid not null references public.vehicles(id),from_ownership_id uuid not null references public.vehicle_ownerships(id),customer_id uuid not null references public.customers(id),snapshots jsonb not null,source_versions jsonb not null,status text not null default 'pending' check(status in ('pending','completed','cancelled')),created_at timestamptz not null default now());
create unique index one_pending_transfer on public.vehicle_transfers(vehicle_id) where status='pending';
create table public.vehicle_invites(id uuid primary key default gen_random_uuid(),vehicle_id uuid not null references public.vehicles(id),ownership_id uuid not null references public.vehicle_ownerships(id),transfer_id uuid references public.vehicle_transfers(id),token_hash text not null unique,status text not null default 'pending' check(status in ('pending','used','revoked')),accepted_by uuid references auth.users(id),expires_at timestamptz not null default now()+interval '7 days',created_at timestamptz not null default now());
create table private.audit_events(id uuid primary key default gen_random_uuid(),actor_id uuid,event text not null,target_id uuid,created_at timestamptz not null default now());

create function private.can_access(p_vehicle_id uuid,p_ownership_id uuid default null) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.vehicle_ownerships o join public.vehicle_access a on a.ownership_id=o.id where o.vehicle_id=p_vehicle_id and o.ended_at is null and a.user_id=auth.uid() and (p_ownership_id is null or o.id=p_ownership_id))$$;
create function private.vehicle_json(v public.vehicles,o public.vehicle_ownerships) returns jsonb language sql stable set search_path='' as $$select jsonb_build_object('id',v.id,'customerId',o.customer_id,'make',v.make,'model',v.model,'year',v.year,'plate',v.plate,'vin',v.vin,'nickname',v.nickname,'ownershipId',o.id,'linked',exists(select 1 from public.vehicle_access where ownership_id=o.id))$$;
create function private.pub_json(p public.record_publications) returns jsonb language sql stable set search_path='' as $$select jsonb_build_object('id',p.id,'recordId',p.record_id,'vehicleId',p.vehicle_id,'ownershipId',p.ownership_id,'version',p.version,'publishedAt',p.published_at,'snapshot',p.snapshot)$$;

-- Drafts and management data are administrator-only; customers use explicitly projected RPCs.
alter table public.customers enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_ownerships enable row level security;
alter table public.vehicle_access enable row level security;
alter table public.service_records enable row level security;
alter table public.photos enable row level security;
alter table public.record_publications enable row level security;
alter table public.publication_photos enable row level security;
alter table public.vehicle_transfers enable row level security;
alter table public.vehicle_invites enable row level security;
create policy admin_read on public.customers for select to authenticated using(private.is_admin());
create policy admin_read on public.vehicles for select to authenticated using(private.is_admin());
create policy admin_read on public.vehicle_ownerships for select to authenticated using(private.is_admin());
create policy admin_read on public.vehicle_access for select to authenticated using(private.is_admin());
create policy admin_read on public.service_records for select to authenticated using(private.is_admin());
create policy admin_read on public.photos for select to authenticated using(private.is_admin());
create policy admin_read on public.record_publications for select to authenticated using(private.is_admin());
create policy admin_read on public.publication_photos for select to authenticated using(private.is_admin());
create policy admin_read on public.vehicle_transfers for select to authenticated using(private.is_admin());
-- No direct invitation select policy: token hashes are never returned to clients.

create function public.get_admin_workspace() returns jsonb language plpgsql security definer set search_path='' as $$begin perform private.require_admin();return jsonb_build_object(
'customers',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'phone',phone)) from public.customers),'[]'),
'vehicles',coalesce((select jsonb_agg(private.vehicle_json(v,o)) from public.vehicles v join public.vehicle_ownerships o on o.vehicle_id=v.id and o.ended_at is null),'[]'),
'records',coalesce((select jsonb_agg(draft||jsonb_build_object('revision',revision)) from public.service_records),'[]'),
'publications',coalesce((select jsonb_agg(private.pub_json(p)) from public.record_publications p),'[]'),
'invites',coalesce((select jsonb_agg(jsonb_build_object('id',id,'vehicleId',vehicle_id,'ownershipId',ownership_id,'status',case when status='pending' and expires_at<now() then 'revoked' else status end,'transferId',transfer_id)) from public.vehicle_invites),'[]'),
'transfers',coalesce((select jsonb_agg(jsonb_build_object('id',id,'vehicleId',vehicle_id,'customerId',customer_id,'status',status,'snapshots',snapshots)) from public.vehicle_transfers),'[]'));
end$$;

create function public.get_my_workspace() returns jsonb language plpgsql security definer set search_path='' as $$begin if auth.uid() is null then raise exception '로그인이 필요합니다.';end if;return jsonb_build_object('customers','[]'::jsonb,'records','[]'::jsonb,'invites','[]'::jsonb,'transfers','[]'::jsonb,
'vehicles',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'customerId','','make',v.make,'model',v.model,'year',v.year,'plate',v.plate,'vin','','nickname',v.nickname,'ownershipId',o.id,'linked',true)) from public.vehicles v join public.vehicle_ownerships o on o.vehicle_id=v.id and o.ended_at is null where private.can_access(v.id,o.id)),'[]'),
'publications',coalesce((select jsonb_agg(private.pub_json(p)) from public.record_publications p where private.can_access(p.vehicle_id,p.ownership_id) and p.version=(select max(q.version) from public.record_publications q where q.record_id=p.record_id and q.ownership_id=p.ownership_id)),'[]'));end$$;

create function public.save_customer(p_customer jsonb) returns void language plpgsql security definer set search_path='' as $$begin perform private.require_admin();insert into public.customers(id,name,phone) values((p_customer->>'id')::uuid,trim(p_customer->>'name'),coalesce(p_customer->>'phone','')) on conflict(id) do update set name=excluded.name,phone=excluded.phone;end$$;
create function public.save_vehicle(p_vehicle jsonb) returns void language plpgsql security definer set search_path='' as $$declare existing uuid;begin perform private.require_admin();insert into public.vehicles(id,make,model,year,plate,vin,nickname) values((p_vehicle->>'id')::uuid,coalesce(p_vehicle->>'make',''),p_vehicle->>'model',coalesce(p_vehicle->>'year',''),coalesce(p_vehicle->>'plate',''),coalesce(p_vehicle->>'vin',''),coalesce(p_vehicle->>'nickname','')) on conflict(id) do update set make=excluded.make,model=excluded.model,year=excluded.year,plate=excluded.plate,vin=excluded.vin,nickname=excluded.nickname;
select customer_id into existing from public.vehicle_ownerships where vehicle_id=(p_vehicle->>'id')::uuid and ended_at is null;
if existing is null then insert into public.vehicle_ownerships(id,vehicle_id,customer_id) values((p_vehicle->>'ownershipId')::uuid,(p_vehicle->>'id')::uuid,(p_vehicle->>'customerId')::uuid);elsif existing<>(p_vehicle->>'customerId')::uuid then raise exception '소유 고객 변경은 차량 양도를 이용해 주세요.';end if;end$$;

create function public.save_record_draft(p_record jsonb) returns integer language plpgsql security definer set search_path='' as $$declare old public.service_records; owner_id uuid; n integer;begin
perform private.require_admin();perform 1 from public.vehicles where id=(p_record->>'vehicleId')::uuid for update;
select * into old from public.service_records where id=(p_record->>'id')::uuid for update;
if old.id is not null and (old.revision<>(p_record->>'revision')::integer or old.vehicle_id<>(p_record->>'vehicleId')::uuid) then raise exception '다른 화면에서 수정한 내용이 있습니다. 다시 열어 주세요.';end if;
if old.id is null and (p_record->>'revision')::integer<>0 then raise exception '기록을 다시 확인해 주세요.';end if;
if jsonb_typeof(p_record->'fields')<>'object' or jsonb_typeof(p_record->'photos')<>'array' or jsonb_typeof(p_record->'groups')<>'array' or jsonb_typeof(p_record->'notes')<>'array' then raise exception '기록 형식이 올바르지 않습니다.';end if;
if exists(select 1 from jsonb_array_elements(p_record->'photos') x where (x->>'ready')::boolean and not exists(select 1 from public.photos p where p.id=(x->>'id')::uuid and p.record_id=(p_record->>'id')::uuid)) then raise exception '완료된 업로드가 아닌 사진입니다.';end if;
if exists(select 1 from jsonb_array_elements(p_record->'photos') x where nullif(x->>'groupId','') is not null and not exists(select 1 from jsonb_array_elements(p_record->'groups') g where g->>'id'=x->>'groupId')) then raise exception '사진 묶음이 올바르지 않습니다.';end if;
select id into owner_id from public.vehicle_ownerships where vehicle_id=(p_record->>'vehicleId')::uuid and ended_at is null;
if owner_id is null then raise exception '현재 차량 소유 정보가 없습니다.';end if;
n:=coalesce(old.revision,0)+1;
insert into public.service_records(id,vehicle_id,ownership_id,service_date,mileage,status,revision,draft) values((p_record->>'id')::uuid,(p_record->>'vehicleId')::uuid,coalesce(old.ownership_id,owner_id),(p_record->>'date')::date,(p_record->>'mileage')::integer,p_record->>'status',n,p_record-'url'||jsonb_build_object('revision',n)) on conflict(id) do update set service_date=excluded.service_date,mileage=excluded.mileage,status=excluded.status,revision=n,draft=excluded.draft,updated_at=now();return n;end$$;

create function public.register_photo(p_id uuid,p_record_id uuid,p_path text,p_name text) returns void language plpgsql security definer set search_path='' as $$begin perform private.require_admin();if p_path<>p_record_id::text||'/'||p_id::text then raise exception '사진 경로가 올바르지 않습니다.';end if;if not exists(select 1 from storage.objects where bucket_id='service-photos' and name=p_path and (metadata->>'size')::bigint>0) then raise exception '업로드된 파일이 없습니다.';end if;insert into public.photos(id,record_id,path,name) values(p_id,p_record_id,p_path,left(p_name,255)) on conflict(id) do nothing;end$$;

create function private.snapshot(p_record jsonb) returns jsonb language plpgsql stable set search_path='' as $$declare fields jsonb:='{}';k text;ps jsonb;gs jsonb;ns jsonb;begin
foreach k in array array['request','diagnosis','work','deferred','next'] loop if coalesce((p_record->'fields'->k->>'public')::boolean,false) and length(trim(coalesce(p_record->'fields'->k->>'text','')))>0 then fields:=fields||jsonb_build_object(k,p_record->'fields'->k->>'text');end if;end loop;
select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'caption',case when (x->>'captionPublic')::boolean then coalesce(x->>'caption','') else '' end,'groupId',x->'groupId') order by ord),'[]') into ps from jsonb_array_elements(p_record->'photos') with ordinality a(x,ord) join public.photos p on p.id=(x->>'id')::uuid and p.record_id=(p_record->>'id')::uuid where (x->>'public')::boolean and (x->>'ready')::boolean;
if (select count(*) from jsonb_array_elements(p_record->'photos') x where (x->>'public')::boolean)<>jsonb_array_length(ps) then raise exception '업로드가 끝나지 않은 사진은 공개할 수 없습니다.';end if;
select coalesce(jsonb_agg(jsonb_build_object('id',g->>'id','title',case when (g->>'descriptionPublic')::boolean then g->>'title' else '' end,'description',case when (g->>'descriptionPublic')::boolean then g->>'description' else '' end,'descriptionPublic',(g->>'descriptionPublic')::boolean)),'[]') into gs from jsonb_array_elements(p_record->'groups') g where exists(select 1 from jsonb_array_elements(ps) p where p->>'groupId'=g->>'id');
select coalesce(jsonb_agg(x->>'text'),'[]') into ns from jsonb_array_elements(p_record->'notes') x where (x->>'public')::boolean and length(trim(x->>'text'))>0;
return jsonb_build_object('date',p_record->>'date','mileage',p_record->'mileage','status',p_record->>'status','fields',fields,'notes',ns,'groups',gs,'photos',ps);end$$;

create function public.publish_record(p_record_id uuid,p_expected_revision integer) returns void language plpgsql security definer set search_path='' as $$declare r public.service_records; o uuid; pub uuid; s jsonb;begin perform private.require_admin();perform 1 from public.vehicles where id=(select vehicle_id from public.service_records where id=p_record_id) for update;select * into r from public.service_records where id=p_record_id for update;if r.id is null or r.revision<>p_expected_revision then raise exception '기록이 변경되었습니다. 새로 확인해 주세요.';end if;select id into o from public.vehicle_ownerships where vehicle_id=r.vehicle_id and ended_at is null;s:=private.snapshot(r.draft);insert into public.record_publications(record_id,vehicle_id,ownership_id,version,snapshot) values(r.id,r.vehicle_id,o,coalesce((select max(version) from public.record_publications where record_id=r.id and ownership_id=o),0)+1,s) returning id into pub;insert into public.publication_photos select pub,(x->>'id')::uuid from jsonb_array_elements(s->'photos') x;insert into private.audit_events(actor_id,event,target_id) values(auth.uid(),'publish',r.id);end$$;

create function public.create_vehicle_invite(p_vehicle_id uuid,p_transfer_id uuid default null) returns text language plpgsql security definer set search_path='' as $$declare token text; owner_id uuid;begin perform private.require_admin();perform 1 from public.vehicles where id=p_vehicle_id for update;select id into owner_id from public.vehicle_ownerships where vehicle_id=p_vehicle_id and ended_at is null;if owner_id is null then raise exception '차량을 찾을 수 없습니다.';end if;if p_transfer_id is null and exists(select 1 from public.vehicle_access where ownership_id=owner_id) then raise exception '이미 연결된 차량입니다. 양도 절차를 이용해 주세요.';end if;if p_transfer_id is not null and not exists(select 1 from public.vehicle_transfers where id=p_transfer_id and vehicle_id=p_vehicle_id and status='pending' and from_ownership_id=owner_id) then raise exception '양도 정보를 확인해 주세요.';end if;
update public.vehicle_invites set status='revoked' where vehicle_id=p_vehicle_id and status='pending';token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');insert into public.vehicle_invites(vehicle_id,ownership_id,transfer_id,token_hash) values(p_vehicle_id,owner_id,p_transfer_id,encode(sha256(convert_to(token,'UTF8')),'hex'));return token;end$$;
create function public.revoke_vehicle_invite(p_invite_id uuid) returns void language plpgsql security definer set search_path='' as $$begin perform private.require_admin();update public.vehicle_invites set status='revoked' where id=p_invite_id and status='pending';end$$;

create function public.prepare_vehicle_transfer(p_vehicle_id uuid,p_customer_id uuid,p_snapshots jsonb) returns uuid language plpgsql security definer set search_path='' as $$declare o uuid; tid uuid; item jsonb; source jsonb; versions jsonb; clean jsonb:='[]'; photos jsonb; fs jsonb; gs jsonb;begin perform private.require_admin();perform 1 from public.vehicles where id=p_vehicle_id for update;select id into o from public.vehicle_ownerships where vehicle_id=p_vehicle_id and ended_at is null;if o is null or exists(select 1 from public.vehicle_ownerships where id=o and customer_id=p_customer_id) then raise exception '새 소유 고객을 선택해 주세요.';end if;
select coalesce(jsonb_object_agg(record_id::text,version),'{}') into versions from (select record_id,max(version) version from public.record_publications where ownership_id=o group by record_id) q;
for item in select * from jsonb_array_elements(p_snapshots) loop
select snapshot into source from public.record_publications where record_id=(item->>'recordId')::uuid and ownership_id=o order by version desc limit 1;if source is null then raise exception '기존 공개본이 없는 기록입니다.';end if;
if exists(select 1 from jsonb_array_elements(item->'snapshot'->'photos') p where not exists(select 1 from jsonb_array_elements(source->'photos') s where s->>'id'=p->>'id')) then raise exception '기존에 공개된 사진만 이전할 수 있습니다.';end if;
select coalesce(jsonb_agg(jsonb_build_object('id',g->>'id','title',coalesce(g->>'title',''),'description',coalesce(g->>'description',''),'descriptionPublic',true)),'[]') into gs from jsonb_array_elements(item->'snapshot'->'groups') g where exists(select 1 from jsonb_array_elements(item->'snapshot'->'photos') p where p->>'groupId'=g->>'id');
select coalesce(jsonb_agg(jsonb_build_object('id',p->>'id','caption',coalesce(p->>'caption',''),'groupId',case when exists(select 1 from jsonb_array_elements(gs) g where g->>'id'=p->>'groupId') then p->'groupId' else 'null'::jsonb end)),'[]') into photos from jsonb_array_elements(item->'snapshot'->'photos') p;
select coalesce(jsonb_object_agg(key,value),'{}') into fs from jsonb_each(item->'snapshot'->'fields') where key in ('request','diagnosis','work','deferred','next') and jsonb_typeof(value)='string';
clean:=clean||jsonb_build_array(jsonb_build_object('recordId',item->>'recordId','snapshot',jsonb_build_object('date',source->'date','mileage',source->'mileage','status',source->'status','fields',fs,'notes',coalesce((select jsonb_agg(x) from jsonb_array_elements(item->'snapshot'->'notes') x where jsonb_typeof(x)='string'),'[]'),'photos',photos,'groups',gs)));
end loop;
insert into public.vehicle_transfers(vehicle_id,from_ownership_id,customer_id,snapshots,source_versions) values(p_vehicle_id,o,p_customer_id,clean,versions) returning id into tid;return tid;end$$;
create function public.cancel_vehicle_transfer(p_transfer_id uuid) returns void language plpgsql security definer set search_path='' as $$begin perform private.require_admin();update public.vehicle_transfers set status='cancelled' where id=p_transfer_id and status='pending';update public.vehicle_invites set status='revoked' where transfer_id=p_transfer_id and status='pending';end$$;

create function public.accept_vehicle_invite(p_token text) returns void language plpgsql security definer set search_path='' as $$declare i public.vehicle_invites;t public.vehicle_transfers;v uuid;o uuid;item jsonb;pub uuid;versions jsonb;begin
if auth.uid() is null then raise exception '로그인이 필요합니다.';end if;
select vehicle_id into v from public.vehicle_invites where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');perform 1 from public.vehicles where id=v for update;
select * into i from public.vehicle_invites where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') for update;
if i.status='used' and i.accepted_by=auth.uid() then return;end if;
if i.id is null or i.status<>'pending' or i.expires_at<now() then raise exception '이미 사용했거나 만료·폐기된 초대 링크입니다.';end if;
if not exists(select 1 from public.vehicle_ownerships where id=i.ownership_id and ended_at is null) then raise exception '차량 소유 정보가 변경되었습니다.';end if;
if i.transfer_id is null then
if exists(select 1 from public.vehicle_access where ownership_id=i.ownership_id) then raise exception '이미 연결된 차량입니다.';end if;insert into public.vehicle_access(ownership_id,user_id) values(i.ownership_id,auth.uid());
else
select * into t from public.vehicle_transfers where id=i.transfer_id for update;if t.status<>'pending' then raise exception '취소된 양도입니다.';end if;
select coalesce(jsonb_object_agg(record_id::text,version),'{}') into versions from (select record_id,max(version) version from public.record_publications where ownership_id=i.ownership_id group by record_id) q;if versions<>t.source_versions then raise exception '공개 이력이 변경되었습니다. 정비사의 재검토가 필요합니다.';end if;
update public.vehicle_ownerships set ended_at=now() where id=i.ownership_id;delete from public.vehicle_access where ownership_id=i.ownership_id;
insert into public.vehicle_ownerships(vehicle_id,customer_id) values(i.vehicle_id,t.customer_id) returning id into o;insert into public.vehicle_access(ownership_id,user_id) values(o,auth.uid());
for item in select * from jsonb_array_elements(t.snapshots) loop insert into public.record_publications(record_id,vehicle_id,ownership_id,version,snapshot) values((item->>'recordId')::uuid,i.vehicle_id,o,1,item->'snapshot') returning id into pub;insert into public.publication_photos select pub,(p->>'id')::uuid from jsonb_array_elements(item->'snapshot'->'photos') p;end loop;
update public.vehicle_transfers set status='completed' where id=t.id;
end if;
update public.vehicle_invites set status='used',accepted_by=auth.uid() where id=i.id;update public.vehicle_invites set status='revoked' where vehicle_id=i.vehicle_id and id<>i.id and status='pending';insert into private.audit_events(actor_id,event,target_id) values(auth.uid(),case when i.transfer_id is null then 'accept_invite' else 'transfer' end,i.vehicle_id);
end$$;

-- The Edge Function calls this RPC with the customer's JWT before reading a file.
create function public.authorized_photo_path(p_photo_id uuid) returns text language plpgsql security definer set search_path='' as $$declare result text;begin select path into result from public.photos p where p.id=p_photo_id and (private.is_admin() or exists(select 1 from public.publication_photos pp join public.record_publications r on r.id=pp.publication_id where pp.photo_id=p.id and private.can_access(r.vehicle_id,r.ownership_id) and r.version=(select max(q.version) from public.record_publications q where q.record_id=r.record_id and q.ownership_id=r.ownership_id)));if result is null then raise exception '사진에 접근할 수 없습니다.';end if;return result;end$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('service-photos','service-photos',false,10485760,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy mechanic_upload on storage.objects for insert to authenticated with check(bucket_id='service-photos' and private.is_admin() and exists(select 1 from public.service_records where id::text=split_part(name,'/',1)));
-- No customer direct download or signed URL policy. Edge Function authorizes each response.

revoke all on all tables in schema public from anon,authenticated;
grant select on all tables in schema public to authenticated;
revoke execute on all functions in schema public from public,anon;
grant execute on all functions in schema public to authenticated;
revoke execute on all functions in schema private from public,anon,authenticated;
grant execute on function private.is_admin() to authenticated;
