import { AppError } from '@/errors/AppError.js';
import { type DefinedRoute, defineRoute } from '@/http/defineRoute.js';
import {
  createCheckout,
  handleRazorpayWebhook,
  listPlans,
  redeemCouponForCurrentUser,
} from '@/services/billing.service.js';

const plans: DefinedRoute = defineRoute('billing.plans', () => {
  return [...listPlans()];
});

const checkout: DefinedRoute = defineRoute('billing.checkout', async (ctx) => {
  return createCheckout({
    userId: ctx.auth.userId,
    planTier: ctx.body.planTier,
    ...(ctx.body.couponCode !== undefined ? { couponCode: ctx.body.couponCode } : {}),
  });
});

const redeemCoupon: DefinedRoute = defineRoute('billing.redeemCoupon', async (ctx) => {
  const result = await redeemCouponForCurrentUser(ctx.auth.userId, ctx.body.code);
  return result;
});

const razorpayWebhook: DefinedRoute = defineRoute('billing.razorpayWebhook', async (ctx) => {
  const raw = (ctx.req as unknown as { rawBody?: Buffer }).rawBody;
  if (!raw || !Buffer.isBuffer(raw)) {
    ctx.log.error(
      { requestId: ctx.requestId },
      'razorpay webhook: req.rawBody missing — express.json verify callback not mounted',
    );
    throw new AppError('INTERNAL_ERROR', 'Webhook raw body missing.', {
      exposeDetails: false,
    });
  }
  const signature = String(ctx.req.header('x-razorpay-signature') ?? '');
  const eventId = String(ctx.req.header('x-razorpay-event-id') ?? '');
  await handleRazorpayWebhook({
    rawBody: raw.toString('utf8'),
    signature,
    eventId,
    parsed: ctx.body,
  });
  return { received: true as const };
});

export const billingRealRoutes: readonly DefinedRoute[] = [
  plans,
  checkout,
  redeemCoupon,
  razorpayWebhook,
];
