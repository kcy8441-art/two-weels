import { configured, supabase } from "./supabase/browser";
import { Customer, RecordDraft, Snapshot, Vehicle, Workspace } from "./domain";
export async function rpc<T>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase().rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}
export const live = {
  load: (customer = false) =>
    rpc<Workspace>(customer ? "get_my_workspace" : "get_admin_workspace"),
  saveCustomer: (customer: Customer) =>
    rpc<void>("save_customer", { p_customer: customer }),
  saveVehicle: (vehicle: Vehicle) =>
    rpc<void>("save_vehicle", { p_vehicle: vehicle }),
  saveRecord: (record: RecordDraft) =>
    rpc<number>("save_record_draft", { p_record: record }),
  publish: (record: RecordDraft) =>
    rpc<void>("publish_record", {
      p_record_id: record.id,
      p_expected_revision: record.revision,
    }),
  invite: (vehicleId: string, transferId: string | null = null) =>
    rpc<string>("create_vehicle_invite", {
      p_vehicle_id: vehicleId,
      p_transfer_id: transferId,
    }),
  revoke: (inviteId: string) =>
    rpc<void>("revoke_vehicle_invite", { p_invite_id: inviteId }),
  accept: (token: string) =>
    rpc<void>("accept_vehicle_invite", { p_token: token }),
  transfer: (
    vehicleId: string,
    customerId: string,
    snapshots: { recordId: string; snapshot: Snapshot }[],
  ) =>
    rpc<string>("prepare_vehicle_transfer", {
      p_vehicle_id: vehicleId,
      p_customer_id: customerId,
      p_snapshots: snapshots,
    }),
  cancelTransfer: (transferId: string) =>
    rpc<void>("cancel_vehicle_transfer", { p_transfer_id: transferId }),
  async upload(recordId: string, file: File, photoId: string) {
    const path = `${recordId}/${photoId}`;
    const { error } = await supabase()
      .storage.from("service-photos")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw new Error(error.message);
    await rpc("register_photo", {
      p_id: photoId,
      p_record_id: recordId,
      p_path: path,
      p_name: file.name,
    });
    return path;
  },
  async photo(photoId: string) {
    const {
      data: { session },
    } = await supabase().auth.getSession();
    if (!session) throw new Error("로그인이 필요합니다.");
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/photo`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ photoId }),
        cache: "no-store",
      },
    );
    if (!response.ok) throw new Error("사진을 가져오지 못했습니다.");
    return URL.createObjectURL(await response.blob());
  },
};
export { configured };
