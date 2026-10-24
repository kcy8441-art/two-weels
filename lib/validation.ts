import { z } from "zod";
const uuid = z.uuid("식별자가 올바르지 않습니다.");
export const customerSchema = z.object({
  id: uuid,
  name: z.string().trim().min(1, "고객 이름을 입력해 주세요.").max(100),
  phone: z.string().trim().max(40),
});
export const vehicleSchema = z.object({
  id: uuid,
  customerId: uuid,
  ownershipId: uuid,
  linked: z.boolean(),
  make: z.string().trim().max(100),
  model: z.string().trim().min(1, "모델명을 입력해 주세요.").max(100),
  year: z.string().max(20),
  plate: z.string().max(100),
  vin: z.string().max(100),
  nickname: z.string().max(100),
});
export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new Error(
      result.error.issues[0]?.message ?? "입력 내용을 확인해 주세요.",
    );
  return result.data;
}
