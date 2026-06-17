export const RISK_LABELS = { 0: "LOW", 1: "MEDIUM", 2: "HIGH" };

/**
 * Returns Tailwind border/text/bg classes for a risk badge.
 */
export function getRiskBadgeClass(riskLevel) {
  if (riskLevel === 'LOW') return 'border-[#C0FF00]/20 text-[#C0FF00] bg-[#C0FF00]/5';
  if (riskLevel === 'MEDIUM') return 'border-[#FFB300]/20 text-[#FFB300] bg-[#FFB300]/5';
  return 'border-[#FF2A5F]/20 text-[#FF2A5F] bg-[#FF2A5F]/5';
}

/**
 * Returns just the text color class for a risk level.
 */
export function getRiskColor(riskLevel) {
  if (riskLevel === 'LOW') return 'text-[#C0FF00]';
  if (riskLevel === 'MEDIUM') return 'text-[#FFB300]';
  return 'text-[#FF2A5F]';
}

/**
 * Returns full border+text+bg+shadow class for larger risk result panels.
 */
export function getRiskPanelClass(riskLevel) {
  if (riskLevel === 'LOW') return 'border-[#C0FF00] text-[#C0FF00] bg-[#C0FF00]/5 shadow-[0_0_20px_rgba(192,255,0,0.08)]';
  if (riskLevel === 'MEDIUM') return 'border-[#FF5A00] text-[#FF5A00] bg-[#FF5A00]/5 shadow-[0_0_20px_rgba(255,90,0,0.08)]';
  return 'border-[#FF2A5F] text-[#FF2A5F] bg-[#FF2A5F]/5 shadow-[0_0_25px_rgba(255,42,95,0.1)]';
}

/**
 * Bucket a dollar amount into an investment range string.
 */
export function getInvestmentRange(amount) {
  if (amount >= 200000) return "Over 200K";
  if (amount >= 50000) return "50K-200K";
  if (amount >= 10000) return "10K-50K";
  return "Under 10K";
}
