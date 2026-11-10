import { REFUND_POLICY_VERSION } from '../credits/refunds.js';
// Merchant contract review is separate from technical integration readiness.
// This module does not activate payment routes or change any prices.
const CATEGORIES = ['credit_topup', 'direct'];
const VARIANTS = ['legacy', 'rest-server'];
const error = message => { throw new Error(message); };
export function readNicepayPolicy(raw = '') {
  if (!raw) return Object.freeze({ enabled: false, apiConfirmed: false, variant: null, categories: Object.freeze({}) });
  const input = JSON.parse(raw);
  if (!input || Array.isArray(input) || typeof input !== 'object') error('Invalid NICEPAY policy');
  const categories = {};
  for (const [name, config] of Object.entries(input.categories ?? {})) {
    if (!CATEGORIES.includes(name) || !config || typeof config !== 'object' || Array.isArray(config)) error('Invalid NICEPAY category');
    if (!Array.isArray(config.methods) || config.methods.some(method => method !== 'card')) error('Only one-time card is implemented');
    if (config.recurring === true || config.overseas === true) error('Recurring and overseas NICEPAY are not implemented');
    if (!Number.isSafeInteger(config.maxAmountKrw) || config.maxAmountKrw < 1 || config.maxAmountKrw > 999999999999) error('Explicit category amount cap required');
    categories[name] = Object.freeze({ approved: config.approved === true, methods: Object.freeze([...new Set(config.methods)]),
      maxAmountKrw: config.maxAmountKrw, recurring: false, overseas: false });
  }
  if (input.variant != null && !VARIANTS.includes(input.variant)) error('Unsupported NICEPAY API variant');
  return Object.freeze({ enabled: input.enabled === true, apiConfirmed: input.apiConfirmed === true,
    variant: input.variant ?? null, categories: Object.freeze(categories) });
}

// catalog must come from trusted server configuration, never request JSON.
// Amounts and category are derived from catalog, not supplied by the customer.
export function prepareNicepayIntent({ productId, ownerId }, catalog, policy) {
  if (!policy.enabled || !policy.apiConfirmed || !VARIANTS.includes(policy.variant)) error('NICEPAY configuration pending');
  if (typeof productId !== 'string' || !Object.hasOwn(catalog, productId)) error('Unknown product');
  if (typeof ownerId !== 'string' || !ownerId.trim() || ownerId.length > 254) error('Verified account required');
  const product = catalog[productId];
  if (!CATEGORIES.includes(product.category)) error('Product category required');
  const rule = policy.categories[product.category];
  if (!rule?.approved || !rule.methods.includes('card')) error('NICEPAY category approval pending');
  if (product.currency !== 'KRW' || !Number.isSafeInteger(product.amount) || product.amount <= 0
      || product.amount > rule.maxAmountKrw || product.recurring !== false) error('Product outside approved payment scope');
  if (typeof product.goodsName !== 'string' || !/^[a-zA-Z0-9 _-]{1,40}$/.test(product.goodsName)) error('ASCII payment label required until encoding integration');
  if (product.category === 'credit_topup' && (!Number.isSafeInteger(product.credits) || product.credits < 1 || product.amount !== product.credits * 1000)) error('Credit quantity required');
  return Object.freeze({ productId, ownerId, category: product.category, amount: product.amount, currency: 'KRW',
    goodsName: product.goodsName, method: 'card', recurring: false,
    ...(product.category === 'credit_topup' ? { credits: product.credits, unitKrw: 1000, refundPolicyVersion: REFUND_POLICY_VERSION } : {}),
    provider: 'nicepay', variant: policy.variant, liveAvailable: false });
}
