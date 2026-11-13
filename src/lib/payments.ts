import crypto from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import type { AppDatabase } from '../db/index.ts';
import { financialLedger } from '../db/schema.ts';

export const PAYMENT_METHODS = [
  'orange_money',
  'mtn_momo',
  'moov_money',
  'wave',
  'card',
  'cash',
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface GatewayStatusInfo {
  provider: PaymentMethod;
  label: string;
  configured: boolean;
  mode: 'live' | 'sandbox' | 'cash_desk';
  envKeyHint: string;
}

export function getPaymentGatewayStatuses(): GatewayStatusInfo[] {
  return [
    {
      provider: 'orange_money',
      label: 'Orange Money Côte d’Ivoire',
      configured: Boolean(process.env.ORANGE_MONEY_MERCHANT_KEY),
      mode: process.env.ORANGE_MONEY_MERCHANT_KEY ? 'live' : 'sandbox',
      envKeyHint: 'ORANGE_MONEY_MERCHANT_KEY',
    },
    {
      provider: 'mtn_momo',
      label: 'MTN Mobile Money CI',
      configured: Boolean(process.env.MTN_MOMO_SUBSCRIPTION_KEY),
      mode: process.env.MTN_MOMO_SUBSCRIPTION_KEY ? 'live' : 'sandbox',
      envKeyHint: 'MTN_MOMO_SUBSCRIPTION_KEY',
    },
    {
      provider: 'moov_money',
      label: 'Moov Money CI',
      configured: Boolean(process.env.MOOV_MONEY_API_KEY),
      mode: process.env.MOOV_MONEY_API_KEY ? 'live' : 'sandbox',
      envKeyHint: 'MOOV_MONEY_API_KEY',
    },
    {
      provider: 'wave',
      label: 'Wave Côte d’Ivoire',
      configured: Boolean(process.env.WAVE_API_KEY),
      mode: process.env.WAVE_API_KEY ? 'live' : 'sandbox',
      envKeyHint: 'WAVE_API_KEY',
    },
    {
      provider: 'card',
      label: 'Carte Bancaire (Visa / Mastercard)',
      configured: Boolean(process.env.STRIPE_SECRET_KEY),
      mode: process.env.STRIPE_SECRET_KEY ? 'live' : 'sandbox',
      envKeyHint: 'STRIPE_SECRET_KEY',
    },
    {
      provider: 'cash',
      label: 'Espèces (Enregistrement Trésorerie)',
      configured: true,
      mode: 'cash_desk',
      envKeyHint: 'Permission donations.manage requise',
    },
  ];
}

export function getWebhookSecret(): string {
  const configured = process.env.PAYMENT_WEBHOOK_SECRET;
  if (configured && configured.length >= 16) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('PAYMENT_WEBHOOK_SECRET must be configured in production.');
  }
  return process.env.AUTH_TOKEN_SECRET || 'sanctuaire-sandbox-webhook-secret';
}

export function signWebhookPayload(payloadString: string, secret = getWebhookSecret()): string {
  return crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
}

export function verifyWebhookSignature(payloadString: string, signatureHeader: string): boolean {
  if (!signatureHeader) return false;
  try {
    const secret = getWebhookSecret();
    const expected = signWebhookPayload(payloadString, secret);
    const cleaned = signatureHeader.replace(/^sha256=/i, '').trim();
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(cleaned, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function appendFinancialLedgerEntry(
  tx: AppDatabase,
  params: {
    churchId: number;
    fundType: 'church' | 'humanitarian' | 'commercial';
    entryType: 'credit' | 'debit';
    amount: number;
    currency: string;
    category: string;
    description: string;
    campaignId?: number | null;
    donationId?: number | null;
    aidDistributionId?: number | null;
    justificationNote?: string | null;
    justificationUrl?: string | null;
    actorUserId?: number | null;
  }
) {
  const lastRows = await tx
    .select({ entryHash: financialLedger.entryHash })
    .from(financialLedger)
    .where(
      and(
        eq(financialLedger.churchId, params.churchId),
        eq(financialLedger.fundType, params.fundType)
      )
    )
    .orderBy(desc(financialLedger.id))
    .limit(1);

  const previousHash = lastRows[0]?.entryHash || 'GENESIS';
  const entryPayload = JSON.stringify({
    churchId: params.churchId,
    fundType: params.fundType,
    entryType: params.entryType,
    amount: params.amount,
    currency: params.currency,
    category: params.category,
    description: params.description,
    previousHash,
    ts: Date.now(),
  });
  const entryHash = crypto.createHash('sha256').update(entryPayload).digest('hex');

  const [entry] = await tx
    .insert(financialLedger)
    .values({
      churchId: params.churchId,
      fundType: params.fundType,
      entryType: params.entryType,
      amount: params.amount,
      currency: params.currency,
      category: params.category,
      description: params.description,
      campaignId: params.campaignId ?? null,
      donationId: params.donationId ?? null,
      aidDistributionId: params.aidDistributionId ?? null,
      justificationNote: params.justificationNote ?? null,
      justificationUrl: params.justificationUrl ?? null,
      actorUserId: params.actorUserId ?? null,
      previousHash,
      entryHash,
    })
    .returning();

  return entry;
}
