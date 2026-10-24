"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  acceptIn,
  loadDemo,
  publishIn,
  saveDemo,
  saveDraftIn,
} from "@/lib/demo";
import {
  Customer,
  Invite,
  RecordDraft,
  Snapshot,
  Vehicle,
  Workspace,
  emptyWorkspace,
  id,
} from "@/lib/domain";
import { live } from "@/lib/repository";
import { customerSchema, vehicleSchema, parseInput } from "@/lib/validation";
import { validateDraft } from "@/lib/domain";
type Action = (w: Workspace) => Workspace;
function useStoreValue(demo: boolean, customer: boolean) {
  const [data, setData] = useState<Workspace>(emptyWorkspace),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const notify = (text: string) => setMessage(text);
  async function reload() {
    setError("");
    try {
      setData(demo ? await loadDemo() : await live.load(customer));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "데이터를 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void reload();
    const listener = () => void reload();
    window.addEventListener("focus", listener);
    return () => window.removeEventListener("focus", listener);
  }, [demo, customer]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 4500);
    return () => clearTimeout(t);
  }, [message]);
  async function mutate(action: Action) {
    const operation = queue.current
      .catch(() => {})
      .then(async () => {
        const old = await loadDemo();
        const next = action(old);
        await saveDemo(next);
        setData(next);
        return next;
      });
    queue.current = operation;
    return operation;
  }
  async function saveCustomer(c: Customer) {
    c = parseInput(customerSchema, c);
    if (demo)
      await mutate((w) => ({
        ...w,
        customers: [...w.customers.filter((x) => x.id !== c.id), c],
      }));
    else {
      await live.saveCustomer(c);
      await reload();
    }
  }
  async function saveVehicle(v: Vehicle) {
    v = parseInput(vehicleSchema, v);
    if (demo)
      await mutate((w) => ({
        ...w,
        vehicles: [...w.vehicles.filter((x) => x.id !== v.id), v],
      }));
    else {
      await live.saveVehicle(v);
      await reload();
    }
  }
  async function saveRecord(r: RecordDraft) {
    validateDraft(r);
    if (demo) {
      const next = await mutate((w) => saveDraftIn(w, r));
      return next.records.find((x) => x.id === r.id)!.revision;
    }
    const revision = await live.saveRecord(r);
    await reload();
    return revision;
  }
  async function publish(r: RecordDraft) {
    if (demo) await mutate((w) => publishIn(w, r));
    else {
      await live.publish(r);
      await reload();
    }
  }
  async function invite(vehicleId: string, transferId?: string) {
    if (!demo) {
      const token = await live.invite(vehicleId, transferId ?? null);
      await reload();
      return token;
    }
    const token = id().replaceAll("-", "") + id().replaceAll("-", "");
    await mutate((w) => {
      const v = w.vehicles.find((x) => x.id === vehicleId)!;
      if (v.linked && !transferId) throw new Error("이미 연결된 차량입니다.");
      const invite: Invite = {
        id: id(),
        vehicleId,
        ownershipId: v.ownershipId,
        token,
        status: "pending",
        transferId,
      };
      return {
        ...w,
        invites: [
          ...w.invites.map((i) =>
            i.vehicleId === vehicleId && i.status === "pending"
              ? { ...i, status: "revoked" as const }
              : i,
          ),
          invite,
        ],
      };
    });
    return token;
  }
  async function revoke(inviteId: string) {
    if (demo)
      await mutate((w) => ({
        ...w,
        invites: w.invites.map((i) =>
          i.id === inviteId ? { ...i, status: "revoked" } : i,
        ),
      }));
    else {
      await live.revoke(inviteId);
      await reload();
    }
  }
  async function accept(token: string) {
    if (demo) await mutate((w) => acceptIn(w, token));
    else {
      await live.accept(token);
      await reload();
    }
  }
  async function transfer(
    vehicleId: string,
    customerId: string,
    snapshots: { recordId: string; snapshot: Snapshot }[],
  ) {
    if (!demo) {
      const result = await live.transfer(vehicleId, customerId, snapshots);
      await reload();
      return result;
    }
    const transferId = id();
    await mutate((w) => {
      if (
        w.transfers.some(
          (t) => t.vehicleId === vehicleId && t.status === "pending",
        )
      )
        throw new Error("진행 중인 양도가 있습니다.");
      const ownershipId = w.vehicles.find(
        (v) => v.id === vehicleId,
      )?.ownershipId;
      const sourceVersions: Record<string, number> = {};
      for (const p of w.publications.filter(
        (p) => p.vehicleId === vehicleId && p.ownershipId === ownershipId,
      ))
        sourceVersions[p.recordId] = Math.max(
          sourceVersions[p.recordId] ?? 0,
          p.version,
        );
      return {
        ...w,
        transfers: [
          ...w.transfers,
          {
            id: transferId,
            vehicleId,
            customerId,
            snapshots,
            sourceVersions,
            status: "pending",
          },
        ],
      };
    });
    return transferId;
  }
  async function cancelTransfer(transferId: string) {
    if (demo)
      await mutate((w) => ({
        ...w,
        transfers: w.transfers.map((t) =>
          t.id === transferId ? { ...t, status: "cancelled" } : t,
        ),
        invites: w.invites.map((i) =>
          i.transferId === transferId && i.status === "pending"
            ? { ...i, status: "revoked" }
            : i,
        ),
      }));
    else {
      await live.cancelTransfer(transferId);
      await reload();
    }
  }
  return {
    data,
    loading,
    error,
    message,
    demo,
    customer,
    reload,
    notify,
    saveCustomer,
    saveVehicle,
    saveRecord,
    publish,
    invite,
    revoke,
    accept,
    transfer,
    cancelTransfer,
  };
}
const Store = createContext<ReturnType<typeof useStoreValue> | null>(null);
export function StoreProvider({
  demo,
  customer,
  children,
}: {
  demo: boolean;
  customer: boolean;
  children: ReactNode;
}) {
  const value = useStoreValue(demo, customer);
  return (
    <Store.Provider value={value}>
      {children}
      {value.message && (
        <div className="toast" role="status">
          {value.message}
        </div>
      )}
    </Store.Provider>
  );
}
export function useWorkspace() {
  const value = useContext(Store);
  if (!value) throw new Error("Workspace provider missing");
  return value;
}
