export const REFUND_POLICY_VERSION = 'normal-unit-v1';
export function calculateRefund({ paidAmount, totalCredits, usedCredits, unitKrw = 1000 }) {
  for (const value of [paidAmount, totalCredits, usedCredits, unitKrw]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid refund inputs');
  }
  if (!totalCredits || !unitKrw || usedCredits > totalCredits) throw new Error('Invalid refund usage');
  const usedAmount = usedCredits * unitKrw;
  if (!Number.isSafeInteger(usedAmount)) throw new Error('Invalid refund amount');
  return { paidAmount, totalCredits, usedCredits, remainingCredits: totalCredits - usedCredits,
    unitKrw, usedAmount, refundAmount: Math.max(0, paidAmount - usedAmount), policyVersion: REFUND_POLICY_VERSION };
}
