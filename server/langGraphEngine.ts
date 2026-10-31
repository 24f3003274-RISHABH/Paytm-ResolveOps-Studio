import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  db,
  TransactionRow,
  SwitchLogRow,
  RiskEventRow,
  LedgerRow,
  TicketRow,
  appendAuditLog,
} from './db.ts';
import {
  maskPIIAndDetectInjection,
  decidePolicy,
  PolicyDecisionOutput,
} from './policyEngine.ts';

interface LiveGenAIWorkflowEnrichment {
  intent_category: string;
  user_problem_summary: string;
  ai_root_cause_diagnosis: string;
  timely_handoff_or_action_brief: string;
  voice_script_indic: string;
  voice_script_english: string;
  genai_model: string;
  ai_latency_ms: number;
}

let geminiFlashQuotaExhausted = false;
let geminiLiteQuotaExhausted = false;

export type UserQueryFocus =
  | 'WHY_ROOT_CAUSE'
  | 'MERCHANT_SOUNDBOX_STATUS'
  | 'UTR_BANK_TIMELINE_PROOF'
  | 'DOUBLE_DEBIT_DUPLICATE'
  | 'RBI_COMPENSATION_SLA'
  | 'SECURITY_RISK_FREEZE'
  | 'GENERAL_DISPUTE_RESOLUTION';

export function detectUserQueryFocus(rawQuery: string): UserQueryFocus {
  const q = rawQuery.toLowerCase();
  if (
    /\b(rbi|compensation|penalty|suo.?motu|100\/day|₹200|₹100|t\+5|5 days|delay compensation)\b/i.test(q) ||
    /(मुआवजा|पेनल्टी|देरी का|5 दिन|आरबीआई)/i.test(q)
  ) {
    return 'RBI_COMPENSATION_SLA';
  }
  if (
    /\b(twice|double|two times|2 times|duplicate|charged again|paid again)\b/i.test(q) ||
    /(दो बार|डबल|दोबारा|दुबारा)/i.test(q)
  ) {
    return 'DOUBLE_DEBIT_DUPLICATE';
  }
  if (
    /\b(utr|rrn|reference number|proof|receipt|bank statement|when will|how long|how much time|credited to bank|check balance)\b/i.test(q) ||
    /(कब मिलेगा|कितना समय|कब तक|रसीद|प्रूफ|यूटीआर|खाते में आया)/i.test(q)
  ) {
    return 'UTR_BANK_TIMELINE_PROOF';
  }
  if (
    /\b(shopkeeper|merchant|dukaan|soundbox|speaker|did they get|did merchant|receiver|reached)\b/i.test(q) ||
    /(दुकानदार|साउंडबॉक्स|मर्चेंट|दुकान वाले|मिला क्या|पहुंचा)/i.test(q)
  ) {
    return 'MERCHANT_SOUNDBOX_STATUS';
  }
  if (
    /\b(fraud|scam|suspicious|hack|block|freeze|cancel|safe|security|unauthorized)\b/i.test(q) ||
    /(धोखाधड़ी|फ्रॉड|रोकें|ब्लॉक|सुरक्षित|कैंसिल)/i.test(q)
  ) {
    return 'SECURITY_RISK_FREEZE';
  }
  if (
    /\b(why|reason|how did|what happened|cause|explain|kya hua|kyu|kyon)\b/i.test(q) ||
    /(क्यों|कारण|रीजन|कैसे हुआ|क्या हुआ|ஏன்|காரணம்)/i.test(q)
  ) {
    return 'WHY_ROOT_CAUSE';
  }
  return 'GENERAL_DISPUTE_RESOLUTION';
}

async function runLiveGenAIWorkflowReasoning(params: {
  masked_user_query: string;
  txn: TransactionRow;
  switch_code: string;
  switch_status: string;
  gateway_hop_trace: string;
  three_way_match_status: string;
  risk_score: number;
  policy_decision: PolicyDecisionOutput['decision'];
  rule_triggered: string;
  settlement_utr: string | null;
  rbi_compensation_inr: number;
  lang: 'hi-IN' | 'en-IN' | 'ta-IN';
  fallback_intent: string;
  fallback_voice: { indic: string; english: string; sarvam_model: string };
}): Promise<LiveGenAIWorkflowEnrichment> {
  const aiStart = Date.now();
  const queryFocus = detectUserQueryFocus(params.masked_user_query);
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey !== 'MY_GEMINI_API_KEY' && (!geminiFlashQuotaExhausted || !geminiLiteQuotaExhausted)) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const langInstruction =
        params.lang === 'ta-IN'
          ? 'Tamil (written in Tamil script, warm and polite customer care tone)'
          : params.lang === 'en-IN'
          ? 'Indian English (warm, natural Paytm Soundbox / merchant support voice)'
          : 'Natural conversational Hindi / Hinglish (written in Devanagari script with clear UTR & amount, warm polite merchant support tone)';

      const prompt = `You are the GenAI reasoning engine inside Paytm ResolveOps (Track 3 Autonomous AI Teammate).
A Paytm merchant or customer submitted this specific live query:
"${params.masked_user_query}"
Detected User Query Focus: ${queryFocus}

Attached Transaction & SQLite Switch Telemetry:
- Transaction ID: ${params.txn.txn_id}
- RRN / UTR: ${params.txn.utr}
- Merchant: ${params.txn.merchant_name}
- Customer: ${params.txn.customer_name}
- Bank: ${params.txn.bank_name}
- Amount: ₹${params.txn.amount}
- NPCI Switch Code: ${params.switch_code} (${params.switch_status})
- Gateway Hop Trace: ${params.gateway_hop_trace}
- 3-Way Recon Status: ${params.three_way_match_status}
- Account Risk Score: ${params.risk_score}
- Deterministic Policy Engine Decision (Node 3): ${params.policy_decision} (Rule: ${params.rule_triggered})
- New Settlement / Reversal UTR: ${params.settlement_utr || 'Paused for Human L2 Operator Handoff'}
- RBI T+5 Penalty Compensation: ₹${params.rbi_compensation_inr}

IMPORTANT: Tailor your entire response directly to the user's exact question ("${params.masked_user_query}") so different questions produce distinct, specific answers!
Generate a JSON object with:
1. intent_category: Short uppercase classification combining the user's question focus and scenario (e.g., ${queryFocus}_${params.switch_code}).
2. user_problem_summary: 1-2 sentences directly addressing what the user asked ("${params.masked_user_query}") for ${params.txn.txn_id} (₹${params.txn.amount} at ${params.txn.merchant_name}).
3. ai_root_cause_diagnosis: 1-2 sentences explaining the technical root cause from 3-way reconciliation (${params.three_way_match_status}, Hop: ${params.gateway_hop_trace}) that answers the user's question.
4. timely_handoff_or_action_brief: Exact settlement action or L2 handoff taken (${params.policy_decision}, UTR: ${params.settlement_utr || params.txn.utr}).
5. voice_script_indic: A natural, empathetic 2-3 sentence spoken response in ${langInstruction} that directly answers "${params.masked_user_query}", mentions ₹${params.txn.amount} and ${params.txn.merchant_name.split(',')[0]}, and gives the exact UTR (${params.settlement_utr || params.txn.utr}).
6. voice_script_english: Clean English version directly answering "${params.masked_user_query}" with the exact telemetry and UTR.`;

      const modelsToTry = [
        !geminiFlashQuotaExhausted ? 'gemini-3.8-flash' : null,
        !geminiLiteQuotaExhausted ? 'gemini-3.1-flash-lite' : null,
      ].filter(Boolean) as string[];

      for (const modelName of modelsToTry) {
        const genPromise = ai.models
          .generateContent({
            model: modelName,
            contents: prompt,
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  intent_category: { type: Type.STRING },
                  user_problem_summary: { type: Type.STRING },
                  ai_root_cause_diagnosis: { type: Type.STRING },
                  timely_handoff_or_action_brief: { type: Type.STRING },
                  voice_script_indic: { type: Type.STRING },
                  voice_script_english: { type: Type.STRING },
                },
                required: [
                  'intent_category',
                  'user_problem_summary',
                  'ai_root_cause_diagnosis',
                  'timely_handoff_or_action_brief',
                  'voice_script_indic',
                  'voice_script_english',
                ],
              },
            },
          })
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
              if (modelName === 'gemini-3.8-flash') geminiFlashQuotaExhausted = true;
              if (modelName === 'gemini-3.1-flash-lite') geminiLiteQuotaExhausted = true;
            }
            return null;
          });

        const timeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 3500)
        );

        const response = await Promise.race([genPromise, timeoutPromise]);
        if (response && response.text) {
          const parsed = JSON.parse(response.text);
          return {
            intent_category: parsed.intent_category || `${queryFocus}_${params.switch_code}`,
            user_problem_summary:
              parsed.user_problem_summary ||
              `Analyzed query "${params.masked_user_query}" for ${params.txn.txn_id} (₹${params.txn.amount.toLocaleString('en-IN')} at ${params.txn.merchant_name}).`,
            ai_root_cause_diagnosis:
              parsed.ai_root_cause_diagnosis ||
              `Cross-checked ${params.txn.bank_name} CBS, NPCI Switch (${params.switch_code}), and Paytm Acquirer Ledger (${params.three_way_match_status}).`,
            timely_handoff_or_action_brief:
              parsed.timely_handoff_or_action_brief ||
              `Completed ${params.policy_decision} resolution for ${params.txn.txn_id}.`,
            voice_script_indic: parsed.voice_script_indic || params.fallback_voice.indic,
            voice_script_english: parsed.voice_script_english || params.fallback_voice.english,
            genai_model: `Sarvam AI + ${modelName} (Live NLU)`,
            ai_latency_ms: Date.now() - aiStart,
          };
        }
      }
    } catch {
      // Fallback to deterministic query-aware NLU synthesis below
    }
  }

  // Query-specific, scenario-specific human-readable investigation narratives
  const merchantShort = params.txn.merchant_name.split(',')[0];
  const amtFmt = `₹${params.txn.amount.toLocaleString('en-IN')}`;
  const queryExcerpt = params.masked_user_query.slice(0, 90);

  const detailedProblemSummary =
    params.policy_decision === 'SECURITY_BLOCK'
      ? `Intercepted adversarial instruction in query ("${queryExcerpt}") attempting to bypass settlement rules on ${params.txn.txn_id} (${amtFmt} at ${merchantShort}).`
      : queryFocus === 'WHY_ROOT_CAUSE'
      ? `User asked for the exact technical reason why ${amtFmt} at ${merchantShort} (UTR: ${params.txn.utr}) encountered status ${params.switch_code}.`
      : queryFocus === 'MERCHANT_SOUNDBOX_STATUS'
      ? `User asked whether merchant ${merchantShort} received the ${amtFmt} payment or why the Paytm Soundbox did not confirm settlement.`
      : queryFocus === 'UTR_BANK_TIMELINE_PROOF'
      ? `User requested official banking UTR proof and credit timeline for ${amtFmt} debited from ${params.txn.bank_name} (RRN: ${params.txn.utr}).`
      : queryFocus === 'DOUBLE_DEBIT_DUPLICATE'
      ? `User reported a double-debit / duplicate deduction concern of ${amtFmt} at ${merchantShort} (${params.txn.txn_id}) and requested immediate reversal.`
      : queryFocus === 'RBI_COMPENSATION_SLA'
      ? `User inquired about RBI T+5 Turnaround Time (TAT) delay SLA and ₹100/day suo-motu compensation for ${params.txn.txn_id} (${amtFmt}).`
      : queryFocus === 'SECURITY_RISK_FREEZE'
      ? `User raised a security / account safety query on ${params.txn.txn_id} (${amtFmt} at ${merchantShort}, Risk Score: ${params.risk_score.toFixed(2)}).`
      : `Customer ${params.txn.customer_name} queried "${queryExcerpt}" regarding ${amtFmt} from ${params.txn.bank_name} to ${merchantShort} (UTR: ${params.txn.utr}).`;

  const detailedRootCause =
    params.policy_decision === 'SECURITY_BLOCK'
      ? `Security Gateway detected prompt-injection directives in input payload. Ledger mutation was blocked prior to switch execution.`
      : queryFocus === 'WHY_ROOT_CAUSE'
      ? `Gateway Hop Trace [${params.gateway_hop_trace}] shows ${params.txn.bank_name} CBS processed the leg, while NPCI UDIR returned code ${params.switch_code} (${params.switch_status}). 3-Way Recon: ${params.three_way_match_status}.`
      : queryFocus === 'MERCHANT_SOUNDBOX_STATUS'
      ? params.switch_code === 'SUCCESS' || params.switch_code === 'DEEMED_UP'
        ? `NPCI Switch cleared ${amtFmt} (${params.switch_code}), but the acquirer sub-ledger webhook to ${merchantShort}'s Soundbox timed out. MCP-C triggered an instant URCS Credit Adjustment.`
        : `3-Way Recon confirmed ${merchantShort} did NOT receive ${amtFmt} (Merchant Credited = FALSE due to NPCI ${params.switch_code}). Money was trapped in clearing and reversed to ${params.txn.bank_name}.`
      : queryFocus === 'UTR_BANK_TIMELINE_PROOF'
      ? `Original NPCI RRN ${params.txn.utr} was cross-matched with ${params.txn.bank_name} CBS. New Settlement Reference ${params.settlement_utr || 'L2-ESCROW-REVIEW'} is locked with idempotency key IDEMP-${params.txn.txn_id}.`
      : params.switch_code === 'U69' && params.rbi_compensation_inr > 0
      ? `${params.txn.bank_name} CBS confirmed debit while NPCI Switch logged Code U69 (Beneficiary Timeout). Because T+5 SLA was breached, RBI mandate triggers principal refund plus ₹${params.rbi_compensation_inr} compensation.`
      : params.switch_code === 'U69' && params.policy_decision === 'AUTO_REVERSE'
      ? `MCP-A confirmed NPCI Switch Code U69 (Response Timeout on hop ${params.gateway_hop_trace}), MCP-B verified low risk (${params.risk_score.toFixed(2)}), and MCP-C confirmed ${params.txn.bank_name} debited ${amtFmt} while ${merchantShort} remained uncredited.`
      : params.switch_code === 'SUCCESS' || params.switch_code === 'DEEMED_UP'
      ? `MCP-A verified NPCI Switch cleared the transaction (${params.switch_code}), and MCP-C identified a missing acquirer webhook to ${merchantShort}'s sub-ledger.`
      : params.switch_code === 'PENDING'
      ? `MCP-A and MCP-C confirmed the transaction is currently inside NPCI's active T+0 clearing window (${params.gateway_hop_trace}). Duplicate reversal is prevented to avoid double-credit.`
      : `MCP-B & Policy Router flagged this ${amtFmt} transaction (Switch: ${params.switch_code}, Risk Score: ${params.risk_score.toFixed(2)}) under high-value / velocity controls requiring L2 specialist authorization.`;

  const detailedClosureBrief =
    params.policy_decision === 'HITL'
      ? `Paused autonomous ledger execution at Node 4C and routed pre-audited 3-way reconciliation dossier to L2 Settlement Officer for 1-click review.`
      : params.policy_decision === 'SECURITY_BLOCK'
      ? `Quarantined adversarial request at Node 4C with zero ledger mutations and logged security alert to immutable audit chain.`
      : params.policy_decision === 'AUTO_REVERSE_RBI_COMP'
      ? `Credited ${amtFmt} principal refund plus ₹${params.rbi_compensation_inr} RBI TAT compensation to ${params.txn.bank_name} under Ref UTR ${params.settlement_utr}.`
      : params.policy_decision === 'CREDIT_RETRY'
      ? `Triggered instant URCS merchant settlement credit of ${amtFmt} to ${merchantShort} under Ref UTR ${params.settlement_utr} and notified Soundbox.`
      : params.policy_decision === 'INFO_ONLY'
      ? `Verified existing settlement state (${params.settlement_utr || params.txn.utr}) with idempotency lock and updated customer with live status.`
      : `Issued instant NPCI UDIR reversal of ${amtFmt} back to ${params.txn.bank_name} under Settlement UTR ${params.settlement_utr}.`;

  return {
    intent_category: `${queryFocus}_${params.switch_code}`,
    user_problem_summary: detailedProblemSummary,
    ai_root_cause_diagnosis: detailedRootCause,
    timely_handoff_or_action_brief: detailedClosureBrief,
    voice_script_indic: params.fallback_voice.indic,
    voice_script_english: params.fallback_voice.english,
    genai_model: 'Sarvam AI + ResolveOps Query-Aware NLU Engine',
    ai_latency_ms: Date.now() - aiStart,
  };
}


export interface GraphNodeTrace {
  node_id: string;
  node_name: string;
  execution_mode:
    | 'SEQUENTIAL'
    | 'PARALLEL_BRANCH_A'
    | 'PARALLEL_BRANCH_B'
    | 'PARALLEL_BRANCH_C'
    | 'CONDITIONAL_BRANCH';
  mcp_server?: string;
  tool_called?: string;
  status: 'COMPLETED' | 'PAUSED_INTERRUPT' | 'BLOCKED' | 'SKIPPED';
  latency_ms: number;
  summary: string;
  output_data: Record<string, unknown>;
}

export interface HITLDossier {
  ticket_id: string;
  txn_id: string;
  utr: string;
  merchant_name: string;
  customer_name: string;
  bank_name: string;
  amount: number;
  switch_code: string;
  switch_hop_trace: string;
  risk_score: number;
  risk_factors: string[];
  escalation_reason: string;
  recommended_operator_action: string;
  idempotency_key: string;
}

/**
 * MCP Server A: NPCI UDIR Switch Service
 * Tool: req_chk_txn(txn_id, utr)
 */
export function mcpServerA_querySwitchTelemetry(txn_id: string): {
  tool: string;
  server: string;
  telemetry: SwitchLogRow;
  ledger: LedgerRow;
  latency_ms: number;
} {
  const sw = db.prepare('SELECT * FROM switch_logs WHERE txn_id = ?').get(txn_id) as SwitchLogRow | undefined;
  const ledger = db.prepare('SELECT * FROM ledger WHERE txn_id = ?').get(txn_id) as LedgerRow | undefined;

  if (!sw || !ledger) {
    throw new Error(`Switch telemetry not found for txn_id=${txn_id}`);
  }

  return {
    server: 'MCP Server A: NPCI UDIR Switch Service',
    tool: `req_chk_txn("${txn_id}", "${sw.utr}")`,
    telemetry: sw,
    ledger,
    latency_ms: 42,
  };
}

/**
 * MCP Server B: Fraud & Velocity Desk
 * Tool: check_account_risk(user_id)
 */
export function mcpServerB_checkAccountRisk(user_id: string): {
  tool: string;
  server: string;
  risk: RiskEventRow;
  parsed_factors: string[];
  latency_ms: number;
} {
  const risk = db.prepare('SELECT * FROM risk_events WHERE user_id = ?').get(user_id) as RiskEventRow | undefined;

  if (!risk) {
    throw new Error(`Risk profile not found for user_id=${user_id}`);
  }

  return {
    server: 'MCP Server B: Fraud & Velocity Desk',
    tool: `check_account_risk("${user_id}")`,
    risk,
    parsed_factors: JSON.parse(risk.risk_factors_json) as string[],
    latency_ms: 38,
  };
}

/**
 * MCP Server E: 3-Way Reconciliation & RBI TAT SLA Engine
 * Tool: verify_3way_recon_and_rbi_tat(txn_id)
 */
export function mcpServerE_verify3WayReconAndRbiTat(
  txn: TransactionRow,
  sw: SwitchLogRow,
  ledger: LedgerRow
): {
  server: string;
  tool: string;
  three_way_match_status: string;
  age_days: number;
  rbi_tat_breach_days: number;
  rbi_compensation_inr: number;
  latency_ms: number;
} {
  const createdMs = new Date(txn.created_at).getTime();
  const ageDays = Math.max(0, Math.round((Date.now() - createdMs) / (1000 * 60 * 60 * 24)));
  const isFailedUnsettled =
    (sw.switch_code === 'U69' || sw.switch_code === 'TIMEOUT') &&
    Boolean(sw.debit_confirmed) &&
    !sw.credit_confirmed &&
    ledger.ledger_state === 'DEBITED_UNSETTLED';

  // RBI Harmonization of Turnaround Time (TAT) Circular: P2M auto-reversal SLA is T+5 days.
  // Any delay beyond T+5 days mandates ₹100/day suo-motu customer compensation.
  const rbiTatBreachDays = isFailedUnsettled && ageDays > 5 ? ageDays - 5 : 0;
  const rbiCompensationInr = rbiTatBreachDays * 100;

  let threeWayStatus = 'CBS_DEBIT_MATCHED · NPCI_TIMEOUT · ACQUIRER_UNCREDITED';
  if (sw.switch_code === 'SUCCESS' || sw.switch_code === 'DEEMED_UP') {
    threeWayStatus = 'CBS_DEBIT_OK · NPCI_URCS_CLEARED · SUBLEDGER_WEBHOOK_MISSING';
  } else if (sw.switch_code === 'PENDING') {
    threeWayStatus = 'CBS_DEBIT_HOLD · NPCI_IN_FLIGHT_T0 · ACQUIRER_WAITING';
  } else if (!sw.debit_confirmed) {
    threeWayStatus = 'CBS_NO_DEBIT · NPCI_UNCONFIRMED · ACQUIRER_NONE';
  }

  return {
    server: 'MCP Server E: 3-Way Recon & RBI TAT SLA Engine',
    tool: `verify_3way_recon_and_rbi_tat("${txn.txn_id}")`,
    three_way_match_status: threeWayStatus,
    age_days: ageDays,
    rbi_tat_breach_days: rbiTatBreachDays,
    rbi_compensation_inr: rbiCompensationInr,
    latency_ms: 34,
  };
}

/**
 * MCP Server C / F: URCS Ledger, Reversal & RBI Compensation Service
 */
export function mcpServerC_executeSettlementReversal(params: {
  txn_id: string;
  ticket_id: string;
  idempotency_key: string;
  action_type:
    | 'AUTO_REVERSE'
    | 'AUTO_REVERSE_RBI_COMP'
    | 'CREDIT_RETRY'
    | 'HITL_APPROVED_REVERSE';
  rbi_compensation_inr?: number;
  actor: string;
  policy_rule: string;
}): {
  server: string;
  tool: string;
  idempotent_replay: boolean;
  new_ledger_state: LedgerRow['ledger_state'];
  settlement_utr: string;
  rbi_comp_utr: string | null;
  latency_ms: number;
} {
  const currentLedger = db.prepare('SELECT * FROM ledger WHERE txn_id = ?').get(params.txn_id) as LedgerRow;

  if (
    currentLedger.idempotency_key === params.idempotency_key ||
    currentLedger.ledger_state === 'REFUND_SETTLED' ||
    currentLedger.ledger_state === 'REFUND_PLUS_RBI_COMP_SETTLED' ||
    currentLedger.ledger_state === 'MERCHANT_CREDIT_RETRIED'
  ) {
    appendAuditLog({
      txn_id: params.txn_id,
      ticket_id: params.ticket_id,
      actor: params.actor,
      action: 'IDEMPOTENT_DUPLICATE_BLOCKED',
      policy_rule: params.policy_rule,
      idempotency_key: params.idempotency_key,
      details: {
        message: 'Duplicate execution prevented by idempotency key / terminal ledger state',
        existing_state: currentLedger.ledger_state,
        existing_settlement_utr: currentLedger.settlement_utr,
      },
    });

    return {
      server: 'MCP Server C: URCS Ledger & Reversal Service',
      tool: `execute_settlement_reversal("${params.txn_id}", "${params.idempotency_key}")`,
      idempotent_replay: true,
      new_ledger_state: currentLedger.ledger_state,
      settlement_utr: currentLedger.settlement_utr || `UTR-IDEMP-${params.txn_id}`,
      rbi_comp_utr: null,
      latency_ms: 14,
    };
  }

  let new_ledger_state: LedgerRow['ledger_state'] = 'REFUND_SETTLED';
  let prefix = 'UTR-REV';
  if (params.action_type === 'CREDIT_RETRY') {
    new_ledger_state = 'MERCHANT_CREDIT_RETRIED';
    prefix = 'UTR-URCS-CADJ';
  } else if (params.action_type === 'AUTO_REVERSE_RBI_COMP') {
    new_ledger_state = 'REFUND_PLUS_RBI_COMP_SETTLED';
    prefix = 'UTR-RBITAT-REV';
  }

  const suffix = params.txn_id.replace('TXN-', '');
  const settlement_utr = `${prefix}-${Date.now().toString().slice(-6)}-${suffix}`;
  const rbi_comp_utr =
    params.action_type === 'AUTO_REVERSE_RBI_COMP'
      ? `UTR-RBICOMP-${Date.now().toString().slice(-5)}-${suffix}`
      : null;
  const now = new Date().toISOString();

  const uniqueIdempKey = `${params.idempotency_key}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  db.prepare(`
    UPDATE ledger
    SET ledger_state = ?, settlement_utr = ?, idempotency_key = ?, updated_at = ?
    WHERE txn_id = ?
  `).run(new_ledger_state, settlement_utr, uniqueIdempKey, now, params.txn_id);

  appendAuditLog({
    txn_id: params.txn_id,
    ticket_id: params.ticket_id,
    actor: params.actor,
    action:
      params.action_type === 'CREDIT_RETRY'
        ? 'URCS_MERCHANT_CREDIT_ADJUSTMENT'
        : params.action_type === 'AUTO_REVERSE_RBI_COMP'
        ? 'REVERSAL_PLUS_RBI_SUO_MOTU_COMPENSATION'
        : 'CUSTOMER_REVERSAL_SETTLED',
    policy_rule: params.policy_rule,
    idempotency_key: params.idempotency_key,
    details: {
      previous_state: currentLedger.ledger_state,
      new_state: new_ledger_state,
      settlement_utr,
      rbi_compensation_inr: params.rbi_compensation_inr || 0,
      rbi_comp_utr,
    },
  });

  return {
    server:
      params.action_type === 'AUTO_REVERSE_RBI_COMP'
        ? 'MCP Server F: RBI Suo-Motu TAT Penalty Desk'
        : 'MCP Server C: URCS Ledger & Reversal Service',
    tool:
      params.action_type === 'AUTO_REVERSE_RBI_COMP'
        ? `credit_rbi_tat_compensation("${params.txn_id}", ₹${params.rbi_compensation_inr || 0})`
        : `execute_settlement_reversal("${params.txn_id}", "${params.idempotency_key}")`,
    idempotent_replay: false,
    new_ledger_state,
    settlement_utr,
    rbi_comp_utr,
    latency_ms: 64,
  };
}

/**
 * Node 5: Indic Voice Synthesis (Sarvam AI Bulbul Female Voice Script Generator)
 * Generates distinct, query-aware responses in Hindi, Tamil, and English based on both
 * the user's specific question focus AND the 3-way reconciliation outcome.
 */
export function buildIndicVoiceScripts(params: {
  txn: TransactionRow;
  decision: PolicyDecisionOutput['decision'];
  switch_code: string;
  settlement_utr: string | null;
  rbi_compensation_inr?: number;
  lang: 'hi-IN' | 'en-IN' | 'ta-IN';
  user_query?: string;
  gateway_hop_trace?: string;
  risk_score?: number;
}): { indic: string; english: string; sarvam_model: string } {
  const {
    txn,
    decision,
    switch_code,
    settlement_utr,
    rbi_compensation_inr = 0,
    lang,
    user_query = '',
    gateway_hop_trace = 'ISSUER_CBS -> NPCI_SWITCH -> ACQUIRER',
    risk_score = 0.05,
  } = params;
  const shortMerchant = txn.merchant_name.split(',')[0];
  const amtFormatted = `₹${txn.amount.toLocaleString('en-IN')}`;
  const queryFocus = detectUserQueryFocus(user_query);
  const refUtr = settlement_utr || txn.utr;

  if (decision === 'SECURITY_BLOCK') {
    return {
      indic: `सुरक्षा चेतावनी: आपके संदेश में नियम बायपास (Prompt Injection) का प्रयास पकड़ा गया है। ${shortMerchant} (${txn.txn_id}) के ${amtFormatted} ट्रांजैक्शन पर कोई बदलाव नहीं किया गया है और इसे सिक्योरिटी टीम को लॉग कर दिया गया है।`,
      english: `Security Guardrail Alert: Adversarial prompt injection detected on ${txn.txn_id} (${amtFormatted} at ${shortMerchant}). Autonomous ledger mutation was blocked with zero funds moved.`,
      sarvam_model: 'sarvam-bulbul:v2 (Anushka Voice)',
    };
  }

  // Tailor response when user specifically asks WHY / ROOT CAUSE
  if (queryFocus === 'WHY_ROOT_CAUSE') {
    if (decision === 'HITL') {
      return {
        indic: `आपके प्रश्न का उत्तर: ${shortMerchant} का ${amtFormatted} ट्रांजैक्शन (${txn.txn_id}) इसलिए रुका है क्योंकि NPCI कोड ${switch_code} और रिस्क स्कोर ${risk_score.toFixed(2)} सुरक्षा सीमा से ऊपर हैं। सीनियर स्पेशलिस्ट इसकी जांच कर रहे हैं।`,
        english: `Why this happened: Your ${amtFormatted} transaction at ${shortMerchant} (${txn.txn_id}) triggered NPCI code ${switch_code} (Hop: ${gateway_hop_trace}) with risk score ${risk_score.toFixed(2)}, requiring mandatory L2 specialist sign-off before refund.`,
        sarvam_model: 'sarvam-bulbul:v2 (Anushka Voice)',
      };
    }
    if (decision === 'CREDIT_RETRY') {
      return {
        indic: `आपके प्रश्न का उत्तर: ${txn.bank_name} और NPCI स्विच (${switch_code}) से ${amtFormatted} सफल था, लेकिन नेटवर्क हॉप (${gateway_hop_trace}) में वेबहुक ड्रॉप होने से ${shortMerchant} के साउंडबॉक्स पर कन्फर्मेशन नहीं आया। हमने URCS क्रेडिट (UTR: ${refUtr}) से इसे ठीक कर दिया है।`,
        english: `Why this happened: ${txn.bank_name} and NPCI Switch cleared ${amtFormatted} (${switch_code}), but the acquirer webhook dropped along [${gateway_hop_trace}]. ResolveOps completed a URCS credit adjustment to ${shortMerchant} under UTR ${refUtr}.`,
        sarvam_model: 'sarvam-bulbul:v2 (Anushka Voice)',
      };
    }
    return {
      indic: `आपके प्रश्न का उत्तर: ${txn.bank_name} से ${amtFormatted} कटने के बाद नेटवर्क हॉप (${gateway_hop_trace}) पर NPCI स्विच टाइमआउट (Code: ${switch_code}) हुआ था। इसलिए पैसे ${shortMerchant} को नहीं मिले और हमने तुरंत आपके खाते में रिफंड (UTR: ${refUtr}) जमा कर दिया है।`,
      english: `Why this happened: After ${txn.bank_name} debited ${amtFormatted}, the payment hit an NPCI response timeout (Code: ${switch_code}) at hop [${gateway_hop_trace}]. Because ${shortMerchant} was never credited, ResolveOps reversed ${amtFormatted} to your bank under UTR ${refUtr}.`,
      sarvam_model: 'sarvam-bulbul:v2 (Anushka Voice)',
    };
  }

  // Tailor response when user specifically asks whether MERCHANT / SHOPKEEPER received money
  if (queryFocus === 'MERCHANT_SOUNDBOX_STATUS') {
    if (decision === 'CREDIT_RETRY') {
      return {
        indic: `मर्चेंट स्टेटस: पहले वेबहुक देरी के कारण ${shortMerchant} को ${amtFormatted} नहीं मिला था, लेकिन अब Paytm ResolveOps ने 3-Way मिलान करके मर्चेंट लेजर में ${amtFormatted} जमा कर दिया है (UTR: ${refUtr}) और साउंडबॉक्स अलर्ट भेज दिया है।`,
        english: `Merchant Settlement Status: ${shortMerchant} initially missed the webhook for ${amtFormatted} despite NPCI ${switch_code}. ResolveOps has now credited ${shortMerchant}'s merchant ledger via URCS (UTR: ${refUtr}) and triggered Soundbox confirmation.`,
        sarvam_model: 'sarvam-bulbul:v2 (Anushka Voice)',
      };
    }
    return {
      indic: `मर्चेंट स्टेटस की पुष्टि: 3-Way रिकॉन्सिलिएशन में पाया गया कि ${shortMerchant} को आपका ${amtFormatted} बिल्कुल नहीं मिला (Merchant Credited: NO, Code: ${switch_code})। इसलिए पूरी राशि आपके ${txn.bank_name} खाते में रिफंड कर दी गई है (UTR: ${refUtr})।`,
      english: `Merchant Status Confirmed: 3-Way Reconciliation verified that ${shortMerchant} did NOT receive your ${amtFormatted} (Merchant Credited: False, Switch: ${switch_code}). Your money has been safely refunded to ${txn.bank_name} under UTR ${refUtr}.`,
      sarvam_model: 'sarvam-bulbul:v2 (Anushka Voice)',
    };
  }

  // Tailor response when user specifically asks for UTR / RECEIPT / BANK TIMELINE
  if (queryFocus === 'UTR_BANK_TIMELINE_PROOF') {
    return {
      indic: `बैंक UTR और टाइमलाइन प्रूफ: ट्रांजैक्शन ${txn.txn_id} (${amtFormatted}) का मूल NPCI RRN ${txn.utr} है और नया सेटलमेंट रेफरेंस ${refUtr} है। ${
        settlement_utr
          ? `यह राशि ${txn.bank_name} खाते में IMPS/UPI द्वारा तुरंत जमा कर दी गई है—आप ऊपर 'Check Balance' में अपडेटेड बैलेंस देख सकते हैं।`
          : `यह अभी L2 स्पेशलिस्ट के पास वेरिफिकेशन में है और अप्रूवल मिलते ही क्रेडिट हो जाएगा।`
      }`,
      english: `Official UTR & Bank Proof: For ${txn.txn_id} (${amtFormatted} at ${shortMerchant}), Original NPCI RRN is ${txn.utr} and Settlement UTR is ${refUtr}. ${
        settlement_utr
          ? `Funds are credited to ${txn.bank_name} immediately—tap 'Check Balance' at the top to see your updated balance.`
          : `Currently queued at L2 Specialist checkpoint for priority sign-off.`
      }`,
      sarvam_model: 'sarvam-bulbul:v2 (Anushka Voice)',
    };
  }

  // Tailor response when user asks about DOUBLE DEBIT / PAID TWICE
  if (queryFocus === 'DOUBLE_DEBIT_DUPLICATE') {
    return {
      indic: `डबल-डेबिट सुरक्षा जांच: हमने ${shortMerchant} के ${amtFormatted} ट्रांजैक्शन (${txn.txn_id}) पर Idempotency Lock (IDEMP-${txn.txn_id}) लगा दिया है। फेल हुए ट्रांजैक्शन की पूरी राशि ${amtFormatted} आपके ${txn.bank_name} खाते में वापस कर दी गई है (UTR: ${refUtr})।`,
      english: `Double-Debit Protection Verified: ResolveOps locked ${txn.txn_id} with idempotency key IDEMP-${txn.txn_id} so you cannot be charged twice. The failed ${amtFormatted} leg at ${shortMerchant} has been reversed to ${txn.bank_name} (UTR: ${refUtr}).`,
      sarvam_model: 'sarvam-bulbul:v2 (Anushka Voice)',
    };
  }

  // Tailor response when user asks about RBI COMPENSATION / T+5 SLA
  if (queryFocus === 'RBI_COMPENSATION_SLA') {
    if (decision === 'AUTO_REVERSE_RBI_COMP' || rbi_compensation_inr > 0) {
      const totalCredited = txn.amount + rbi_compensation_inr;
      return {
        indic: `RBI TAT मुआवजा विवरण: ${shortMerchant} का ${amtFormatted} ट्रांजैक्शन RBI की T+5 दिन की सीमा से 2 दिन अधिक अटका रहा। नियम अनुसार मूल राशि ${amtFormatted} + ₹${rbi_compensation_inr} मुआवजा (₹100/दिन), कुल ₹${totalCredited.toLocaleString('en-IN')} आपके ${txn.bank_name} खाते में जमा कर दिया गया है (UTR: ${refUtr})।`,
        english: `RBI TAT Compensation Breakdown: Because ${txn.txn_id} (${amtFormatted} at ${shortMerchant}) breached the RBI T+5 day auto-reversal mandate by 2 days, ResolveOps credited ${amtFormatted} principal + ₹${rbi_compensation_inr} suo-motu penalty (Total: ₹${totalCredited.toLocaleString('en-IN')}) under UTR ${refUtr}.`,
        sarvam_model: 'sarvam-bulbul:v2 (Anushka Voice)',
      };
    }
    return {
      indic: `RBI TAT SLA जांच: ट्रांजैक्शन ${txn.txn_id} (${amtFormatted}) आज ही T+0 क्लियरिंग विंडो में हल हो गया है (T+5 दिन की देरी नहीं हुई है)। इसलिए आपका ${amtFormatted} बिना किसी देरी के UTR ${refUtr} के तहत सेटल कर दिया गया है।`,
      english: `RBI TAT SLA Check: Transaction ${txn.txn_id} (${amtFormatted} at ${shortMerchant}) was resolved within the T+0 same-day window (well inside RBI's T+5 day mandate). Principal ${amtFormatted} is settled under Reference ${refUtr}.`,
      sarvam_model: 'sarvam-bulbul:v2 (Anushka Voice)',
    };
  }

  // Tailor response when user asks about SECURITY / FRAUD / ACCOUNT SAFETY
  if (queryFocus === 'SECURITY_RISK_FREEZE') {
    return {
      indic: `अकाउंट सुरक्षा रिपोर्ट: MCP-B फ्रॉड डेस्क ने आपके खाते की जांच की है (Risk Score: ${risk_score.toFixed(2)}, Switch: ${switch_code})। ${
        decision === 'HITL'
          ? `उच्च सुरक्षा मानकों के कारण ₹${txn.amount.toLocaleString('en-IN')} का यह ट्रांजैक्शन सीनियर स्पेशलिस्ट की निगरानी में सुरक्षित होल्ड पर है।`
          : `आपका खाता पूरी तरह सुरक्षित है और ₹${txn.amount.toLocaleString('en-IN')} की राशि UTR ${refUtr} के साथ सुरक्षित रूप से सेटल कर दी गई है।`
      }`,
      english: `Account Security Report: MCP-B Fraud & Velocity Desk audited ${txn.txn_id} (Risk Score: ${risk_score.toFixed(2)}, Switch: ${switch_code}). ${
        decision === 'HITL'
          ? `To protect your funds, this ${amtFormatted} transaction is held at L2 Specialist checkpoint before any ledger movement.`
          : `Your account is verified safe and ${amtFormatted} has been securely settled under UTR ${refUtr}.`
      }`,
      sarvam_model: 'sarvam-bulbul:v2 (Anushka Voice)',
    };
  }

  if (decision === 'HITL') {
    const hitlReasonHi =
      txn.amount > 25000
        ? `यह राशि ₹25,000 की ऑटो-रिफंड सीमा से अधिक (${amtFormatted}) है`
        : switch_code === 'U16'
        ? `NPCI ने इस पर U16 रिस्क डिक्लाइन कोड लगाया है`
        : `इस पर वेलोसिटी रिस्क स्कोर ${risk_score.toFixed(2)} पाया गया है`;
    const hitlReasonEn =
      txn.amount > 25000
        ? `amount ${amtFormatted} exceeds the ₹25,000 autonomous reversal cap`
        : switch_code === 'U16'
        ? `NPCI flagged code U16 (Risk Threshold Decline)`
        : `account velocity risk score is ${risk_score.toFixed(2)}`;

    return {
      indic: `नमस्ते, ${shortMerchant} पर आपका ${amtFormatted} का ट्रांजैक्शन (${txn.txn_id}) जांचा गया है। चूंकि ${hitlReasonHi}, इसे 3-Way ऑडिट डोजियर के साथ L2 सीनियर स्पेशलिस्ट को भेजा गया है। ऑपरेटर अप्रूवल मिलते ही रिफंड पूरा हो जाएगा।`,
      english: `Hello, we audited ${txn.txn_id} (${amtFormatted} at ${shortMerchant}). Because ${hitlReasonEn}, ResolveOps paused autonomous execution and routed a pre-audited 3-way dossier to our L2 Specialist for 1-click sign-off.`,
      sarvam_model: 'sarvam-bulbul:v2 (Anushka Voice)',
    };
  }

  if (decision === 'AUTO_REVERSE_RBI_COMP') {
    const totalCredited = txn.amount + rbi_compensation_inr;
    return {
      indic: `नमस्ते, ${shortMerchant} का ${amtFormatted} पेमेंट (${txn.txn_id}) RBI T+5 समय-सीमा से अधिक अटका रहा। Paytm ResolveOps ने मूल राशि ${amtFormatted} के साथ ₹${rbi_compensation_inr} का RBI TAT मुआवजा (कुल ₹${totalCredited.toLocaleString('en-IN')}) आपके ${txn.bank_name} खाते में जमा कर दिया है। UTR: ${settlement_utr}।`,
      english: `Hello, since your ${amtFormatted} transaction at ${shortMerchant} (${txn.txn_id}) breached the RBI T+5 Turnaround Time mandate, ResolveOps credited ${amtFormatted} principal plus ₹${rbi_compensation_inr} suo-motu RBI compensation (Total: ₹${totalCredited.toLocaleString('en-IN')}) to ${txn.bank_name}. UTR: ${settlement_utr}.`,
      sarvam_model: 'sarvam-bulbul:v2 (Anushka Voice)',
    };
  }

  if (decision === 'CREDIT_RETRY') {
    if (lang === 'ta-IN') {
      return {
        indic: `வணக்கம் ${shortMerchant}, உங்கள் ${amtFormatted} பரிவர்த்தனை (${txn.utr}) NPCI சுவிட்சில் (${switch_code}) வெற்றி பெற்றது. Paytm ResolveOps உங்கள் கணக்கில் உடனடியாக வரவு வைத்துள்ளது. UTR: ${settlement_utr}.`,
        english: `Hello ${shortMerchant}, customer debit for ${amtFormatted} succeeded at NPCI switch (${switch_code}). ResolveOps executed an NPCI URCS credit adjustment to your merchant ledger. Reference UTR: ${settlement_utr}.`,
        sarvam_model: 'sarvam-bulbul:v2 (Anushka Voice)',
      };
    }
    return {
      indic: `नमस्ते, 3-Way रिकॉन्सिलिएशन में ${shortMerchant} का ${amtFormatted} पेमेंट (${txn.txn_id}) NPCI स्विच (${switch_code}) पर सफल पाया गया है। Paytm ResolveOps ने URCS क्रेडिट एडजस्टमेंट द्वारा मर्चेंट लेजर में ${amtFormatted} तुरंत जमा कर दिया है। UTR: ${settlement_utr}।`,
      english: `Hello, 3-Way Reconciliation confirmed the ${amtFormatted} payment to ${shortMerchant} (${txn.txn_id}) succeeded at NPCI (${switch_code}). ResolveOps has credited the merchant ledger via URCS Credit Adjustment. UTR: ${settlement_utr}.`,
      sarvam_model: 'sarvam-bulbul:v2 (Anushka Voice)',
    };
  }

  if (decision === 'INFO_ONLY') {
    if (switch_code === 'PENDING') {
      return {
        indic: `नमस्ते, ${shortMerchant} का ${amtFormatted} ट्रांजैक्शन (${txn.txn_id}) अभी NPCI T+0 क्लियरिंग विंडो में प्रोसेस हो रहा है (${gateway_hop_trace})। कृपया दोबारा पेमेंट न करें, यह कुछ ही मिनटों में अपने आप सेटल हो जाएगा।`,
        english: `Hello, transaction ${txn.txn_id} for ${amtFormatted} at ${shortMerchant} is currently active inside the NPCI T+0 clearing window (${gateway_hop_trace}). Please do not pay again; it will settle automatically within minutes.`,
        sarvam_model: 'sarvam-bulbul:v2 (Anushka Voice)',
      };
    }
    return {
      indic: `नमस्ते, ${shortMerchant} का ${amtFormatted} ट्रांजैक्शन (${txn.txn_id}) पहले ही ${txn.bank_name} खाते में सेटल हो चुका है (UTR: ${settlement_utr || txn.utr})। आपके पैसे पूरी तरह सुरक्षित हैं और किसी डुप्लीकेट कार्रवाई की आवश्यकता नहीं है।`,
      english: `Hello, transaction ${txn.txn_id} for ${amtFormatted} at ${shortMerchant} is already reconciled in ${txn.bank_name} (UTR: ${settlement_utr || txn.utr}). Your funds are settled and protected against duplicate deduction.`,
      sarvam_model: 'sarvam-bulbul:v2 (Anushka Voice)',
    };
  }

  return {
    indic: `नमस्ते, ${shortMerchant} पर आपका ${amtFormatted} का पेमेंट ${txn.bank_name} और NPCI स्विच टाइमआउट (${switch_code}) के कारण अटका था। Paytm ResolveOps ने 3-Way जांच के बाद तुरंत ${amtFormatted} आपके ${txn.bank_name} खाते में रिफंड कर दिया है। नया UTR: ${settlement_utr}।`,
    english: `Hello, your ${amtFormatted} payment at ${shortMerchant} (${txn.txn_id}) failed due to ${txn.bank_name} / NPCI switch code ${switch_code}. Paytm ResolveOps verified that the merchant was uncredited and instantly refunded ${amtFormatted} to ${txn.bank_name}. Settlement UTR: ${settlement_utr}.`,
    sarvam_model: 'sarvam-bulbul:v2 (Anushka Voice)',
  };
}

/**
 * Execute the Full 10-Node NPCI UDIR & RBI TAT Multi-Agent Pipeline
 */
export async function executeResolveOpsGraph(params: {
  txn_id?: string;
  raw_dispute_text: string;
  preferred_lang?: 'hi-IN' | 'en-IN' | 'ta-IN';
  idempotency_key?: string;
  is_idempotency_replay_test?: boolean;
}): Promise<TicketRow> {
  const startTime = Date.now();
  const trace: GraphNodeTrace[] = [];

  // --- NODE 1 (Sequential): Ingestion, PII Masking & Guardrail ---
  const node1Start = Date.now();
  const guardrail = maskPIIAndDetectInjection(params.raw_dispute_text);

  let txn: TransactionRow | undefined;
  if (params.txn_id) {
    txn = db.prepare('SELECT * FROM transactions WHERE txn_id = ?').get(params.txn_id) as TransactionRow | undefined;
  }
  if (!txn && guardrail.extracted_txn_id) {
    txn = db.prepare('SELECT * FROM transactions WHERE txn_id = ?').get(guardrail.extracted_txn_id) as TransactionRow | undefined;
  }
  if (!txn && guardrail.extracted_utr) {
    txn = db.prepare('SELECT * FROM transactions WHERE utr = ?').get(guardrail.extracted_utr) as TransactionRow | undefined;
  }
  if (!txn) {
    txn = db.prepare('SELECT * FROM transactions WHERE txn_id = ?').get('TXN-984102') as TransactionRow;
  }

  if (!params.is_idempotency_replay_test && txn.txn_id !== 'TXN-984140') {
    db.prepare(`
      UPDATE ledger
      SET ledger_state = 'DEBITED_UNSETTLED', settlement_utr = NULL, idempotency_key = NULL, updated_at = ?
      WHERE txn_id = ?
    `).run(new Date().toISOString(), txn.txn_id);
  }

  const queryFocus = detectUserQueryFocus(guardrail.masked_text);
  let intentCategory = `${queryFocus}_${txn.txn_id.replace('TXN-', '')}`;
  if (guardrail.prompt_injection_detected) {
    intentCategory = 'ADVERSARIAL_PROMPT_INJECTION';
  } else if (txn.txn_id === 'TXN-984195' && queryFocus === 'GENERAL_DISPUTE_RESOLUTION') {
    intentCategory = 'RBI_TAT_SLA_BREACH_CLAIM';
  } else if ((txn.txn_id === 'TXN-984204' || txn.txn_id === 'TXN-984122') && queryFocus === 'GENERAL_DISPUTE_RESOLUTION') {
    intentCategory = 'URCS_DEEMED_MERCHANT_SETTLEMENT';
  } else if (txn.txn_id === 'TXN-984140' && queryFocus === 'GENERAL_DISPUTE_RESOLUTION') {
    intentCategory = 'RECONCILIATION_STATUS_CHECK';
  } else if (txn.txn_id === 'TXN-984168' && queryFocus === 'GENERAL_DISPUTE_RESOLUTION') {
    intentCategory = 'IN_FLIGHT_CLEARING_QUERY';
  }

  trace.push({
    node_id: 'NODE_1_INGEST_PII',
    node_name: 'Node 1 (Sequential): Ingestion & PII Guardrail',
    execution_mode: 'SEQUENTIAL',
    tool_called: 'ingest_and_mask_pii(payload)',
    status: guardrail.prompt_injection_detected ? 'BLOCKED' : 'COMPLETED',
    latency_ms: Math.max(18, Date.now() - node1Start),
    summary: guardrail.prompt_injection_detected
      ? `Prompt Injection intercepted (${guardrail.injection_triggers.join(', ')})`
      : `Redacted ${guardrail.pii_redacted_count} PII · Focus: ${queryFocus} · Extracted RRN/UTR ${txn.utr}`,
    output_data: {
      masked_payload: guardrail.masked_text,
      pii_redacted_count: guardrail.pii_redacted_count,
      redacted_types: guardrail.redacted_types,
      extracted_txn_id: txn.txn_id,
      extracted_utr: txn.utr,
      intent_category: intentCategory,
      query_focus: queryFocus,
      prompt_injection_detected: guardrail.prompt_injection_detected,
    },
  });

  // --- NODE 2 (3-Branch Parallel Execution Fan-Out): Switch A ‖ Fraud B ‖ 3-Way Recon & RBI TAT E ---
  const [branchA, branchB] = await Promise.all([
    Promise.resolve(mcpServerA_querySwitchTelemetry(txn.txn_id)),
    Promise.resolve(mcpServerB_checkAccountRisk(txn.user_id)),
  ]);
  const branchC = mcpServerE_verify3WayReconAndRbiTat(txn, branchA.telemetry, branchA.ledger);

  trace.push({
    node_id: 'NODE_2A_SWITCH_MCP',
    node_name: 'Branch 2A (Parallel): NPCI UDIR Switch (ReqChkTxn)',
    execution_mode: 'PARALLEL_BRANCH_A',
    mcp_server: branchA.server,
    tool_called: branchA.tool,
    status: 'COMPLETED',
    latency_ms: branchA.latency_ms,
    summary: `RespChkTxn: ${branchA.telemetry.switch_code} (${branchA.telemetry.switch_status}) · Debit=${Boolean(branchA.telemetry.debit_confirmed)} · Credit=${Boolean(branchA.telemetry.credit_confirmed)}`,
    output_data: {
      udir_api: 'ReqChkTxn -> RespChkTxn',
      switch_code: branchA.telemetry.switch_code,
      switch_status: branchA.telemetry.switch_status,
      debit_confirmed: Boolean(branchA.telemetry.debit_confirmed),
      credit_confirmed: Boolean(branchA.telemetry.credit_confirmed),
      merchant_credited: Boolean(branchA.telemetry.merchant_credited),
      gateway_hop_trace: branchA.telemetry.gateway_hop_trace,
      ledger_state_before: branchA.ledger.ledger_state,
    },
  });

  trace.push({
    node_id: 'NODE_2B_FRAUD_MCP',
    node_name: 'Branch 2B (Parallel): Fraud & Velocity Desk',
    execution_mode: 'PARALLEL_BRANCH_B',
    mcp_server: branchB.server,
    tool_called: branchB.tool,
    status: 'COMPLETED',
    latency_ms: branchB.latency_ms,
    summary: `Risk Score: ${branchB.risk.risk_score.toFixed(2)} · 10m Velocity: ${branchB.risk.velocity_10m} txns · Alert: ${Boolean(branchB.risk.velocity_alert)}`,
    output_data: {
      risk_score: branchB.risk.risk_score,
      velocity_10m: branchB.risk.velocity_10m,
      repeat_disputes_30d: branchB.risk.repeat_disputes_30d,
      velocity_alert: Boolean(branchB.risk.velocity_alert),
      risk_factors: branchB.parsed_factors,
    },
  });

  trace.push({
    node_id: 'NODE_2C_RECON_TAT_MCP',
    node_name: 'Branch 2C (Parallel): 3-Way Recon & RBI TAT SLA Engine',
    execution_mode: 'PARALLEL_BRANCH_C',
    mcp_server: branchC.server,
    tool_called: branchC.tool,
    status: 'COMPLETED',
    latency_ms: branchC.latency_ms,
    summary:
      branchC.rbi_tat_breach_days > 0
        ? `RBI T+5 Mandate Breached by ${branchC.rbi_tat_breach_days}d → ₹${branchC.rbi_compensation_inr} Suo-Motu Penalty Due`
        : `${branchC.three_way_match_status} · Within T+5 SLA (Age: ${branchC.age_days}d)`,
    output_data: {
      three_way_match_status: branchC.three_way_match_status,
      transaction_age_days: branchC.age_days,
      rbi_tat_sla_window: 'T+5 Days (P2M)',
      rbi_tat_breach_days: branchC.rbi_tat_breach_days,
      rbi_suo_motu_compensation_inr: branchC.rbi_compensation_inr,
    },
  });

  // --- NODE 3 (Sequential Join): Deterministic UDIR & RBI TAT Policy Router ---
  const policyOut = decidePolicy({
    txn_id: txn.txn_id,
    amount: txn.amount,
    risk_score: branchB.risk.risk_score,
    velocity_alert: Boolean(branchB.risk.velocity_alert),
    switch_code: branchA.telemetry.switch_code,
    debit_confirmed: Boolean(branchA.telemetry.debit_confirmed),
    credit_confirmed: Boolean(branchA.telemetry.credit_confirmed),
    merchant_credited: Boolean(branchA.telemetry.merchant_credited),
    ledger_state: branchA.ledger.ledger_state,
    prompt_injection_detected: guardrail.prompt_injection_detected,
    rbi_tat_breach_days: branchC.rbi_tat_breach_days,
  });

  trace.push({
    node_id: 'NODE_3_POLICY_ROUTER',
    node_name: 'Node 3 (Sequential): Deterministic UDIR & RBI Policy Router',
    execution_mode: 'SEQUENTIAL',
    tool_called: 'decide(s: DisputeState) -> str',
    status: policyOut.decision === 'SECURITY_BLOCK' ? 'BLOCKED' : 'COMPLETED',
    latency_ms: 4,
    summary: `Decision: ${policyOut.decision} (${policyOut.rule_triggered})`,
    output_data: {
      decision: policyOut.decision,
      rule_triggered: policyOut.rule_triggered,
      explanation: policyOut.explanation,
      can_mutate_ledger: policyOut.can_mutate_ledger,
      rbi_compensation_inr: policyOut.rbi_compensation_inr,
    },
  });

  const ticket_id = `TKT-${Date.now().toString().slice(-5)}${Math.floor(10 + Math.random() * 89)}`;
  const idempotency_key = params.idempotency_key || `IDEMP-${txn.txn_id}-${txn.utr}`;
  const lang = params.preferred_lang || txn.preferred_lang || 'hi-IN';

  let ledgerStateAfter = branchA.ledger.ledger_state;
  let settlementUtr = branchA.ledger.settlement_utr;
  let ticketStatus: TicketRow['status'] = 'COMPLETED';
  let dossier: HITLDossier | Record<string, never> = {};

  // --- NODE 4A, 4B, or 4C (Conditional Execution Branch) ---
  if (policyOut.decision === 'AUTO_REVERSE' || policyOut.decision === 'CREDIT_RETRY') {
    const revOut = mcpServerC_executeSettlementReversal({
      txn_id: txn.txn_id,
      ticket_id,
      idempotency_key,
      action_type: policyOut.decision,
      actor: 'AUTONOMOUS_AGENT_NODE_4A',
      policy_rule: policyOut.rule_triggered,
    });

    ledgerStateAfter = revOut.new_ledger_state;
    settlementUtr = revOut.settlement_utr;

    trace.push({
      node_id: 'NODE_4A_AUTO_EXEC',
      node_name: 'Node 4A: URCS Ledger Reversal / Credit Adj (MCP C)',
      execution_mode: 'CONDITIONAL_BRANCH',
      mcp_server: revOut.server,
      tool_called: revOut.tool,
      status: 'COMPLETED',
      latency_ms: revOut.latency_ms,
      summary: `${revOut.idempotent_replay ? 'Idempotent Replay' : 'Ledger Mutated'} → ${revOut.new_ledger_state} (${revOut.settlement_utr})`,
      output_data: {
        new_ledger_state: revOut.new_ledger_state,
        settlement_utr: revOut.settlement_utr,
        idempotent_replay: revOut.idempotent_replay,
        idempotency_key,
      },
    });
  } else if (policyOut.decision === 'AUTO_REVERSE_RBI_COMP') {
    const revOut = mcpServerC_executeSettlementReversal({
      txn_id: txn.txn_id,
      ticket_id,
      idempotency_key,
      action_type: 'AUTO_REVERSE_RBI_COMP',
      rbi_compensation_inr: policyOut.rbi_compensation_inr,
      actor: 'AUTONOMOUS_RBI_TAT_NODE_4B',
      policy_rule: policyOut.rule_triggered,
    });

    ledgerStateAfter = revOut.new_ledger_state;
    settlementUtr = revOut.settlement_utr;

    trace.push({
      node_id: 'NODE_4B_RBI_COMP_EXEC',
      node_name: 'Node 4B: RBI Suo-Motu ₹100/Day Penalty & Reversal (MCP F)',
      execution_mode: 'CONDITIONAL_BRANCH',
      mcp_server: revOut.server,
      tool_called: revOut.tool,
      status: 'COMPLETED',
      latency_ms: revOut.latency_ms,
      summary: `Principal ₹${txn.amount.toLocaleString('en-IN')} + RBI Penalty ₹${policyOut.rbi_compensation_inr} Credited (${revOut.settlement_utr})`,
      output_data: {
        new_ledger_state: revOut.new_ledger_state,
        principal_reversed_inr: txn.amount,
        rbi_suo_motu_penalty_inr: policyOut.rbi_compensation_inr,
        total_credited_inr: txn.amount + policyOut.rbi_compensation_inr,
        settlement_utr: revOut.settlement_utr,
        rbi_comp_utr: revOut.rbi_comp_utr,
      },
    });
  } else if (policyOut.decision === 'INFO_ONLY') {
    appendAuditLog({
      txn_id: txn.txn_id,
      ticket_id,
      actor: 'AUTONOMOUS_AGENT_NODE_4A',
      action: 'INFO_ONLY_NO_MUTATION',
      policy_rule: policyOut.rule_triggered,
      idempotency_key,
      details: { ledger_state: branchA.ledger.ledger_state, switch_code: branchA.telemetry.switch_code },
    });

    trace.push({
      node_id: 'NODE_4A_INFO_ONLY',
      node_name: 'Node 4A: Zero-Mutation Reconciled Path',
      execution_mode: 'CONDITIONAL_BRANCH',
      mcp_server: 'MCP Server C: URCS Ledger Service (Read-Only)',
      tool_called: 'verify_idempotent_state(txn_id)',
      status: 'COMPLETED',
      latency_ms: 11,
      summary: `No ledger write needed (${branchA.ledger.ledger_state} / ${branchA.telemetry.switch_code})`,
      output_data: {
        ledger_state: branchA.ledger.ledger_state,
        switch_code: branchA.telemetry.switch_code,
        settlement_utr: branchA.ledger.settlement_utr,
      },
    });
  } else if (policyOut.decision === 'HITL') {
    ticketStatus = 'PAUSED_HITL';
    dossier = {
      ticket_id,
      txn_id: txn.txn_id,
      utr: txn.utr,
      merchant_name: txn.merchant_name,
      customer_name: txn.customer_name,
      bank_name: txn.bank_name,
      amount: txn.amount,
      switch_code: branchA.telemetry.switch_code,
      switch_hop_trace: branchA.telemetry.gateway_hop_trace,
      risk_score: branchB.risk.risk_score,
      risk_factors: branchB.parsed_factors,
      escalation_reason: policyOut.explanation,
      recommended_operator_action:
        branchB.risk.risk_score >= 0.5
          ? 'REJECT_AND_FREEZE_ACCOUNT (High Velocity Fraud Pattern)'
          : 'APPROVE_SETTLEMENT_REVERSAL (Verified Switch Failure > Policy Threshold)',
      idempotency_key,
    };

    appendAuditLog({
      txn_id: txn.txn_id,
      ticket_id,
      actor: 'MCP_SERVER_D_OPS_BRIDGE',
      action: 'LANGGRAPH_INTERRUPT_HITL_PAUSED',
      policy_rule: policyOut.rule_triggered,
      idempotency_key,
      details: { amount: txn.amount, risk_score: branchB.risk.risk_score },
    });

    trace.push({
      node_id: 'NODE_4C_HITL_OPS',
      node_name: 'Node 4C: Human-in-the-Loop (HITL) Ops Interrupt',
      execution_mode: 'CONDITIONAL_BRANCH',
      mcp_server: 'MCP Server D: Internal Operations Bridge',
      tool_called: 'dispatch_hitl_ticket(payload) // interrupt()',
      status: 'PAUSED_INTERRUPT',
      latency_ms: 29,
      summary: 'Graph checkpoint saved · Waiting for Human Operator Approval or Rejection',
      output_data: dossier as unknown as Record<string, unknown>,
    });
  } else {
    ticketStatus = 'BLOCKED_INJECTION';
    appendAuditLog({
      txn_id: txn.txn_id,
      ticket_id,
      actor: 'SECURITY_GUARDRAIL_GATEWAY',
      action: 'PROMPT_INJECTION_BLOCKED',
      policy_rule: policyOut.rule_triggered,
      idempotency_key,
      details: { triggers: guardrail.injection_triggers, raw_excerpt: guardrail.masked_text.slice(0, 120) },
    });

    trace.push({
      node_id: 'NODE_4C_SECURITY_BLOCK',
      node_name: 'Node 4C: Adversarial Guardrail Quarantine',
      execution_mode: 'CONDITIONAL_BRANCH',
      mcp_server: 'Security & Guardrails Gateway',
      tool_called: 'quarantine_adversarial_payload(txn_id)',
      status: 'BLOCKED',
      latency_ms: 8,
      summary: `Blocked Prompt Injection (${guardrail.injection_triggers.join(', ')}) · Zero ledger writes`,
      output_data: {
        blocked_triggers: guardrail.injection_triggers,
        ledger_write_blocked: true,
      },
    });
  }

  // --- LIVE GENAI REASONING ENRICHMENT (Gemini 3.8 Flash + Query-Aware NLU) ---
  const fallbackVoice = buildIndicVoiceScripts({
    txn,
    decision: policyOut.decision,
    switch_code: branchA.telemetry.switch_code,
    settlement_utr: settlementUtr,
    rbi_compensation_inr: policyOut.rbi_compensation_inr,
    lang,
    user_query: guardrail.masked_text,
    gateway_hop_trace: branchA.telemetry.gateway_hop_trace,
    risk_score: branchB.risk.risk_score,
  });

  const liveGenAI = await runLiveGenAIWorkflowReasoning({
    masked_user_query: guardrail.masked_text,
    txn,
    switch_code: branchA.telemetry.switch_code,
    switch_status: branchA.telemetry.switch_status,
    gateway_hop_trace: branchA.telemetry.gateway_hop_trace,
    three_way_match_status: branchC.three_way_match_status,
    risk_score: branchB.risk.risk_score,
    policy_decision: policyOut.decision,
    rule_triggered: policyOut.rule_triggered,
    settlement_utr: settlementUtr,
    rbi_compensation_inr: policyOut.rbi_compensation_inr,
    lang,
    fallback_intent: intentCategory,
    fallback_voice: fallbackVoice,
  });

  intentCategory = liveGenAI.intent_category || intentCategory;

  // Enrich Node 1 trace with live GenAI NLU classification & problem summary
  if (trace[0]) {
    trace[0].output_data = {
      ...trace[0].output_data,
      intent_category: intentCategory,
      genai_nlu_model: liveGenAI.genai_model,
      pillar_1_problem_understanding: liveGenAI.user_problem_summary,
      pillar_2_decision_and_action: liveGenAI.ai_root_cause_diagnosis,
      pillar_3_timely_handoff_or_closure: liveGenAI.timely_handoff_or_action_brief,
    };
  }

  // Enrich HITL Dossier if paused at Node 4C
  if (policyOut.decision === 'HITL' && 'escalation_reason' in dossier) {
    dossier.escalation_reason = `${policyOut.explanation} | Handoff Brief: ${liveGenAI.timely_handoff_or_action_brief}`;
  }

  // --- NODE 5: Indic Voice Synthesis (Dynamic GenAI Script + Sarvam AI Indic Voice) ---
  trace.push({
    node_id: 'NODE_5_INDIC_VOICE',
    node_name: 'Node 5: Indic Voice Synthesis (Sarvam AI)',
    execution_mode: 'SEQUENTIAL',
    mcp_server: 'Sarvam AI Bulbul TTS Pipeline',
    tool_called: `synthesize_indic_voice(text, "${lang}")`,
    status: ticketStatus === 'PAUSED_HITL' ? 'PAUSED_INTERRUPT' : 'COMPLETED',
    latency_ms: Math.max(85, liveGenAI.ai_latency_ms),
    summary:
      ticketStatus === 'PAUSED_HITL'
        ? `Staged ${lang} Indic voice callback (${liveGenAI.genai_model})`
        : `Generated context-aware ${lang} Indic voice response via ${liveGenAI.genai_model}`,
    output_data: {
      voice_lang: lang,
      reasoning_model: liveGenAI.genai_model,
      tts_engine: 'Sarvam AI Bulbul (Anushka / Meera)',
      pillar_1_problem_understanding: liveGenAI.user_problem_summary,
      pillar_2_decision_and_action: liveGenAI.ai_root_cause_diagnosis,
      pillar_3_timely_handoff_or_closure: liveGenAI.timely_handoff_or_action_brief,
      script_indic: liveGenAI.voice_script_indic,
      script_english: liveGenAI.voice_script_english,
    },
  });

  // --- NODE 6: NPCI ReqTxnConfirmation Broadcast & UDIR ODR Ticket Closure ---
  trace.push({
    node_id: 'NODE_6_UDIR_CLOSURE',
    node_name: 'Node 6: NPCI ReqTxnConfirmation & ODR Closure',
    execution_mode: 'SEQUENTIAL',
    mcp_server: 'NPCI ODR / URCS Settlement Bus',
    tool_called: `broadcast_req_txn_confirmation("${txn.utr}", "${ledgerStateAfter}")`,
    status:
      ticketStatus === 'PAUSED_HITL'
        ? 'PAUSED_INTERRUPT'
        : ticketStatus === 'BLOCKED_INJECTION'
        ? 'BLOCKED'
        : 'COMPLETED',
    latency_ms: 21,
    summary:
      ticketStatus === 'PAUSED_HITL'
        ? 'Pending operator sign-off before broadcasting UDIR_AUTOUPDATE'
        : `Broadcasted UDIR_AUTOUPDATE (${ledgerStateAfter}) & closed ODR ticket ${ticket_id}`,
    output_data: {
      npci_message_type: 'ReqTxnConfirmation (UDIR_AUTOUPDATE)',
      rrn_utr: txn.utr,
      final_ledger_state: ledgerStateAfter,
      settlement_utr: settlementUtr,
      odr_ticket_closed: ticketStatus === 'COMPLETED',
    },
  });

  const totalLatency = Math.max(195, Date.now() - startTime);
  const nowIso = new Date().toISOString();

  db.prepare(`
    INSERT OR REPLACE INTO tickets (
      ticket_id, txn_id, user_id, raw_payload, masked_payload,
      pii_redacted_count, prompt_injection_detected, intent_category,
      extracted_utr, amount, switch_code, risk_score,
      ledger_state_before, ledger_state_after, policy_decision,
      policy_rule_triggered, status, graph_trace_json, dossier_json,
      voice_script_indic, voice_script_english, voice_lang,
      settlement_utr, idempotency_key, resolution_time_ms,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?
    )
  `).run(
    ticket_id,
    txn.txn_id,
    txn.user_id,
    params.raw_dispute_text,
    guardrail.masked_text,
    guardrail.pii_redacted_count,
    guardrail.prompt_injection_detected ? 1 : 0,
    intentCategory,
    txn.utr,
    txn.amount,
    branchA.telemetry.switch_code,
    branchB.risk.risk_score,
    branchA.ledger.ledger_state,
    ledgerStateAfter,
    policyOut.decision,
    policyOut.rule_triggered,
    ticketStatus,
    JSON.stringify(trace),
    JSON.stringify(dossier),
    liveGenAI.voice_script_indic,
    liveGenAI.voice_script_english,
    lang,
    settlementUtr,
    idempotency_key,
    totalLatency,
    nowIso,
    nowIso
  );

  return db.prepare('SELECT * FROM tickets WHERE ticket_id = ?').get(ticket_id) as TicketRow;
}

/**
 * Resume a Paused HITL Graph Checkpoint (Operator clicks Approve or Reject)
 */
export function resumeHitlTicket(params: {
  ticket_id: string;
  operator_action: 'APPROVE' | 'REJECT';
  operator_name: string;
}): TicketRow {
  const ticket = db.prepare('SELECT * FROM tickets WHERE ticket_id = ?').get(params.ticket_id) as TicketRow | undefined;
  if (!ticket) throw new Error(`Ticket ${params.ticket_id} not found`);

  const txn = db.prepare('SELECT * FROM transactions WHERE txn_id = ?').get(ticket.txn_id) as TransactionRow;
  const trace = JSON.parse(ticket.graph_trace_json) as GraphNodeTrace[];
  const nowIso = new Date().toISOString();

  if (params.operator_action === 'APPROVE') {
    const revOut = mcpServerC_executeSettlementReversal({
      txn_id: ticket.txn_id,
      ticket_id: ticket.ticket_id,
      idempotency_key: ticket.idempotency_key,
      action_type: 'HITL_APPROVED_REVERSE',
      actor: `HITL_OPERATOR_${params.operator_name.toUpperCase()}`,
      policy_rule: 'HITL_CHECKPOINT_APPROVED',
    });

    const voiceScripts = buildIndicVoiceScripts({
      txn,
      decision: 'AUTO_REVERSE',
      switch_code: ticket.switch_code,
      settlement_utr: revOut.settlement_utr,
      lang: (ticket.voice_lang as 'hi-IN' | 'en-IN' | 'ta-IN') || 'hi-IN',
    });

    const updatedTrace = trace.map((node) => {
      if (node.node_id === 'NODE_4C_HITL_OPS') {
        return {
          ...node,
          status: 'COMPLETED' as const,
          summary: `Approved by ${params.operator_name} · Resumed Graph → Settled (${revOut.settlement_utr})`,
          output_data: {
            ...node.output_data,
            operator_decision: 'APPROVED',
            operator_name: params.operator_name,
            settlement_utr: revOut.settlement_utr,
            resumed_at: nowIso,
          },
        };
      }
      if (node.node_id === 'NODE_5_INDIC_VOICE') {
        return {
          ...node,
          status: 'COMPLETED' as const,
          summary: `Checkpoint resumed → Dispatched ${ticket.voice_lang} female voice confirmation to merchant`,
          output_data: {
            ...node.output_data,
            script_indic: voiceScripts.indic,
            script_english: voiceScripts.english,
          },
        };
      }
      if (node.node_id === 'NODE_6_UDIR_CLOSURE') {
        return {
          ...node,
          status: 'COMPLETED' as const,
          summary: `Broadcasted UDIR_AUTOUPDATE (${revOut.new_ledger_state}) & closed ODR ticket ${ticket.ticket_id}`,
          output_data: {
            ...node.output_data,
            final_ledger_state: revOut.new_ledger_state,
            settlement_utr: revOut.settlement_utr,
            odr_ticket_closed: true,
          },
        };
      }
      return node;
    });

    db.prepare(`
      UPDATE tickets
      SET status = 'COMPLETED',
          ledger_state_after = ?,
          settlement_utr = ?,
          graph_trace_json = ?,
          voice_script_indic = ?,
          voice_script_english = ?,
          updated_at = ?
      WHERE ticket_id = ?
    `).run(
      revOut.new_ledger_state,
      revOut.settlement_utr,
      JSON.stringify(updatedTrace),
      voiceScripts.indic,
      voiceScripts.english,
      nowIso,
      ticket.ticket_id
    );
  } else {
    db.prepare(`
      UPDATE ledger SET ledger_state = 'FROZEN_BY_OPS', updated_at = ? WHERE txn_id = ?
    `).run(nowIso, ticket.txn_id);

    appendAuditLog({
      txn_id: ticket.txn_id,
      ticket_id: ticket.ticket_id,
      actor: `HITL_OPERATOR_${params.operator_name.toUpperCase()}`,
      action: 'HITL_REJECTED_AND_FROZEN',
      policy_rule: 'HITL_FRAUD_CONTAINMENT',
      idempotency_key: ticket.idempotency_key,
      details: { reason: 'Operator rejected reversal and froze dispute ledger state' },
    });

    const rejectIndic = `सूचना: ट्रांजैक्शन ${ticket.txn_id} (₹${ticket.amount.toLocaleString('en-IN')}) को सुरक्षा जांच के बाद ऑपरेशंस टीम द्वारा होल्ड पर रखा गया है।`;
    const rejectEng = `Notice: Transaction ${ticket.txn_id} (₹${ticket.amount.toLocaleString('en-IN')}) reversal was rejected by ${params.operator_name} due to risk verification failure.`;

    const updatedTrace = trace.map((node) => {
      if (node.node_id === 'NODE_4C_HITL_OPS') {
        return {
          ...node,
          status: 'BLOCKED' as const,
          summary: `Rejected by ${params.operator_name} · Account flagged & reversal aborted`,
        };
      }
      if (node.node_id === 'NODE_5_INDIC_VOICE' || node.node_id === 'NODE_6_UDIR_CLOSURE') {
        return {
          ...node,
          status: 'COMPLETED' as const,
          summary: 'Dispatched security hold notice & closed ODR ticket as FROZEN_BY_OPS',
        };
      }
      return node;
    });

    db.prepare(`
      UPDATE tickets
      SET status = 'REJECTED_BY_OPS',
          ledger_state_after = 'FROZEN_BY_OPS',
          graph_trace_json = ?,
          voice_script_indic = ?,
          voice_script_english = ?,
          updated_at = ?
      WHERE ticket_id = ?
    `).run(JSON.stringify(updatedTrace), rejectIndic, rejectEng, nowIso, ticket.ticket_id);
  }

  return db.prepare('SELECT * FROM tickets WHERE ticket_id = ?').get(params.ticket_id) as TicketRow;
}
