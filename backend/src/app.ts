import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { z } from 'zod';
import { APIError, type PayOS } from '@payos/node';
import { checkoutSchema, HttpError, publicOrder } from './domain';
import type { PaymentOrder } from './domain';
import type { OrderStore } from './store';
import type { RewardStore } from './rewards';
import { googleBridgeRouter, type GoogleBridgeOptions } from './googleBridge';
import { deliveryQuoteInput, verifyAhaWebhook, type DeliveryStore } from './delivery';
import { cashOrderInput, type OrderOpsStore } from './orders';
import { phoneLoginInput } from './phoneLogin';
import { pushTokenInput, type PushStore } from './push';
import { reviewInput, type ReviewStore } from './reviews';
import { otpSendInput, otpVerifyInput, type OtpStore } from './otp';

type Options = {
  delivery?: Pick<DeliveryStore, 'quote' | 'createCod' | 'dispatch' | 'refresh' | 'webhook' | 'assertStaff' | 'config'>;
  otp?: Pick<OtpStore, 'start' | 'verify'>;
  phoneLogin?: (phone: string, password: string) => Promise<{ token: string }>;
  orders?: Pick<OrderOpsStore, 'list' | 'advance' | 'reject' | 'markRefunded' | 'cancel' | 'createCash' | 'lookup'>;
  googleBridge?: GoogleBridgeOptions;
  rewards?: Pick<RewardStore, 'wallet' | 'redeem'>;
  push?: Pick<PushStore, 'save'>;
  reviews?: Pick<ReviewStore, 'submit'>;
  store: Pick<OrderStore, 'get' | 'reserve' | 'attach' | 'pay'>;
  payos: Pick<PayOS, 'paymentRequests' | 'webhooks'>;
  verifyToken: (token: string) => Promise<{ uid: string; exp: number }>;
  isBlocked?: (uid: string) => Promise<boolean>;
  isStaff?: (uid: string) => Promise<boolean>;
  origins: string[]; returnUrl: string; cancelUrl: string;
};
const orderIdSchema = z.string().regex(/^[a-f0-9]{64}$/);
const webhookSchema = z.object({
  code: z.string(), desc: z.string(), success: z.boolean(), signature: z.string().min(1),
  data: z.object({ orderCode: z.number().int().positive(), amount: z.number().int().nonnegative(),
    paymentLinkId: z.string().min(1), reference: z.string().min(1), code: z.string(), currency: z.literal('VND'),
  }).passthrough(),
});
export function createPaymentServer(options: Options) {
  const { store, payos, verifyToken, origins, returnUrl, cancelUrl } = options;
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: origins }));
  app.use(express.json({ limit: '64kb' }));
  const server = createServer(app);
  const io = new Server(server, { cors: { origin: origins }, maxHttpBufferSize: 8192 });
  const emit = (order: PaymentOrder) => io.to(`user:${order.userId}`).emit('payment:updated', publicOrder(order));
  io.use(async (socket, next) => {
    try {
      const token = z.string().min(1).parse(socket.handshake.auth.token);
      const identity = await verifyToken(token);
      if (identity.exp * 1000 <= Date.now()) throw new Error('Expired');
      socket.data.identity = identity;
      next();
    } catch { next(new Error('UNAUTHORIZED')); }
  });
  io.on('connection', socket => {
    const { uid, exp } = socket.data.identity;
    void socket.join(`user:${uid}`);
    // Staff also hear about every order change (the server decides; clients never pick rooms).
    void options.isStaff?.(uid).then(staff => { if (staff) void socket.join('staff'); }).catch(() => {});
    const expiry = setTimeout(() => socket.disconnect(true), Math.min(exp * 1000 - Date.now(), 2147483647));
    socket.on('disconnect', () => clearTimeout(expiry));
    // No client-selected rooms and no client event that can mark an order paid.
  });
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/auth', googleBridgeRouter(options.googleBridge));
  for (const path of ['/payment/return', '/payment/cancel']) {
    app.get(path, (_req, res) => {
      res.type('html').send('<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Thanh toán Pizza FPT</title><body style="font-family:system-ui;padding:32px;max-width:480px;margin:auto"><h1>Quay lại ứng dụng</h1><p>Vui lòng quay lại Pizza FPT và nhấn “Kiểm tra thanh toán” để xác nhận trạng thái đơn hàng.</p></body></html>');
    });
  }
  app.post('/api/webhooks/payos', async (req, res) => {
    const parsed = webhookSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Invalid webhook payload');
    let data;
    try { data = await payos.webhooks.verify(parsed.data as Parameters<PayOS['webhooks']['verify']>[0]); }
    catch { throw new HttpError(401, 'Invalid webhook signature'); }
    if (data.code === '00') {
      const order = await store.pay(data);
      if (order) emit(order);
    }
    res.json({ success: true });
  });
  app.post('/api/webhooks/ahamove', async (req, res) => {
    if (!options.delivery) throw new HttpError(503, 'Ahamove chưa được cấu hình.');
    if (!verifyAhaWebhook(req.headers.authorization, options.delivery.config.webhookSecret)) throw new HttpError(401, 'Invalid webhook authorization');
    await options.delivery.webhook(req.body);
    res.json({ success: true });
  });
  const orders = () => {
    if (!options.orders) throw new HttpError(503, 'Quản lý đơn chưa được cấu hình.');
    return options.orders;
  };
  // Public guest lookup (phone + order code); its own per-IP limit since it runs before auth.
  app.get('/api/orders/lookup', rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false }), async (req, res) => {
    const { phone, code } = z.object({ phone: z.string().regex(/^\+?[0-9 .-]{9,20}$/), code: z.string().trim().min(4).max(40) }).parse(req.query);
    res.json(await orders().lookup(phone, code.replace(/^#/, '').toUpperCase()));
  });
  // Public: phone + password → Firebase custom token. Strict per-IP limit against password guessing.
  app.post('/api/auth/phone-login', rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false }), async (req, res) => {
    if (!options.phoneLogin) throw new HttpError(503, 'Đăng nhập bằng số điện thoại chưa được cấu hình.');
    const { phone, password } = phoneLoginInput.parse(req.body);
    res.json(await options.phoneLogin(phone, password));
  });
  const otp = () => {
    if (!options.otp) throw new HttpError(503, 'Dịch vụ gửi mã OTP chưa được cấu hình.');
    return options.otp;
  };
  app.post('/api/otp/send', rateLimit({ windowMs: 10 * 60_000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false }), async (req, res) => {
    await otp().start(otpSendInput.parse(req.body).email);
    res.json({ success: true });
  });
  app.post('/api/otp/verify', rateLimit({ windowMs: 10 * 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false }), async (req, res) => {
    const { email, code } = otpVerifyInput.parse(req.body);
    otp().verify(email, code);
    res.json({ success: true });
  });
  app.use('/api', async (req, res, next) => {
    try {
      const match = /^Bearer (\S+)$/.exec(req.headers.authorization ?? '');
      if (!match) throw new Error('Missing token');
      const identity = await verifyToken(match[1]);
      if (identity.exp * 1000 <= Date.now()) throw new Error('Expired');
      res.locals.uid = identity.uid;
      next();
    } catch { next(new HttpError(401, 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')); }
  });
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 60, keyGenerator: (_req, res) => res.locals.uid,
    standardHeaders: 'draft-8', legacyHeaders: false }));
  // Locked accounts may still sign in and see their orders, but not create new ones.
  const canOrder: express.RequestHandler = async (_req, res, next) => {
    try {
      if (await options.isBlocked?.(res.locals.uid)) throw new HttpError(403, 'Tài khoản đã bị khóa đặt hàng. Vui lòng liên hệ cửa hàng.');
      next();
    } catch (error) { next(error); }
  };
  for (const path of ['/api/delivery/quotes', '/api/delivery/orders', '/api/orders/cash', '/api/payments/payos', '/api/rewards/redeem']) {
    app.post(path, canOrder);
  }
  const delivery = () => {
    if (!options.delivery) throw new HttpError(503, 'Ahamove staging chưa được cấu hình.');
    return options.delivery;
  };
  const deliveryId = z.string().regex(/^[a-f0-9]{64}$/);
  app.post('/api/delivery/quotes', async (req, res) => {
    res.json(await delivery().quote(res.locals.uid, deliveryQuoteInput.parse(req.body)));
  });
  app.post('/api/delivery/orders', async (req, res) => {
    const key = z.string().min(16).max(128).regex(/^[\w-]+$/).parse(req.headers['idempotency-key']);
    const { quoteId } = z.object({ quoteId: z.string().uuid() }).strict().parse(req.body);
    res.json(await delivery().createCod(res.locals.uid, key, quoteId));
  });
  app.post('/api/delivery/orders/:id/dispatch', async (req, res) => {
    res.json(await delivery().dispatch(res.locals.uid, deliveryId.parse(req.params.id)));
  });
  app.post('/api/delivery/orders/:id/refresh', async (req, res) => {
    res.json(await delivery().refresh(res.locals.uid, deliveryId.parse(req.params.id)));
  });
  const orderId = z.string().min(1).max(128).regex(/^[\w-]+$/);
  const idempotencyKey = (req: express.Request) => z.string().min(16).max(128).regex(/^[\w-]+$/).parse(req.headers['idempotency-key']);
  app.post('/api/orders/cash', async (req, res) => {
    res.json(await orders().createCash(res.locals.uid, idempotencyKey(req), cashOrderInput.parse(req.body)));
  });
  app.post('/api/orders/:id/cancel', async (req, res) => {
    res.json(await orders().cancel(res.locals.uid, orderId.parse(req.params.id)));
  });
  app.get('/api/staff/orders', async (req, res) => {
    const { status } = z.object({ status: z.string().regex(/^[A-Z_]{4,30}$/).optional() }).parse(req.query);
    res.json(await orders().list(res.locals.uid, status));
  });
  app.post('/api/staff/orders/:id/advance', async (req, res) => {
    res.json(await orders().advance(res.locals.uid, orderId.parse(req.params.id)));
  });
  app.post('/api/staff/orders/:id/reject', async (req, res) => {
    const { reason } = z.object({ reason: z.string().trim().min(3).max(200) }).strict().parse(req.body);
    res.json(await orders().reject(res.locals.uid, orderId.parse(req.params.id), reason));
  });
  app.post('/api/admin/orders/:id/refunded', async (req, res) => {
    res.json(await orders().markRefunded(res.locals.uid, orderId.parse(req.params.id)));
  });
  app.post('/api/payments/payos', async (req, res) => {
    const key = z.string().min(16).max(128).regex(/^[\w-]+$/).parse(req.headers['idempotency-key']);
    const checkout = checkoutSchema.parse(req.body);
    let order = await store.reserve(res.locals.uid, key, checkout);
    if (!order.payment && order.paymentStatus !== 'PAID') {
      try {
        const link = await payos.paymentRequests.create({ orderCode: order.orderCode, amount: order.total,
          description: `P${String(order.orderCode).slice(-8)}`, returnUrl, cancelUrl });
        if (link.orderCode !== order.orderCode || link.amount !== order.total) throw new Error('Payment mismatch');
        order = await store.attach(order.id, { paymentLinkId: link.paymentLinkId, checkoutUrl: link.checkoutUrl, qrCode: link.qrCode });
      } catch (error) {
        if (error instanceof APIError && error.code === '201') {
          throw new HttpError(502, 'Invalid payOS signature; check the payment channel checksum key', 'PAYOS_SIGNATURE_INVALID');
        }
        // Recover a timeout, concurrent create, or crash after payOS created the link.
        try {
          const link = await payos.paymentRequests.get(order.orderCode);
          if (link.orderCode !== order.orderCode || link.amount !== order.total) throw new Error('Mismatch');
          order = await store.attach(order.id, { paymentLinkId: link.id,
            checkoutUrl: `https://pay.payos.vn/web/${encodeURIComponent(link.id)}`, qrCode: null });
        } catch { throw new HttpError(502, 'Payment provider unavailable; retry with the same Idempotency-Key'); }
      }
    }
    res.json(publicOrder(order));
  });
  app.post('/api/orders/:id/review', async (req, res) => {
    if (!options.reviews) throw new HttpError(503, 'Đánh giá chưa được cấu hình.');
    res.json(await options.reviews.submit(res.locals.uid, orderId.parse(req.params.id), reviewInput.parse(req.body)));
  });
  app.post('/api/push/token', async (req, res) => {
    await options.push?.save(res.locals.uid, pushTokenInput.parse(req.body).token);
    res.json({ success: true });
  });
  app.get('/api/rewards', async (_req, res) => {
    if (!options.rewards) throw new HttpError(503, 'Đổi quà chưa được cấu hình.');
    res.json(await options.rewards.wallet(res.locals.uid));
  });
  app.post('/api/rewards/redeem', async (req, res) => {
    if (!options.rewards) throw new HttpError(503, 'Đổi quà chưa được cấu hình.');
    const key = z.string().min(16).max(128).regex(/^[\w-]+$/).parse(req.headers['idempotency-key']);
    const { rewardId } = z.object({ rewardId: z.string().regex(/^R0[1-7]$/) }).strict().parse(req.body);
    res.json(await options.rewards.redeem(res.locals.uid, rewardId, key));
  });
  app.get('/api/orders/:id', async (req, res) => {
    const id = orderIdSchema.parse(req.params.id);
    const order = await store.get(id);
    if (!order || order.userId !== res.locals.uid) throw new HttpError(404, 'Order not found');
    res.json(publicOrder(order));
  });
  app.post('/api/orders/:id/reconcile', async (req, res) => {
    const id = orderIdSchema.parse(req.params.id);
    let order = await store.get(id);
    if (!order || order.userId !== res.locals.uid) throw new HttpError(404, 'Order not found');
    let link;
    try { link = await payos.paymentRequests.get(order.orderCode); }
    catch { throw new HttpError(502, 'Payment provider unavailable'); }
    if (link.status === 'PAID' && link.amountPaid === order.total && link.amountRemaining === 0) {
      if (link.amount !== order.total || link.orderCode !== order.orderCode) throw new HttpError(409, 'Payment mismatch');
      const paid = await store.pay({ orderCode: order.orderCode, paymentLinkId: link.id, amount: link.amount,
        reference: `reconcile:${link.id}` });
      if (paid) { order = paid; emit(order); }
    }
    res.json({ ...publicOrder(order), providerStatus: link.status });
  });
  app.use((_req, res) => { res.status(404).json({ error: 'Không tìm thấy.' }); });
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Dữ liệu gửi lên chưa hợp lệ.', details: error.issues }); return; }
    const status = error instanceof HttpError ? error.status :
      error instanceof SyntaxError ? 400 : 500;
    if (status === 500) console.error('Request failed', error instanceof Error ? error.name : 'UnknownError');
    res.status(status).json({ error: error instanceof HttpError ? error.message : status === 400 ? 'Dữ liệu gửi lên chưa hợp lệ.' : 'Máy chủ đang gặp sự cố. Vui lòng thử lại.',
      ...(error instanceof HttpError && error.code ? { code: error.code } : {}) });
  });
  return { app, server, io };
}
