export interface PendingSubscriptionInput {
  userId: string;
  providerOrderId: string;
  amountMinor: bigint;
  currency: string;
}

export interface UpgradeInput {
  userId: string;
  providerOrderId: string;
  providerPaymentId: string;
  amountMinor: bigint;
  currency: string;
  payload?: unknown;
}
