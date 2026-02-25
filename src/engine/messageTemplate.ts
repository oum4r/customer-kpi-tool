import type { ComputedKPIs, Settings, RAGStatus, MessageTone } from '../types';

// ============================================================
// Encouragement Messages
// ============================================================

const ENCOURAGING_GREEN = [
  'Smashed it! 💪',
  'Target hit — amazing work! 🎉',
  'Brilliant performance! ⭐',
];

const ENCOURAGING_AMBER_GENERIC = [
  'Almost there! Just {remaining} more to go! 💪',
  'So close to target — keep pushing! 🙌',
];

const ENCOURAGING_RED_GENERIC = "Let's rally together and push for it! 💪";

const ENCOURAGING_RED_BY_KPI: Record<string, string> = {
  cnl: "Let's focus on asking every customer about Club New Look! 💪",
  digitalReceipts: "Let's focus on asking every customer for their email at the till! 💪",
  ois: "Let's focus on offering to check online stock for customers! 💪",
};

const COACHING_RED_BY_KPI: Record<string, string> = {
  cnl: 'Ensure every team member is asking about Club New Look at the till.',
  digitalReceipts: 'Remember to ask every customer for their email at the till.',
  ois: 'Actively offer to check online stock for any unavailable items.',
};

// ============================================================
// calculateRemaining
// ============================================================

/**
 * Returns a human-readable remaining string.
 * - For counts: "7 more sign-ups"
 * - For percentages: "6% more"
 * - For currency: "£44 more"
 */
export function calculateRemaining(
  current: number,
  target: number,
  isPercentage: boolean,
): string {
  const diff = Math.max(0, target - current);

  if (isPercentage) {
    return `${diff}% more`;
  }

  return `${diff} more`;
}

// ============================================================
// getEncouragement
// ============================================================

/**
 * Returns a contextual encouragement message based on RAG status and tone.
 *
 * Uses a deterministic selection for "random" picks by keying off the
 * `kpiName` string length so that the same KPI always produces the same
 * message within a given set of options.
 */
export function getEncouragement(
  rag: RAGStatus,
  kpiName: string,
  tone: MessageTone,
  remaining?: number,
): string {
  // Deterministic index — derived from the kpiName length so each KPI
  // consistently picks the same option.
  const deterministicIndex = kpiName.length;

  if (tone === 'neutral') {
    if (rag === 'green') return 'Target achieved.';
    if (rag === 'amber') {
      return remaining !== undefined ? `${remaining} below target.` : 'Close to target.';
    }
    return 'Below target threshold.';
  }

  if (tone === 'coaching') {
    if (rag === 'green') {
      return "Well done — target met. Let's keep the momentum going.";
    }
    if (rag === 'amber') {
      return remaining !== undefined
        ? `Getting close. ${remaining} more to reach target — let's focus on this.`
        : "Getting close — let's focus on this.";
    }
    // Red — KPI-specific coaching tip
    const tip = COACHING_RED_BY_KPI[kpiName];
    return tip
      ? `Below target. Key focus area: ${tip}`
      : "Below target. Key focus area: let's regroup and push harder this week.";
  }

  // Encouraging tone (default)
  if (rag === 'green') {
    return ENCOURAGING_GREEN[deterministicIndex % ENCOURAGING_GREEN.length];
  }

  if (rag === 'amber') {
    const options = ENCOURAGING_AMBER_GENERIC;
    const selected = options[deterministicIndex % options.length];
    return remaining !== undefined
      ? selected.replace('{remaining}', String(remaining))
      : selected.replace(' Just {remaining} more to go!', '').replace('{remaining}', '');
  }

  // Red
  const kpiSpecific = ENCOURAGING_RED_BY_KPI[kpiName];
  return kpiSpecific ?? ENCOURAGING_RED_GENERIC;
}

// ============================================================
// generateWhatsAppMessage
// ============================================================

/**
 * Generate a WhatsApp-formatted plain-text message from computed KPI data.
 *
 * Uses WhatsApp markdown:
 * - *bold* for section headings and emphasis
 * - _italic_ for the period subtitle
 *
 * Trend arrows (↑ ↓ →) are only shown when `settings.showTrendIndicators`
 * is true **and** the trend value is not null (i.e. there is a previous week
 * to compare against).
 */
export function generateWhatsAppMessage(
  kpis: ComputedKPIs,
  settings: Settings,
): string {
  const { showTrendIndicators, messageTone } = settings;
  const lines: string[] = [];

  // ---- Header ----
  lines.push(`📊 *Customer KPI Update — Week ${kpis.weekNumber}*`);
  lines.push(`_${kpis.periodName}_`);
  lines.push('');

  // ---- Helper: trend string ----
  const trendStr = (trend: typeof kpis.cnl.trend): string => {
    if (!showTrendIndicators || trend === null) return '';
    return ` ${trend}`;
  };

  // ================================================================
  // Club New Look (CNL)
  // ================================================================
  const cnlRemaining = Math.max(0, kpis.cnl.target - kpis.cnl.signUps);
  const cnlEncouragement = getEncouragement(
    kpis.cnl.rag,
    'cnl',
    messageTone,
    cnlRemaining,
  );

  lines.push(
    `🆕 *Club New Look:* ${kpis.cnl.signUps}/${kpis.cnl.target} sign-ups${trendStr(kpis.cnl.trend)}`,
  );
  lines.push(cnlEncouragement);
  lines.push('');

  // ================================================================
  // Digital Receipts
  // ================================================================
  const drRemaining = Math.max(
    0,
    kpis.digitalReceipts.target - kpis.digitalReceipts.storePercentage,
  );
  const drEncouragement = getEncouragement(
    kpis.digitalReceipts.rag,
    'digitalReceipts',
    messageTone,
    drRemaining,
  );

  lines.push(
    `📧 *Digital Receipts:* ${kpis.digitalReceipts.storePercentage}% (target ${kpis.digitalReceipts.target}%)${trendStr(kpis.digitalReceipts.trend)}`,
  );
  lines.push(drEncouragement);

  // Top performer in Digital Receipts leaderboard
  if (kpis.digitalReceipts.leaderboard.length > 0) {
    const topDR = kpis.digitalReceipts.leaderboard[0];
    lines.push(`🏆 Top: ${topDR.name} — ${topDR.percentage}%`);
  }
  lines.push('');

  // ================================================================
  // Order in Store (OIS)
  // ================================================================
  const oisRemaining = Math.max(0, kpis.ois.target - kpis.ois.storeTotal);
  const oisEncouragement = getEncouragement(
    kpis.ois.rag,
    'ois',
    messageTone,
    oisRemaining,
  );

  lines.push(
    `🛒 *Order in Store:* £${kpis.ois.storeTotal}/£${kpis.ois.target}${trendStr(kpis.ois.trend)}`,
  );
  lines.push(oisEncouragement);

  // Top performer in OIS leaderboard
  if (kpis.ois.leaderboard.length > 0) {
    const topOIS = kpis.ois.leaderboard[0];
    lines.push(`🏆 Top: ${topOIS.name} — £${topOIS.revenue}`);
  }
  lines.push('');

  // ================================================================
  // Player of the Week
  // ================================================================
  if (kpis.topPerformers.length > 0) {
    const playerStr = kpis.topPerformers.join(' & ');
    lines.push(`⭐ *KPI Hero of the Week:* ${playerStr}`);
    lines.push('');
  }

  // ================================================================
  // Closing encouragement
  // ================================================================
  const closingMessages: Record<MessageTone, string> = {
    encouraging: "Keep up the great work, team! Let's make next week even better! 🔥",
    neutral: 'End of weekly update. 🔥',
    coaching: "Let's carry this momentum into next week — every interaction counts! 🔥",
  };

  lines.push(closingMessages[messageTone]);

  return lines.join('\n');
}
