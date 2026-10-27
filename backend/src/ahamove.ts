import { z } from 'zod';
import { HttpError } from './domain';

export const ahaOrderSchema = z.object({
  _id: z.string().min(1), status: z.string().min(1),
  path: z.array(z.object({ status: z.string().optional(), tracking_number: z.string().optional() }).passthrough()).min(2),
  shared_link: z.string().optional(), supplier_name: z.string().optional(), supplier_id: z.string().optional(),
  supplier_mobile: z.string().optional(), total_fee: z.number().optional(), total_price: z.number().optional(),
}).passthrough();
export type AhaOrder = z.infer<typeof ahaOrderSchema>;
export type AhaPayload = {
  order_time: number; service_id: string; requests: never[]; payment_method: 'BALANCE';
  path: { address: string; name: string; mobile: string; cod?: number; item_value?: number; tracking_number?: string; remarks?: string }[];
  remarks: string;
};
export type AhaConfig = { apiKey: string; mobile: string; serviceId: string; webhookSecret: string;
  pickup: { address: string; name: string; mobile: string }; staffUids: string[] };

function providerData<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new HttpError(502, 'Ahamove trả về dữ liệu không hợp lệ.', 'AHAMOVE_RESPONSE');
  return parsed.data;
}

export class AhamoveClient {
  // Staging only. Production booking must be enabled as a separate, reviewed rollout.
  private readonly base = 'https://partner-apistg.ahamove.com';
  private token = '';
  private tokenUntil = 0;
  private tokenRequest?: Promise<string>;
  constructor(private config: AhaConfig, private http: typeof fetch = fetch) {}

  private async send(path: string, body?: unknown, token?: string) {
    let response: Response;
    try {
      response = await this.http(this.base + path, { method: body === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000), redirect: 'error' });
    } catch { throw new HttpError(502, 'Chưa nhận được kết quả từ Ahamove. Kiểm tra chuyến trước khi thử lại.', 'AHAMOVE_UNAVAILABLE'); }
    if (!response.ok) {
      if (response.status === 401) { this.token = ''; this.tokenUntil = 0; }
      const code = response.status === 401 ? 'AHAMOVE_AUTH' : response.status === 404 ? 'AHAMOVE_NOT_FOUND' : 'AHAMOVE_REJECTED';
      throw new HttpError(502, response.status === 401 ? 'Kiểm tra tài khoản và API key Ahamove staging.' :
        'Ahamove chưa xử lý được yêu cầu. Kiểm tra địa chỉ, dịch vụ và số dư staging.', code);
    }
    try { return await response.json() as unknown; }
    catch { throw new HttpError(502, 'Ahamove trả về dữ liệu không hợp lệ.', 'AHAMOVE_RESPONSE'); }
  }
  private async authorize() {
    if (this.token && this.tokenUntil > Date.now()) return this.token;
    if (!this.tokenRequest) {
      this.tokenRequest = (async () => {
        const value = providerData(z.object({ token: z.string().min(1) }), await this.send('/v3/accounts/token', {
          api_key: this.config.apiKey, mobile: this.config.mobile,
        }));
        this.token = value.token;
        this.tokenUntil = Date.now() + 5 * 60_000;
        return this.token;
      })().finally(() => { this.tokenRequest = undefined; });
    }
    return this.tokenRequest;
  }
  async estimate(payload: AhaPayload) {
    const { service_id, requests, ...rest } = payload;
    const result = providerData(z.array(z.object({ service_id: z.string(), data: z.object({
      total_fee: z.number().int().nonnegative().max(5_000_000), duration: z.number().nonnegative().optional(),
    }).optional() })), await this.send('/v3/orders/estimates', {
      ...rest, services: [{ _id: service_id, requests }],
    }, await this.authorize()));
    const match = result.find(item => item.service_id === service_id)?.data;
    if (!match) throw new HttpError(422, 'Ahamove chưa có dịch vụ cho địa chỉ này.', 'AHAMOVE_NO_SERVICE');
    return match;
  }
  async create(payload: AhaPayload) {
    const result = providerData(z.object({ order_id: z.string().min(1) }), await this.send('/v3/orders', payload, await this.authorize()));
    // Read canonical order data, including the actual result at the drop-off point.
    return this.get(result.order_id);
  }
  async get(id: string) {
    return providerData(ahaOrderSchema, await this.send(`/v3/orders/${encodeURIComponent(id)}`, undefined, await this.authorize()));
  }
  async find(tracking: string) {
    const result = providerData(z.array(ahaOrderSchema), await this.send(`/v3/orders/tracks/${encodeURIComponent(tracking)}`, undefined, await this.authorize()));
    if (result.length > 1) throw new HttpError(409, 'Có nhiều chuyến Ahamove cùng mã. Cần nhân viên đối chiếu trên portal.');
    return result[0] ?? null;
  }
}
