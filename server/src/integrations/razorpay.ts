import Razorpay from 'razorpay';

import { env } from '@/config/env.js';
import { AppError } from '@/errors/AppError.js';

import { withTimeout } from './runtime.js';

const ORDER_TIMEOUT_MS = 15_000;

let cached: Razorpay | null = null;

export function getRazorpayClient(): Razorpay {
  if (cached) return cached;
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new AppError('INTERNAL_ERROR', 'Razorpay credentials are not configured.', {
      exposeDetails: false,
    });
  }
  cached = new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET,
  });
  return cached;
}

export interface CreateOrderInput {
  amountMinor: number;

  currency: string;

  receipt: string;

  notes?: Record<string, string>;
}

export interface CreatedOrder {
  orderId: string;
  amountMinor: number;
  currency: string;
  status: string;
  createdAt: number;
}

export async function createRazorpayOrder(input: CreateOrderInput): Promise<CreatedOrder> {
  const client = getRazorpayClient();
  try {
    const order = await withTimeout('razorpay.orders.create', ORDER_TIMEOUT_MS, () =>
      client.orders.create({
        amount: input.amountMinor,
        currency: input.currency,
        receipt: input.receipt,
        ...(input.notes ? { notes: input.notes } : {}),
      }),
    );
    return {
      orderId: order.id,

      amountMinor: typeof order.amount === 'number' ? order.amount : Number(order.amount),
      currency: order.currency,
      status: order.status,
      createdAt: order.created_at,
    };
  } catch (err) {
    throw new AppError('UPSTREAM_ERROR', 'Razorpay order creation failed.', {
      exposeDetails: false,
      cause: err,
    });
  }
}

export function verifyRazorpayWebhook(rawBody: string, signature: string): void {
  const secret = env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    throw new AppError('INTERNAL_ERROR', 'RAZORPAY_WEBHOOK_SECRET is not configured.', {
      exposeDetails: false,
    });
  }
  let ok: boolean;
  try {
    ok = Razorpay.validateWebhookSignature(rawBody, signature, secret);
  } catch (err) {
    throw new AppError('UNAUTHENTICATED', 'Razorpay webhook signature verification failed.', {
      exposeDetails: false,
      cause: err,
    });
  }
  if (!ok) {
    throw new AppError('UNAUTHENTICATED', 'Razorpay webhook signature verification failed.', {
      exposeDetails: false,
    });
  }
}
