import React, { useState, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Search,
  Mic,
  MicOff,
  Send,
  Volume2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  RefreshCw,
  Landmark,
  Wallet,
  ShieldCheck,
  RotateCcw,
  ArrowUpRight,
} from 'lucide-react';

export interface UserAppScenarioItem {
  txn_id: string;
  utr: string;
  user_id: string;
  merchant_name: string;
  customer_name: string;
  bank_name: string;
  amount: number;
  currency: string;
  scenario_label: string;
  sample_dispute_text: string;
  preferred_lang: 'hi-IN' | 'en-IN' | 'ta-IN';
  switch_code: string;
  switch_status: string;
  debit_confirmed: number;
  credit_confirmed: number;
  merchant_credited: number;
  gateway_hop_trace: string;
  risk_score: number;
  ledger_state: string;
  settlement_utr: string | null;
}

export interface UserAppTicketItem {
  ticket_id: string;
  txn_id: string;
  raw_payload: string;
  masked_payload: string;
  pii_redacted_count: number;
  intent_category: string;
  extracted_utr: string;
  amount: number;
  switch_code: string;
  risk_score: number;
  ledger_state_before: string;
  ledger_state_after: string;
  policy_decision:
    | 'AUTO_REVERSE'
    | 'AUTO_REVERSE_RBI_COMP'
    | 'CREDIT_RETRY'
    | 'INFO_ONLY'
    | 'HITL'
    | 'SECURITY_BLOCK';
  policy_rule_triggered: string;
  status: 'COMPLETED' | 'PAUSED_HITL' | 'REJECTED_BY_OPS' | 'BLOCKED_INJECTION';
  graph_trace_json: string;
  dossier_json: string;
  voice_script_indic: string;
  voice_script_english: string;
  voice_lang: string;
  settlement_utr: string | null;
  resolution_time_ms: number;
  created_at: string;
}

interface CompletedHistoryItem {
  txn_id: string;
  utr: string;
  title: string;
  initials: string;
  avatarBg: string;
  avatarText: string;
  isCashback?: boolean;
  isBill?: boolean;
  dateStr: string;
  monthGroup: 'August 2026' | 'July 2026' | 'June 2026';
  tagLabel: string;
  TagEmoji: string;
  amount: number;
  isCredit: boolean;
  bankName: string;
}

function build100CompletedTransactions(): CompletedHistoryItem[] {
  const templates = [
    {
      title: 'Jio Prepaid Recharges',
      initials: 'JP',
      avatarBg: 'bg-orange-100',
      avatarText: 'text-blue-700',
      isBill: true,
      tagLabel: 'Bill Payments',
      TagEmoji: '🧾',
      amount: 349,
      isCredit: false,
      bankName: 'Bank of Baroda',
    },
    {
      title: 'Paytm Cashback',
      initials: 'CB',
      avatarBg: 'bg-sky-100',
      avatarText: 'text-sky-900',
      isCashback: true,
      tagLabel: 'Cashback',
      TagEmoji: '💰',
      amount: 1,
      isCredit: true,
      bankName: 'Bank of Baroda',
    },
    {
      title: 'Rishabh Keshari',
      initials: 'RK',
      avatarBg: 'bg-pink-100',
      avatarText: 'text-pink-900',
      tagLabel: 'Money Transfer',
      TagEmoji: '💵',
      amount: 10,
      isCredit: false,
      bankName: 'Bank of Baroda',
    },
    {
      title: 'Paytm Cashback',
      initials: 'CB',
      avatarBg: 'bg-sky-100',
      avatarText: 'text-sky-900',
      isCashback: true,
      tagLabel: 'Cashback',
      TagEmoji: '💰',
      amount: 2,
      isCredit: true,
      bankName: 'Bank of Baroda',
    },
    {
      title: 'DMRC Metro QR Ticket',
      initials: 'DM',
      avatarBg: 'bg-blue-100',
      avatarText: 'text-blue-900',
      tagLabel: 'Transit & Metro',
      TagEmoji: '🚇',
      amount: 60,
      isCredit: false,
      bankName: 'SBI Bank',
    },
    {
      title: 'Mother Dairy Booth #412',
      initials: 'MD',
      avatarBg: 'bg-emerald-100',
      avatarText: 'text-emerald-900',
      tagLabel: 'Groceries',
      TagEmoji: '🥛',
      amount: 120,
      isCredit: false,
      bankName: 'HDFC Bank',
    },
    {
      title: 'Zomato Limited',
      initials: 'ZM',
      avatarBg: 'bg-rose-100',
      avatarText: 'text-rose-900',
      tagLabel: 'Food & Dining',
      TagEmoji: '🍔',
      amount: 420,
      isCredit: false,
      bankName: 'SBI Bank',
    },
    {
      title: 'BSES Rajdhani Power',
      initials: 'BS',
      avatarBg: 'bg-amber-100',
      avatarText: 'text-amber-900',
      isBill: true,
      tagLabel: 'Electricity Bill',
      TagEmoji: '⚡',
      amount: 1850,
      isCredit: false,
      bankName: 'ICICI Bank',
    },
    {
      title: 'Aman Sharma',
      initials: 'AS',
      avatarBg: 'bg-purple-100',
      avatarText: 'text-purple-900',
      tagLabel: 'Money Received',
      TagEmoji: '↙️',
      amount: 500,
      isCredit: true,
      bankName: 'SBI Bank',
    },
    {
      title: 'IRCTC Rail Connect',
      initials: 'IR',
      avatarBg: 'bg-indigo-100',
      avatarText: 'text-indigo-900',
      tagLabel: 'Train Ticket',
      TagEmoji: '🚆',
      amount: 1140,
      isCredit: false,
      bankName: 'HDFC Bank',
    },
  ];

  const list: CompletedHistoryItem[] = [];
  for (let i = 1; i <= 100; i++) {
    const tpl = templates[(i - 1) % templates.length];
    const day = Math.max(1, 28 - Math.floor(i / 4));
    const hour = 9 + (i % 11);
    const min = 10 + ((i * 7) % 49);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const dispHour = hour > 12 ? hour - 12 : hour;
    const monthGroup: CompletedHistoryItem['monthGroup'] =
      i <= 35 ? 'August 2026' : i <= 75 ? 'July 2026' : 'June 2026';
    const monthShort =
      monthGroup === 'August 2026' ? 'Aug' : monthGroup === 'July 2026' ? 'Jul' : 'Jun';

    list.push({
      txn_id: `TXN-${100000 + i}`,
      utr: `41900283${(1000 + i).toString()}`,
      title: tpl.title,
      initials: tpl.initials,
      avatarBg: tpl.avatarBg,
      avatarText: tpl.avatarText,
      isCashback: tpl.isCashback,
      isBill: tpl.isBill,
      dateStr: `${day.toString().padStart(2, '0')} ${monthShort}, ${dispHour
        .toString()
        .padStart(2, '0')}:${min.toString().padStart(2, '0')} ${ampm}`,
      monthGroup,
      tagLabel: tpl.tagLabel,
      TagEmoji: tpl.TagEmoji,
      amount: tpl.amount,
      isCredit: tpl.isCredit,
      bankName: tpl.bankName,
    });
  }
  return list;
}

const COMPLETED_100 = build100CompletedTransactions();

interface PaytmUserAppViewProps {
  scenarios: UserAppScenarioItem[];
  tickets: UserAppTicketItem[];
  voiceLang: 'hi-IN' | 'en-IN' | 'ta-IN';
  onChangeVoiceLang: (lang: 'hi-IN' | 'en-IN' | 'ta-IN') => void;
  onExecuteDisputeFromUserApp: (
    txnId: string,
    userText: string,
    lang: 'hi-IN' | 'en-IN' | 'ta-IN'
  ) => Promise<UserAppTicketItem | null>;
  onSpeakIndicVoice: (text: string, lang: string) => void;
  isSpeaking: boolean;
  onOpenInBackendStudio: (txnId: string, ticket?: UserAppTicketItem) => void;
  onResetAllScenarios?: () => Promise<void>;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  secondaryTranslation?: string;
  lang: 'hi-IN' | 'en-IN' | 'ta-IN';
  timestamp: string;
  whyItHappened?: string;
  actionTakenBadge?: string;
  settlementUtr?: string | null;
  statusType?: 'RESOLVED' | 'ESCALATED_HITL' | 'BLOCKED' | 'INFO';
  executionDurationSec?: string;
  ticketRef?: UserAppTicketItem;
}

export const PaytmUserAppView: React.FC<PaytmUserAppViewProps> = ({
  scenarios,
  tickets,
  voiceLang,
  onChangeVoiceLang,
  onExecuteDisputeFromUserApp,
  onSpeakIndicVoice,
  isSpeaking,
  onOpenInBackendStudio,
  onResetAllScenarios,
}) => {
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'ISSUES' | 'RESOLVED' | 'COMPLETED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSelectedTxnId, setActiveSelectedTxnId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState<string>('');
  const [isBotThinking, setIsBotThinking] = useState<boolean>(false);
  const [executionStageIndex, setExecutionStageIndex] = useState<number>(0);
  const [chatHistories, setChatHistories] = useState<Record<string, ChatMessage[]>>({});
  const [queriedInSessionTxns, setQueriedInSessionTxns] = useState<Record<string, boolean>>({});
  const [isRecordingVoice, setIsRecordingVoice] = useState<boolean>(false);
  const [recSeconds, setRecSeconds] = useState<number>(0);
  const [showBankBalance, setShowBankBalance] = useState<boolean>(false);
  const [isCheckingBalance, setIsCheckingBalance] = useState<boolean>(false);
  const [showReceiptTimeline, setShowReceiptTimeline] = useState<boolean>(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<number | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // Map scenarios by txn_id
  const scenarioMap = useMemo(() => {
    const map = new Map<string, UserAppScenarioItem>();
    scenarios.forEach((s) => map.set(s.txn_id, s));
    return map;
  }, [scenarios]);

  // Only treat a transaction as resolved/active in the User App AFTER the user queries it in this session
  // (or if an operator just approved a paused HITL ticket that the user queried).
  const latestTicketByTxn = useMemo(() => {
    const map = new Map<string, UserAppTicketItem>();
    tickets.forEach((t) => {
      if (!map.has(t.txn_id) && queriedInSessionTxns[t.txn_id]) {
        map.set(t.txn_id, t);
      }
    });
    return map;
  }, [tickets, queriedInSessionTxns]);

  const selectedScenario = activeSelectedTxnId ? scenarioMap.get(activeSelectedTxnId) : undefined;
  const selectedCompletedTxn = activeSelectedTxnId
    ? COMPLETED_100.find((c) => c.txn_id === activeSelectedTxnId)
    : undefined;
  const latestTicketForSelected = activeSelectedTxnId
    ? latestTicketByTxn.get(activeSelectedTxnId)
    : undefined;

  // Calculate dynamic refunded amount added back to user's Bank of Baroda balance
  const totalRefundedInSession = useMemo(() => {
    let sum = 0;
    latestTicketByTxn.forEach((t) => {
      if (
        t.status === 'COMPLETED' &&
        (t.policy_decision === 'AUTO_REVERSE' || t.policy_decision === 'AUTO_REVERSE_RBI_COMP')
      ) {
        sum += t.amount + (t.policy_decision === 'AUTO_REVERSE_RBI_COMP' ? 200 : 0);
      }
    });
    return sum;
  }, [latestTicketByTxn]);

  // Localized step-by-step live execution progress messages shown while ResolveOps executes the task
  const getExecutionStages = (lang: 'hi-IN' | 'en-IN' | 'ta-IN', txnId: string, utr: string) => {
    if (lang === 'hi-IN') {
      return [
        `1/5 · आपकी समस्या और ट्रांजैक्शन ${txnId} (UTR: ${utr}) को समझा जा रहा है...`,
        `2/5 · बैंक सर्वर (CBS) और NPCI UPI स्विच (MCP A & C) से लाइव स्टेटस की जांच...`,
        `3/5 · अकाउंट सुरक्षा (MCP B) और RBI रिफंड पॉलिसी इंजन की जांच हो रही है...`,
        `4/5 · Paytm लेजर पर रिफंड / मर्चेंट सेटलमेंट पूरा किया जा रहा है...`,
        `5/5 · आपकी भाषा में वॉइस और लिखित समाधान तैयार किया जा रहा है...`,
      ];
    }
    if (lang === 'ta-IN') {
      return [
        `1/5 · பரிவர்த்தனை ${txnId} (UTR: ${utr}) மற்றும் புகார் ஆய்வு செய்யப்படுகிறது...`,
        `2/5 · NPCI சுவிட்ச் மற்றும் வங்கி 3-Way கணக்கு (MCP A & C) சரிபார்க்கப்படுகிறது...`,
        `3/5 · பாதுகாப்பு (MCP B) மற்றும் RBI கொள்கை விதிகள் சரிபார்க்கப்படுகின்றன...`,
        `4/5 · பணத்தைத் திரும்பப் பெறுதல் / தீர்வு (Settlement) செயல்படுத்தப்படுகிறது...`,
        `5/5 · குரல் மற்றும் எழுத்துப்பூர்வ பதில் தயாராகிறது...`,
      ];
    }
    return [
      `1/5 · Understanding problem, masking PII & verifying ${txnId} (UTR: ${utr})...`,
      `2/5 · Querying NPCI Switch (MCP-A) & 3-Way Bank/Merchant Recon (MCP-C)...`,
      `3/5 · Evaluating Account Risk (MCP-B) & RBI Dispute Policy Router...`,
      `4/5 · Executing bank refund / settlement on Paytm URCS Ledger...`,
      `5/5 · Generating native Indic voice & updating transaction receipt...`,
    ];
  };

  const detectEffectiveLanguage = (
    queryText: string,
    selectedLang: 'hi-IN' | 'en-IN' | 'ta-IN'
  ): 'hi-IN' | 'en-IN' | 'ta-IN' => {
    if (/[\u0B80-\u0BFF]/.test(queryText)) return 'ta-IN';
    if (/[\u0900-\u097F]/.test(queryText)) return 'hi-IN';
    // If typed in Latin alphabet, check if it's Hinglish vs English
    const hinglishWords = /\b(mera|mere|paise|paisa|kat|gaye|gaya|nhi|nahi|mila|dukaan|kab|milega|aaya|kya|kyu|kyon|wapas|खाते)\b/i;
    if (hinglishWords.test(queryText)) return 'hi-IN';
    if (/[a-zA-Z]{3,}/.test(queryText)) return 'en-IN';
    return selectedLang;
  };

  // Build localized, query-specific explanation of WHY the problem happened and HOW it was resolved
  const buildUserFriendlyResolution = (
    ticket: UserAppTicketItem,
    scen: UserAppScenarioItem | undefined,
    lang: 'hi-IN' | 'en-IN' | 'ta-IN',
    userQueryText: string
  ): {
    primaryText: string;
    whyItHappened: string;
    actionBadge: string;
    statusType: ChatMessage['statusType'];
  } => {
    const parsedTrace = JSON.parse(ticket.graph_trace_json || '[]') as Array<{
      node_id: string;
      output_data?: Record<string, unknown>;
    }>;
    const node1Data = parsedTrace.find((n) => n.node_id === 'NODE_1_INGEST_PII')?.output_data || {};
    const aiProblemSummary = String(node1Data.pillar_1_problem_understanding || '');
    const aiRootCause = String(node1Data.pillar_2_decision_and_action || '');
    const aiClosureBrief = String(node1Data.pillar_3_timely_handoff_or_closure || '');
    const queryFocus = String(node1Data.query_focus || 'GENERAL_DISPUTE_RESOLUTION');

    const primaryText =
      lang === 'en-IN' ? ticket.voice_script_english : ticket.voice_script_indic;

    const merchantShort = (scen?.merchant_name || 'Merchant').split(',')[0];
    const bankName = scen?.bank_name || 'Bank';
    const hopTrace = scen?.gateway_hop_trace || 'ISSUER_CBS -> NPCI_SWITCH -> ACQUIRER';
    const refUtr = ticket.settlement_utr || ticket.extracted_utr;

    let whyItHappened = '';
    if (lang === 'hi-IN') {
      if (queryFocus === 'WHY_ROOT_CAUSE') {
        whyItHappened = `तकनीकी कारण (Technical Root Cause): नेटवर्क पाथ [${hopTrace}] पर ${bankName} CBS ने डेबिट किया, लेकिन NPCI स्विच पर कोड ${ticket.switch_code} (Risk: ${ticket.risk_score.toFixed(2)}) दर्ज हुआ। नियम ${ticket.policy_rule_triggered} के तहत कार्रवाई पूरी की गई।`;
      } else if (queryFocus === 'MERCHANT_SOUNDBOX_STATUS') {
        whyItHappened = `मर्चेंट एवं साउंडबॉक्स जांच (3-Way Recon): ${bankName} (Debit: YES) ↔ NPCI (${ticket.switch_code}) ↔ ${merchantShort} लेजर की जांच की गई। सेटलमेंट रेफरेंस: ${refUtr}।`;
      } else if (queryFocus === 'UTR_BANK_TIMELINE_PROOF') {
        whyItHappened = `बैंकिंग ऑडिट प्रूफ: मूल RRN ${ticket.extracted_utr} · नया सेटलमेंट UTR ${refUtr} · लेजर स्टेटस: ${ticket.ledger_state_before} → ${ticket.ledger_state_after} (${bankName})।`;
      } else if (queryFocus === 'RBI_COMPENSATION_SLA') {
        whyItHappened = `RBI TAT सर्कुलर जांच: P2M फेल ट्रांजैक्शन के लिए T+5 दिन की समय-सीमा लागू होती है। देरी होने पर ₹100/दिन का स्वतः मुआवजा (${ticket.policy_rule_triggered}) देय होता है।`;
      } else if (ticket.switch_code === 'U69' && ticket.policy_decision === 'AUTO_REVERSE_RBI_COMP') {
        whyItHappened = `यह समस्या क्यों हुई: ${bankName} सर्वर टाइमआउट (NPCI Code: U69) के कारण पैसे कट गए थे और T+5 दिन से अधिक समय बीत गया था। इसलिए मूल राशि + ₹200 (₹100/दिन RBI मुआवजा) आपके खाते में जमा कर दिया गया है।`;
      } else if (ticket.switch_code === 'U69') {
        whyItHappened = `यह समस्या क्यों हुई: ${bankName} और NPCI स्विच के बीच हॉप [${hopTrace}] पर टाइमआउट (Code: U69) हुआ था। ${merchantShort} को पैसे नहीं मिले, इसलिए Paytm ResolveOps ने तुरंत ऑटो-रिफंड (${refUtr}) कर दिया है।`;
      } else if (ticket.switch_code === 'DEEMED_UP' || ticket.switch_code === 'SUCCESS') {
        whyItHappened = `यह समस्या क्यों हुई: NPCI स्विच पर पेमेंट सफल (${ticket.switch_code}) था लेकिन ${merchantShort} के सेटलमेंट लेजर में वेबहुक देरी थी। Paytm ResolveOps ने 3-Way मिलान करके मर्चेंट का सेटलमेंट (${refUtr}) पूरा कर दिया है।`;
      } else if (ticket.status === 'PAUSED_HITL') {
        whyItHappened = `यह समस्या क्यों हुई: यह ₹${ticket.amount.toLocaleString('en-IN')} का ट्रांजैक्शन (NPCI: ${ticket.switch_code}, Risk: ${ticket.risk_score.toFixed(2)}) सुरक्षा सीमा के अंतर्गत आता है। आपकी सुरक्षा के लिए इसे सीनियर स्पेशलिस्ट को प्रायोरिटी अप्रूवल के लिए भेजा गया है।`;
      } else if (ticket.switch_code === 'PENDING') {
        whyItHappened = `यह समस्या क्यों हुई: यह पेमेंट अभी NPCI की T+0 क्लियरिंग विंडो [${hopTrace}] में प्रोसेस हो रहा है। डुप्लीकेट कटौती से बचने के लिए इसे लॉक रखा गया है।`;
      } else {
        whyItHappened = aiRootCause || `NPCI Switch Code ${ticket.switch_code} की जांच पूरी हो गई है।`;
      }
    } else if (lang === 'ta-IN') {
      whyItHappened = `காரணம் (Root Cause): [${hopTrace}] வழியாக NPCI சுவிட்ச் குறியீடு (${ticket.switch_code}) மற்றும் ${bankName} 3-Way சரிபார்ப்பு செய்யப்பட்டது. ${aiRootCause}`;
    } else {
      whyItHappened = `${aiProblemSummary ? `${aiProblemSummary} ` : ''}Root Cause & Telemetry: ${
        aiRootCause ||
        `3-Way Reconciliation across ${bankName}, NPCI Switch (${ticket.switch_code}), and ${merchantShort} confirmed ${ticket.policy_rule_triggered}.`
      } ${aiClosureBrief ? `(${aiClosureBrief})` : ''}`;
    }

    let actionBadge = 'Instant Auto-Refund Settled';
    let statusType: ChatMessage['statusType'] = 'RESOLVED';

    if (ticket.status === 'PAUSED_HITL') {
      actionBadge =
        queryFocus === 'WHY_ROOT_CAUSE'
          ? `Escalation Reason Verified (${ticket.switch_code} · Risk ${ticket.risk_score.toFixed(2)})`
          : 'Handed Off to L2 Priority Specialist';
      statusType = 'ESCALATED_HITL';
    } else if (ticket.status === 'BLOCKED_INJECTION' || ticket.status === 'REJECTED_BY_OPS') {
      actionBadge = 'Security Guardrail: Prompt Injection Blocked';
      statusType = 'BLOCKED';
    } else if (queryFocus === 'WHY_ROOT_CAUSE') {
      actionBadge = `Root Cause Diagnosed (${ticket.switch_code}) & Resolved`;
      statusType = 'RESOLVED';
    } else if (queryFocus === 'MERCHANT_SOUNDBOX_STATUS') {
      actionBadge =
        ticket.policy_decision === 'CREDIT_RETRY'
          ? 'Merchant Ledger Credited & Soundbox Alerted'
          : 'Verified Merchant Uncredited · Refunded to Bank';
      statusType = 'RESOLVED';
    } else if (queryFocus === 'UTR_BANK_TIMELINE_PROOF') {
      actionBadge = `Official Bank UTR Proof (${refUtr})`;
      statusType = 'RESOLVED';
    } else if (queryFocus === 'DOUBLE_DEBIT_DUPLICATE') {
      actionBadge = 'Idempotency Lock Active · Failed Leg Reversed';
      statusType = 'RESOLVED';
    } else if (
      ticket.policy_decision === 'AUTO_REVERSE_RBI_COMP' ||
      queryFocus === 'RBI_COMPENSATION_SLA'
    ) {
      actionBadge =
        ticket.policy_decision === 'AUTO_REVERSE_RBI_COMP'
          ? 'Refund + ₹200 RBI Compensation Credited'
          : 'RBI T+5 SLA Verified · Settled on Time';
      statusType = 'RESOLVED';
    } else if (ticket.policy_decision === 'CREDIT_RETRY') {
      actionBadge = 'Merchant Settlement Credited (URCS)';
      statusType = 'RESOLVED';
    } else if (ticket.policy_decision === 'INFO_ONLY') {
      actionBadge =
        ticket.switch_code === 'PENDING'
          ? 'Active in NPCI T+0 Clearing Window'
          : 'Verified Reconciled (Idempotency Protected)';
      statusType = 'INFO';
    } else if (userQueryText.length > 0) {
      actionBadge = `Auto-Refunded ₹${ticket.amount.toLocaleString('en-IN')} (${ticket.switch_code})`;
      statusType = 'RESOLVED';
    }

    return { primaryText, whyItHappened, actionBadge, statusType };
  };

  const handleOpenTransaction = (txnId: string) => {
    setActiveSelectedTxnId(txnId);
  };

  const handleCheckBankBalance = () => {
    if (showBankBalance) {
      setShowBankBalance(false);
      return;
    }
    setIsCheckingBalance(true);
    window.setTimeout(() => {
      setIsCheckingBalance(false);
      setShowBankBalance(true);
    }, 600);
  };

  const handleSendUserProblem = async (overrideText?: string) => {
    if (!activeSelectedTxnId || isBotThinking) return;
    const textToSend = (overrideText ?? chatInput).trim();
    if (!textToSend) return;

    const effectiveLang = detectEffectiveLanguage(textToSend, voiceLang);
    if (effectiveLang !== voiceLang) {
      onChangeVoiceLang(effectiveLang);
    }

    setChatInput('');
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      lang: effectiveLang,
      timestamp: nowTime,
    };

    setChatHistories((prev) => ({
      ...prev,
      [activeSelectedTxnId]: [...(prev[activeSelectedTxnId] || []), userMsg],
    }));

    // Scroll chat to show user message & live execution card
    window.setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 80);

    // If this is one of the 100 Completed Successful Transactions, run a query-specific verification
    if (selectedCompletedTxn && !selectedScenario) {
      setIsBotThinking(true);
      setExecutionStageIndex(0);
      await new Promise((r) => window.setTimeout(r, 700));
      setExecutionStageIndex(1);
      await new Promise((r) => window.setTimeout(r, 700));
      setExecutionStageIndex(2);
      await new Promise((r) => window.setTimeout(r, 700));
      setIsBotThinking(false);

      const qLower = textToSend.toLowerCase();
      const isBillOrRecharge =
        /recharge|plan|bill|electricity|metro|ticket|activate|रिचार्ज|बिल|टिकट/i.test(qLower) ||
        selectedCompletedTxn.isBill;
      const isDoubleChargeQuery = /twice|double|duplicate|two times|दो बार|डबल/i.test(qLower);
      const isReceiverQuery = /receiver|merchant|shop|reached|received|मिला|पहुंचा/i.test(qLower);

      let replyText = '';
      let whyDetail = '';
      let badgeLabel = 'Verified Completed (00_SUCCESS)';

      if (isDoubleChargeQuery) {
        badgeLabel = 'Duplicate Debit Audit: Single Charge Only';
        replyText =
          effectiveLang === 'hi-IN'
            ? `हमने आपके ${selectedCompletedTxn.bankName} खाते की जांच की है। ${selectedCompletedTxn.title} (${selectedCompletedTxn.txn_id}) के लिए केवल एक बार ₹${selectedCompletedTxn.amount} कटा है (NPCI RRN: ${selectedCompletedTxn.utr})। कोई डबल डिडक्शन नहीं हुआ है।`
            : `We audited your ${selectedCompletedTxn.bankName} statement for ${selectedCompletedTxn.dateStr}. Only a single debit of ₹${selectedCompletedTxn.amount} to ${selectedCompletedTxn.title} was processed under NPCI RRN ${selectedCompletedTxn.utr}. Zero duplicate charges found.`;
        whyDetail = `3-Way Ledger Check: 1 Debit on ${selectedCompletedTxn.bankName} CBS matched 1 Credit on NPCI Switch (RRN: ${selectedCompletedTxn.utr}).`;
      } else if (isBillOrRecharge) {
        badgeLabel = `Biller / Operator Confirmed (${selectedCompletedTxn.tagLabel})`;
        replyText =
          effectiveLang === 'hi-IN'
            ? `${selectedCompletedTxn.title} का ₹${selectedCompletedTxn.amount} पेमेंट (${selectedCompletedTxn.tagLabel}) BBPS/ऑपरेटर द्वारा कन्फर्म हो चुका है (RRN: ${selectedCompletedTxn.utr}, Biller Ref: BBPS-${selectedCompletedTxn.txn_id.slice(-4)})। सेवा तुरंत सक्रिय हो गई है।`
            : `Your ₹${selectedCompletedTxn.amount} payment for ${selectedCompletedTxn.title} (${selectedCompletedTxn.tagLabel}) is confirmed with the operator under NPCI RRN ${selectedCompletedTxn.utr} and Biller Ref BBPS-${selectedCompletedTxn.txn_id.slice(-4)}.`;
        whyDetail = `NPCI Switch returned 00_SUCCESS and biller fulfillment webhook acknowledged receipt on ${selectedCompletedTxn.dateStr}.`;
      } else if (isReceiverQuery) {
        badgeLabel = 'Beneficiary Bank Credit Verified';
        replyText =
          effectiveLang === 'hi-IN'
            ? `जी हां, ${selectedCompletedTxn.title} को ₹${selectedCompletedTxn.amount} सफलतापूर्वक मिल चुका है (${selectedCompletedTxn.dateStr}, NPCI RRN: ${selectedCompletedTxn.utr})। आप यह RRN नंबर प्रूफ के तौर पर दिखा सकते हैं।`
            : `Yes! Beneficiary ${selectedCompletedTxn.title}'s bank account was credited with ₹${selectedCompletedTxn.amount} on ${selectedCompletedTxn.dateStr} (NPCI RRN: ${selectedCompletedTxn.utr}). You can share this RRN as official settlement proof.`;
        whyDetail = `Beneficiary bank CBS returned 00_SUCCESS credit acknowledgment for RRN ${selectedCompletedTxn.utr}.`;
      } else {
        replyText =
          effectiveLang === 'hi-IN'
            ? `नमस्ते! आपके प्रश्न ("${textToSend.slice(0, 45)}") की जांच की गई: ${selectedCompletedTxn.title} का ₹${selectedCompletedTxn.amount} ट्रांजैक्शन (${selectedCompletedTxn.dateStr}) पूरी तरह सफल (00_SUCCESS, RRN: ${selectedCompletedTxn.utr}) है।`
            : effectiveLang === 'ta-IN'
            ? `வணக்கம்! உங்கள் ₹${selectedCompletedTxn.amount} பரிவர்த்தனை (${selectedCompletedTxn.title}, UTR: ${selectedCompletedTxn.utr}) வெற்றிகரமாக (00_SUCCESS) முடிந்தது.`
            : `We checked your query ("${textToSend.slice(0, 50)}") for ${selectedCompletedTxn.title}: ₹${selectedCompletedTxn.amount} from ${selectedCompletedTxn.bankName} settled with NPCI code 00_SUCCESS under RRN ${selectedCompletedTxn.utr} on ${selectedCompletedTxn.dateStr}.`;
        whyDetail = `3-Way Audit: ${selectedCompletedTxn.bankName} Debit OK · NPCI Switch 00_SUCCESS · Beneficiary Credited (RRN ${selectedCompletedTxn.utr}).`;
      }

      const botMsg: ChatMessage = {
        id: `b-${Date.now()}`,
        sender: 'bot',
        text: replyText,
        lang: effectiveLang,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        whyItHappened: whyDetail,
        actionTakenBadge: badgeLabel,
        settlementUtr: selectedCompletedTxn.utr,
        statusType: 'INFO',
        executionDurationSec: '2.1s',
      };
      setChatHistories((prev) => ({
        ...prev,
        [activeSelectedTxnId]: [...(prev[activeSelectedTxnId] || []), botMsg],
      }));
      onSpeakIndicVoice(replyText, effectiveLang);
      return;
    }

    // Execute the REAL 10-Node ResolveOps Backend Workflow while stepping through the 5 live execution stages (~5.4 seconds)
    const startTime = performance.now();
    setIsBotThinking(true);
    setExecutionStageIndex(0);

    const stageTimer1 = window.setTimeout(() => setExecutionStageIndex(1), 1050);
    const stageTimer2 = window.setTimeout(() => setExecutionStageIndex(2), 2200);
    const stageTimer3 = window.setTimeout(() => setExecutionStageIndex(3), 3350);
    const stageTimer4 = window.setTimeout(() => setExecutionStageIndex(4), 4400);

    // Run both the backend workflow execution AND the realistic 5-stage investigation delay in parallel
    // so ResolveOps genuinely performs its task before returning the response to the user!
    const [ticket] = await Promise.all([
      onExecuteDisputeFromUserApp(activeSelectedTxnId, textToSend, effectiveLang),
      new Promise((resolve) => window.setTimeout(resolve, 5400)),
    ]);

    window.clearTimeout(stageTimer1);
    window.clearTimeout(stageTimer2);
    window.clearTimeout(stageTimer3);
    window.clearTimeout(stageTimer4);
    setIsBotThinking(false);

    const elapsedSec = ((performance.now() - startTime) / 1000).toFixed(1) + 's';

    if (ticket) {
      // Mark this transaction as actively resolved/queried in the user's Balance & History
      setQueriedInSessionTxns((prev) => ({
        ...prev,
        [activeSelectedTxnId]: true,
      }));

      const { primaryText, whyItHappened, actionBadge, statusType } =
        buildUserFriendlyResolution(ticket, selectedScenario, effectiveLang, textToSend);

      const botMsg: ChatMessage = {
        id: `b-${Date.now()}`,
        sender: 'bot',
        text: primaryText,
        secondaryTranslation:
          effectiveLang !== 'en-IN' ? ticket.voice_script_english : ticket.voice_script_indic,
        lang: effectiveLang,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        whyItHappened,
        actionTakenBadge: actionBadge,
        settlementUtr: ticket.settlement_utr,
        statusType,
        executionDurationSec: elapsedSec,
        ticketRef: ticket,
      };

      setChatHistories((prev) => ({
        ...prev,
        [activeSelectedTxnId]: [...(prev[activeSelectedTxnId] || []), botMsg],
      }));

      window.setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

      // Automatically speak the response in the user's chosen language after ResolveOps finishes
      onSpeakIndicVoice(primaryText, effectiveLang);
    }
  };

  // Live Voice Recording inside the User App Chat
  const toggleUserVoiceMic = async () => {
    if (isRecordingVoice) {
      if (recTimerRef.current) {
        window.clearInterval(recTimerRef.current);
        recTimerRef.current = null;
      }
      setIsRecordingVoice(false);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    audioChunksRef.current = [];
    setRecSeconds(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      setIsRecordingVoice(true);

      recTimerRef.current = window.setInterval(() => {
        setRecSeconds((s) => s + 1);
      }, 1000);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
        }

        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });

        try {
          const base64Audio = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const resStr = reader.result as string;
              resolve(resStr.includes(',') ? resStr.split(',')[1] : resStr);
            };
            reader.onerror = reject;
            reader.readAsDataURL(audioBlob);
          });

          const res = await fetch('/api/voice/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audio_base64: base64Audio,
              mime_type: (recorder.mimeType || 'audio/webm').split(';')[0],
              lang: voiceLang,
              txn_id: activeSelectedTxnId,
            }),
          });
          const data = await res.json();
          const spoken =
            data.transcript?.trim() ||
            selectedScenario?.sample_dispute_text ||
            `Payment issue with ${activeSelectedTxnId}`;
          await handleSendUserProblem(spoken);
        } catch {
          const fallbackText =
            selectedScenario?.sample_dispute_text ||
            `Please check my payment ${activeSelectedTxnId}`;
          await handleSendUserProblem(fallbackText);
        }
      };

      recorder.start(250);
    } catch {
      if (selectedScenario) {
        await handleSendUserProblem(selectedScenario.sample_dispute_text);
      }
    }
  };

  const handleResetMobileSession = async () => {
    setQueriedInSessionTxns({});
    setChatHistories({});
    setActiveSelectedTxnId(null);
    if (onResetAllScenarios) {
      await onResetAllScenarios();
    }
  };

  // Count how many issues the user has resolved in this session
  const resolvedCountInSession = useMemo(() => {
    return scenarios.filter((s) => latestTicketByTxn.get(s.txn_id)?.status === 'COMPLETED').length;
  }, [scenarios, latestTicketByTxn]);

  // Filtered list for Payment History
  const filteredIssues = useMemo(() => {
    if (historyFilter === 'COMPLETED') return [];
    return scenarios.filter((s) => {
      const tkt = latestTicketByTxn.get(s.txn_id);
      const isResolved = tkt?.status === 'COMPLETED';
      if (historyFilter === 'RESOLVED' && !isResolved) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        s.merchant_name.toLowerCase().includes(q) ||
        s.txn_id.toLowerCase().includes(q) ||
        s.utr.toLowerCase().includes(q) ||
        s.scenario_label.toLowerCase().includes(q)
      );
    });
  }, [scenarios, historyFilter, searchQuery, latestTicketByTxn]);

  const filteredCompleted = useMemo(() => {
    if (historyFilter === 'ISSUES' || historyFilter === 'RESOLVED') return [];
    return COMPLETED_100.filter((c) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        c.title.toLowerCase().includes(q) ||
        c.txn_id.toLowerCase().includes(q) ||
        c.tagLabel.toLowerCase().includes(q)
      );
    });
  }, [historyFilter, searchQuery]);

  const getInitials = (name: string) => {
    const parts = name.replace(/[^a-zA-Z ]/g, '').trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const avatarColors = [
    'bg-pink-100 text-pink-900',
    'bg-sky-100 text-sky-900',
    'bg-amber-100 text-amber-900',
    'bg-emerald-100 text-emerald-900',
    'bg-purple-100 text-purple-900',
    'bg-orange-100 text-orange-900',
  ];

  const currentStages = getExecutionStages(
    voiceLang,
    activeSelectedTxnId || 'TXN',
    selectedScenario?.utr || selectedCompletedTxn?.utr || ''
  );

  return (
    <div className="w-full flex items-center justify-center py-1">
      {/* ==================== ONLY MOBILE PAYTM INTERFACE (Centered on Desktop, Full-Screen on Mobile) ==================== */}
      <div className="w-full max-w-[440px] mx-auto bg-white sm:rounded-[30px] sm:border-[6px] sm:border-zinc-900 sm:shadow-2xl overflow-hidden flex flex-col min-h-[780px] max-h-[860px]">
        {/* Mobile Status Bar */}
        <div className="px-5 py-2 bg-white flex items-center justify-between text-[11px] font-semibold text-zinc-800 select-none border-b border-zinc-100">
          <span>12:46</span>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-600">
            <span>VoLTE</span>
            <span>5G</span>
            <span className="px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-900 font-bold">88%</span>
          </div>
        </div>

        {/* ==================== SCREEN A: PAYTM BALANCE & HISTORY (INTERACTIVE MOBILE SCREEN) ==================== */}
        {!activeSelectedTxnId ? (
          <div className="flex-1 flex flex-col overflow-hidden bg-white">
            {/* Top App Header: <- Balance & History */}
            <div className="px-4 py-3 bg-white flex items-center justify-between border-b border-zinc-100 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <ArrowLeft className="w-5 h-5 text-zinc-900" />
                <div>
                  <h1 className="text-[18px] font-bold text-zinc-900 tracking-tight leading-none">
                    Balance &amp; History
                  </h1>
                  <span className="text-[10px] text-zinc-500">
                    Tap any payment to ask query &amp; resolve live
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                { Object.keys(queriedInSessionTxns).length > 0 && (
                  <button
                    onClick={handleResetMobileSession}
                    title="Reset all scenarios to unsolved state"
                    className="px-2 py-1 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                )}
                <SlidersHorizontal className="w-4 h-4 text-[#00baf2]" />
              </div>
            </div>

            {/* Interactive Account Balance Section (Matches Paytm Balance & History Top Card) */}
            <div className="px-4 py-2.5 bg-[#f5f8fc] border-b border-zinc-200/80 space-y-2">
              <div className="bg-white rounded-2xl p-3 border border-zinc-200/80 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-orange-500 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      BOB
                    </div>
                    <div>
                      <div className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                        <span>Bank of Baroda •• 4821</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-50 text-sky-700 font-semibold border border-sky-200">
                          Primary UPI
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500">Savings Account</div>
                    </div>
                  </div>

                  <div className="text-right">
                    {showBankBalance ? (
                      <div>
                        <div className="text-sm font-bold text-zinc-900 tabular-nums">
                          ₹{(42850 + totalRefundedInSession).toLocaleString('en-IN')}.00
                        </div>
                        {totalRefundedInSession > 0 && (
                          <div className="text-[10px] font-semibold text-emerald-600">
                            +₹{totalRefundedInSession.toLocaleString('en-IN')} Refunded
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={handleCheckBankBalance}
                        className="px-2.5 py-1 rounded-full bg-sky-50 hover:bg-sky-100 text-[#00baf2] font-bold text-[11px] border border-sky-200 transition-colors cursor-pointer"
                      >
                        {isCheckingBalance ? 'Checking...' : 'Check Balance'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 text-zinc-600">
                    <Wallet className="w-3.5 h-3.5 text-[#00baf2]" />
                    <span>Paytm UPI Lite Balance:</span>
                    <strong className="text-zinc-900">₹1,240.00</strong>
                  </div>
                  {resolvedCountInSession > 0 && (
                    <span className="text-emerald-700 font-semibold">
                      {resolvedCountInSession} Issue{resolvedCountInSession > 1 ? 's' : ''} Resolved
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Payment History Search & Filter Strip */}
            <div className="px-4 py-2.5 bg-white border-b border-zinc-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-zinc-900">Payment History</span>
                <span className="text-[11px] text-zinc-500">112 Total Transactions</span>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-[#00baf2] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search merchant, amount, UTR or Txn ID..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-full focus:bg-white focus:border-[#00baf2] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-4 gap-1 text-[11px] font-semibold">
                <button
                  onClick={() => setHistoryFilter('ALL')}
                  className={`py-1.5 rounded-full transition-colors cursor-pointer ${
                    historyFilter === 'ALL'
                      ? 'bg-[#00baf2] text-white'
                      : 'bg-zinc-50 text-zinc-600 border border-zinc-200'
                  }`}
                >
                  All (112)
                </button>
                <button
                  onClick={() => setHistoryFilter('ISSUES')}
                  className={`py-1.5 rounded-full transition-colors cursor-pointer ${
                    historyFilter === 'ISSUES'
                      ? 'bg-amber-500 text-white'
                      : 'bg-amber-50/70 text-amber-900 border border-amber-200'
                  }`}
                >
                  Issues (12)
                </button>
                <button
                  onClick={() => setHistoryFilter('RESOLVED')}
                  className={`py-1.5 rounded-full transition-colors cursor-pointer ${
                    historyFilter === 'RESOLVED'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-50/70 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  Resolved ({resolvedCountInSession})
                </button>
                <button
                  onClick={() => setHistoryFilter('COMPLETED')}
                  className={`py-1.5 rounded-full transition-colors cursor-pointer ${
                    historyFilter === 'COMPLETED'
                      ? 'bg-[#002970] text-white'
                      : 'bg-zinc-50 text-zinc-700 border border-zinc-200'
                  }`}
                >
                  Paid (100)
                </button>
              </div>
            </div>

            {/* Scrollable Payment History List */}
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
              {/* Monthly Summary Header 1: October 2026 (12 Interactive Scenarios) */}
              {filteredIssues.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-[#f4f7fb] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-zinc-900">
                        October 2026 · Recent Transactions
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        Tap any transaction to ask a query &amp; get real-time resolution
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-semibold text-[#002970]">
                        {filteredIssues.length} Transactions
                      </div>
                    </div>
                  </div>

                  {filteredIssues.map((scen, idx) => {
                    const sessionTicket = latestTicketByTxn.get(scen.txn_id);
                    const isResolvedNow = sessionTicket?.status === 'COMPLETED';
                    const isPausedHitl = sessionTicket?.status === 'PAUSED_HITL';
                    const isBlocked =
                      sessionTicket?.status === 'BLOCKED_INJECTION' ||
                      sessionTicket?.status === 'REJECTED_BY_OPS';
                    const colorClass = avatarColors[idx % avatarColors.length];

                    return (
                      <div
                        key={scen.txn_id}
                        className={`px-4 py-3 transition-colors ${
                          isResolvedNow ? 'bg-emerald-50/30' : 'hover:bg-sky-50/40'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleOpenTransaction(scen.txn_id)}
                          className="w-full text-left flex items-start justify-between gap-3 cursor-pointer"
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <div
                              className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${colorClass}`}
                            >
                              {getInitials(scen.merchant_name)}
                            </div>
                            <div className="min-w-0 space-y-1">
                              <div className="text-[15px] font-semibold text-zinc-900 truncate">
                                {scen.merchant_name.split(',')[0]}
                              </div>
                              <div className="text-xs text-zinc-500">
                                Today, 11:{(10 + idx * 3).toString().padStart(2, '0')} AM ·{' '}
                                {scen.txn_id}
                              </div>

                              {/* Interactive Status Pill inside Payment History */}
                              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                {isResolvedNow ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    <span>
                                      Resolved ·{' '}
                                      {sessionTicket?.settlement_utr || 'Verified'}
                                    </span>
                                  </span>
                                ) : isPausedHitl ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                                    <Clock className="w-3 h-3 text-amber-700" />
                                    <span>Specialist Reviewing ({sessionTicket?.ticket_id})</span>
                                  </span>
                                ) : isBlocked ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-800 border border-red-300">
                                    <AlertTriangle className="w-3 h-3 text-red-600" />
                                    <span>Security Hold Applied</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-900 border border-amber-200">
                                    <span>⚠️ {scen.scenario_label.split('(')[0].trim()}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0 space-y-1">
                            <div
                              className={`text-[15px] font-bold tabular-nums ${
                                isResolvedNow &&
                                (sessionTicket?.policy_decision === 'AUTO_REVERSE' ||
                                  sessionTicket?.policy_decision === 'AUTO_REVERSE_RBI_COMP')
                                  ? 'text-emerald-600'
                                  : 'text-zinc-900'
                              }`}
                            >
                              {isResolvedNow &&
                              (sessionTicket?.policy_decision === 'AUTO_REVERSE' ||
                                sessionTicket?.policy_decision === 'AUTO_REVERSE_RBI_COMP')
                                ? `+ ₹${scen.amount.toLocaleString('en-IN')}`
                                : `- ₹${scen.amount.toLocaleString('en-IN')}`}
                            </div>
                            <div className="text-[11px] text-zinc-500 flex items-center justify-end gap-1">
                              <span>
                                {isResolvedNow &&
                                (sessionTicket?.policy_decision === 'AUTO_REVERSE' ||
                                  sessionTicket?.policy_decision === 'AUTO_REVERSE_RBI_COMP')
                                  ? 'Refund In'
                                  : 'From'}
                              </span>
                              <span className="w-3.5 h-3.5 rounded-full bg-orange-500 text-white text-[8px] font-bold inline-flex items-center justify-center">
                                B
                              </span>
                            </div>
                            <div className="text-[10px] font-bold text-[#00baf2] flex items-center justify-end gap-0.5">
                              <span>{isResolvedNow ? 'View Resolution' : 'Ask / Resolve'}</span>
                              <ChevronRight className="w-3 h-3" />
                            </div>
                          </div>
                        </button>

                        {/* If Resolved by ResolveOps after user queried it, show an interactive Resolution Summary Strip directly inside Balance & History! */}
                        {sessionTicket && (
                          <div className="mt-2 pt-2 border-t border-zinc-200/70 flex items-center justify-between gap-2 text-[11px]">
                            <div className="text-zinc-700 truncate">
                              <strong className="text-zinc-900">ResolveOps:</strong>{' '}
                              {voiceLang === 'en-IN'
                                ? sessionTicket.voice_script_english
                                : sessionTicket.voice_script_indic}
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSpeakIndicVoice(
                                  voiceLang === 'en-IN'
                                    ? sessionTicket.voice_script_english
                                    : sessionTicket.voice_script_indic,
                                  voiceLang
                                );
                              }}
                              className="px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[10px] flex items-center gap-1 shrink-0 cursor-pointer"
                            >
                              <Volume2 className="w-3 h-3" />
                              <span>Play Indic Voice</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}

              {/* Monthly Summary Header 2: August & July 2026 (100 Completed Successful Transactions) */}
              {filteredCompleted.length > 0 && (
                <>
                  <div className="px-4 py-2.5 bg-[#f4f7fb] flex items-center justify-between">
                    <div className="text-xs font-bold text-zinc-900">
                      August &amp; July 2026 (100 Completed)
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-[10px] text-zinc-500">Total Spent</div>
                        <div className="text-xs font-bold text-zinc-900">₹34,720</div>
                      </div>
                      <div className="w-5 h-5 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>

                  {filteredCompleted.map((item) => (
                    <button
                      key={item.txn_id}
                      onClick={() => handleOpenTransaction(item.txn_id)}
                      className="w-full text-left px-4 py-3.5 hover:bg-zinc-50 transition-colors flex items-start justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        {item.isCashback ? (
                          <div className="w-11 h-11 rounded-full bg-white border border-zinc-100 flex flex-col items-center justify-center shrink-0">
                            <span className="text-[9px] font-black tracking-tighter text-[#002970] leading-none">
                              CASH
                            </span>
                            <span className="text-[9px] font-black tracking-tighter text-[#00baf2] leading-none">
                              BACK
                            </span>
                          </div>
                        ) : (
                          <div
                            className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${item.avatarBg} ${item.avatarText}`}
                          >
                            {item.initials}
                          </div>
                        )}

                        <div className="min-w-0 space-y-1">
                          <div className="text-[15px] font-medium text-zinc-900 truncate">
                            {item.title}
                          </div>
                          <div className="text-xs text-zinc-500">{item.dateStr}</div>
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] text-zinc-700 bg-zinc-100 border border-zinc-200/80">
                              <span>{item.TagEmoji}</span>
                              <span>{item.tagLabel}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 space-y-1">
                        <div
                          className={`text-[15px] font-bold tabular-nums ${
                            item.isCredit ? 'text-emerald-600' : 'text-zinc-900'
                          }`}
                        >
                          {item.isCredit ? `+ ₹${item.amount}` : `- ₹${item.amount}`}
                        </div>
                        <div className="text-xs text-zinc-500 flex items-center justify-end gap-1">
                          <span>{item.isCredit ? 'In' : 'From'}</span>
                          <span className="w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] font-bold inline-flex items-center justify-center">
                            B
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* Bottom Paytm | Powered by UPI Footer */}
            <div className="py-2.5 bg-white border-t border-zinc-100 flex items-center justify-center gap-2 text-xs text-zinc-500 select-none">
              <span className="font-bold tracking-tight text-[#002970]">paytm</span>
              <span className="text-zinc-300">|</span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                Powered by <strong className="text-zinc-800">UPI</strong>
              </span>
            </div>
          </div>
        ) : (
          /* ==================== SCREEN B: INTERACTIVE TRANSACTION RECEIPT & LIVE RESOLVEOPS ASSISTANT ==================== */
          <div className="flex-1 flex flex-col overflow-hidden bg-[#f5f7fa]">
            {/* Top Mobile Bar */}
            <div className="px-3.5 py-3 bg-[#002970] text-white flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  onClick={() => setActiveSelectedTxnId(null)}
                  className="p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="min-w-0">
                  <div className="text-sm font-bold truncate">
                    {selectedScenario
                      ? selectedScenario.merchant_name.split(',')[0]
                      : selectedCompletedTxn?.title}
                  </div>
                  <div className="text-[11px] text-sky-200 truncate">
                    {activeSelectedTxnId} · UTR{' '}
                    {selectedScenario?.utr || selectedCompletedTxn?.utr}
                  </div>
                </div>
              </div>

              {/* Language Selector Pill inside User App */}
              <div className="flex items-center gap-0.5 bg-white/10 p-0.5 rounded-lg text-[10px] font-semibold shrink-0">
                {(
                  [
                    { code: 'hi-IN', label: 'हिन्दी' },
                    { code: 'en-IN', label: 'EN' },
                    { code: 'ta-IN', label: 'தமிழ்' },
                  ] as const
                ).map((l) => (
                  <button
                    key={l.code}
                    onClick={() => onChangeVoiceLang(l.code)}
                    className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                      voiceLang === l.code ? 'bg-[#00baf2] text-white' : 'text-white/80'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive Paytm Transaction Receipt & Live Status Stepper */}
            <div className="bg-white border-b border-zinc-200 px-4 py-3 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] text-zinc-500 flex items-center gap-1">
                    <Landmark className="w-3 h-3 text-zinc-400" />
                    <span>
                      {selectedScenario?.bank_name || selectedCompletedTxn?.bankName} •• 4821
                    </span>
                  </div>
                  <div className="text-xl font-bold text-zinc-900 tabular-nums mt-0.5">
                    ₹
                    {(
                      selectedScenario?.amount ||
                      selectedCompletedTxn?.amount ||
                      0
                    ).toLocaleString('en-IN')}
                  </div>
                </div>

                {/* Live Dynamic Status Pill (Updates only AFTER ResolveOps finishes executing the user's query!) */}
                <div className="text-right">
                  {isBotThinking ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-[#002970] border border-sky-200">
                      <RefreshCw className="w-3.5 h-3.5 text-[#00baf2] animate-spin" />
                      <span>ResolveOps Executing...</span>
                    </span>
                  ) : latestTicketForSelected?.status === 'COMPLETED' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Resolved &amp; Settled</span>
                    </span>
                  ) : latestTicketForSelected?.status === 'PAUSED_HITL' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>L2 Specialist Reviewing</span>
                    </span>
                  ) : latestTicketForSelected?.status === 'BLOCKED_INJECTION' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                      <span>Security Blocked</span>
                    </span>
                  ) : selectedScenario ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span>Need Help / Pending</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Payment Successful</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Collapsible Interactive Payment & Resolution Timeline inside Receipt */}
              <div className="pt-1 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowReceiptTimeline((v) => !v)}
                  className="w-full flex items-center justify-between text-[11px] font-semibold text-zinc-600 hover:text-zinc-900 cursor-pointer"
                >
                  <span>
                    {latestTicketForSelected
                      ? `Resolution Ref: ${
                          latestTicketForSelected.settlement_utr ||
                          latestTicketForSelected.ticket_id
                        }`
                      : `UPI Ref / UTR: ${
                          selectedScenario?.utr || selectedCompletedTxn?.utr
                        }`}
                  </span>
                  <span className="flex items-center gap-1 text-[#00baf2]">
                    <span>{showReceiptTimeline ? 'Hide Timeline' : 'Payment Timeline'}</span>
                    {showReceiptTimeline ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </span>
                </button>

                {showReceiptTimeline && (
                  <div className="mt-2 space-y-1.5 text-[11px] pl-1">
                    <div className="flex items-center gap-2 text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        1. Money debited from {selectedScenario?.bank_name || 'Bank'} (₹
                        {(
                          selectedScenario?.amount ||
                          selectedCompletedTxn?.amount ||
                          0
                        ).toLocaleString('en-IN')}
                        )
                      </span>
                    </div>

                    <div
                      className={`flex items-center gap-2 ${
                        isBotThinking
                          ? 'text-[#002970] font-semibold'
                          : latestTicketForSelected
                          ? 'text-emerald-700'
                          : selectedScenario
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                      }`}
                    >
                      {isBotThinking ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0 text-[#00baf2]" />
                      ) : latestTicketForSelected || !selectedScenario ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>
                        {isBotThinking
                          ? '2. ResolveOps checking NPCI Switch & Bank Ledger...'
                          : latestTicketForSelected
                          ? `2. NPCI Switch (${latestTicketForSelected.switch_code}) & 3-Way Recon Verified`
                          : selectedScenario
                          ? '2. Payment stuck / unconfirmed — Ask ResolveOps below'
                          : '2. NPCI Switch 00_SUCCESS Verified'}
                      </span>
                    </div>

                    <div
                      className={`flex items-center gap-2 ${
                        latestTicketForSelected?.status === 'COMPLETED'
                          ? 'text-emerald-700 font-semibold'
                          : latestTicketForSelected?.status === 'PAUSED_HITL'
                          ? 'text-amber-800 font-semibold'
                          : 'text-zinc-400'
                      }`}
                    >
                      {latestTicketForSelected?.status === 'COMPLETED' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                      ) : latestTicketForSelected?.status === 'PAUSED_HITL' ? (
                        <Clock className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>
                        {latestTicketForSelected?.status === 'COMPLETED'
                          ? `3. Settled (${
                              latestTicketForSelected.settlement_utr || 'Verified'
                            })`
                          : latestTicketForSelected?.status === 'PAUSED_HITL'
                          ? '3. Handed off to L2 Risk Specialist for approval'
                          : '3. Awaiting your query to execute resolution'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Chat & Live Task Execution Scroll Area */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
              {/* Initial Welcome & Interactive Query Prompt Card */}
              <div className="bg-white border border-zinc-200 rounded-2xl rounded-tl-xs p-3.5 shadow-2xs space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#002970] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#00baf2]" />
                    Paytm 24×7 AI ResolveOps
                  </span>
                  <span className="text-[10px] text-zinc-400">Live Voice &amp; Chat</span>
                </div>
                <p className="text-zinc-700 leading-relaxed">
                  {voiceLang === 'hi-IN'
                    ? `नमस्ते! अपने ₹${(
                        selectedScenario?.amount ||
                        selectedCompletedTxn?.amount ||
                        0
                      ).toLocaleString('en-IN')} के ट्रांजैक्शन (${activeSelectedTxnId}) के लिए नीचे दिए गए प्रश्न पर टैप करें या माइक दबाकर अपनी समस्या बोलें:`
                    : voiceLang === 'ta-IN'
                    ? `வணக்கம்! உங்கள் ₹${(
                        selectedScenario?.amount ||
                        selectedCompletedTxn?.amount ||
                        0
                      ).toLocaleString('en-IN')} பரிவர்த்தனையை (${activeSelectedTxnId}) தீர்க்க கீழே உள்ள பட்டனை அழுத்தவும் அல்லது மைக்கில் பேசவும்:`
                    : `Hello! Ask your question about this ₹${(
                        selectedScenario?.amount ||
                        selectedCompletedTxn?.amount ||
                        0
                      ).toLocaleString('en-IN')} transaction (${activeSelectedTxnId}). Tap a question below, type, or use the Mic:`}
                </p>

                {/* Interactive 1-Tap Query Chips (Each triggers a distinct query focus & investigation angle) */}
                <div className="flex flex-col gap-1.5 pt-0.5">
                  {selectedScenario ? (
                    <>
                      <button
                        onClick={() => handleSendUserProblem(selectedScenario.sample_dispute_text)}
                        disabled={isBotThinking}
                        className="w-full text-left px-3 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 disabled:opacity-50 text-[#002970] font-semibold border border-sky-200 transition-colors cursor-pointer flex items-center justify-between gap-2"
                      >
                        <span className="line-clamp-2">
                          💬 “{selectedScenario.sample_dispute_text}”
                        </span>
                        <ChevronRight className="w-4 h-4 shrink-0 text-[#00baf2]" />
                      </button>

                      <button
                        onClick={() =>
                          handleSendUserProblem(
                            voiceLang === 'hi-IN'
                              ? `यह समस्या क्यों हुई? ${selectedScenario.bank_name} और NPCI स्विच में क्या तकनीकी कारण था?`
                              : voiceLang === 'ta-IN'
                              ? `இந்த பரிவர்த்தனை ஏன் தோல்வியடைந்தது? NPCI மற்றும் வங்கி காரணம் என்ன?`
                              : `Why did this ₹${selectedScenario.amount} payment fail? Explain the exact bank & NPCI switch root cause.`
                          )
                        }
                        disabled={isBotThinking}
                        className="w-full text-left px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 text-zinc-800 font-medium transition-colors cursor-pointer flex items-center justify-between gap-2"
                      >
                        <span>
                          {voiceLang === 'hi-IN'
                            ? '🔍 यह क्यों हुआ? (बैंक व NPCI स्विच कारण जानें)'
                            : voiceLang === 'ta-IN'
                            ? '🔍 இது ஏன் நடந்தது? (வங்கி & NPCI காரணம்)'
                            : '🔍 Why did this happen? (Check Bank & Switch Root Cause)'}
                        </span>
                        <ChevronRight className="w-4 h-4 shrink-0 text-zinc-500" />
                      </button>

                      <button
                        onClick={() =>
                          handleSendUserProblem(
                            voiceLang === 'hi-IN'
                              ? `क्या दुकानदार (${selectedScenario.merchant_name.split(',')[0]}) को ₹${selectedScenario.amount} मिले या नहीं? साउंडबॉक्स स्टेटस चेक करें।`
                              : `Did the merchant (${selectedScenario.merchant_name.split(',')[0]}) receive my ₹${selectedScenario.amount} or why didn't Soundbox confirm?`
                          )
                        }
                        disabled={isBotThinking}
                        className="w-full text-left px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 text-zinc-800 font-medium transition-colors cursor-pointer flex items-center justify-between gap-2"
                      >
                        <span>
                          {voiceLang === 'hi-IN'
                            ? '🏪 क्या मर्चेंट/दुकानदार को पैसे मिले? (3-Way जांच)'
                            : '🏪 Did the merchant receive the money? (3-Way Recon)'}
                        </span>
                        <ChevronRight className="w-4 h-4 shrink-0 text-zinc-500" />
                      </button>

                      <button
                        onClick={() =>
                          handleSendUserProblem(
                            voiceLang === 'hi-IN'
                              ? `मुझे इस ₹${selectedScenario.amount} ट्रांजैक्शन का नया रिफंड UTR प्रूफ और RBI T+5 मुआवजा स्टेटस बताएं।`
                              : `Share official Settlement UTR proof for ₹${selectedScenario.amount} and check RBI T+5 delay compensation eligibility.`
                          )
                        }
                        disabled={isBotThinking}
                        className="w-full text-left px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 text-zinc-800 font-medium transition-colors cursor-pointer flex items-center justify-between gap-2"
                      >
                        <span>
                          {voiceLang === 'hi-IN'
                            ? '🧾 ऑफिशियल बैंक UTR प्रूफ और RBI मुआवजा चेक करें'
                            : '🧾 Get Official Bank UTR Proof & RBI TAT SLA Check'}
                        </span>
                        <ChevronRight className="w-4 h-4 shrink-0 text-zinc-500" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() =>
                          handleSendUserProblem(
                            `Did the receiver (${selectedCompletedTxn?.title}) get my ₹${selectedCompletedTxn?.amount} payment (${activeSelectedTxnId})?`
                          )
                        }
                        disabled={isBotThinking}
                        className="w-full text-left px-3 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-[#002970] font-semibold border border-sky-200 transition-colors cursor-pointer flex items-center justify-between"
                      >
                        <span>✅ Did receiver get the money? (Verify NPCI RRN)</span>
                        <ChevronRight className="w-4 h-4 shrink-0 text-[#00baf2]" />
                      </button>
                      <button
                        onClick={() =>
                          handleSendUserProblem(
                            `Check if ₹${selectedCompletedTxn?.amount} for ${selectedCompletedTxn?.title} was deducted twice from my ${selectedCompletedTxn?.bankName} account.`
                          )
                        }
                        disabled={isBotThinking}
                        className="w-full text-left px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-medium transition-colors cursor-pointer flex items-center justify-between"
                      >
                        <span>🔄 Check for Double Debit / Duplicate Charge</span>
                        <ChevronRight className="w-4 h-4 shrink-0 text-zinc-500" />
                      </button>
                      <button
                        onClick={() =>
                          handleSendUserProblem(
                            `Verify biller / operator activation status and receipt for ${selectedCompletedTxn?.title} (₹${selectedCompletedTxn?.amount}).`
                          )
                        }
                        disabled={isBotThinking}
                        className="w-full text-left px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-medium transition-colors cursor-pointer flex items-center justify-between"
                      >
                        <span>🧾 Verify Operator / Biller Fulfillment Receipt</span>
                        <ChevronRight className="w-4 h-4 shrink-0 text-zinc-500" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Render Conversation Messages */}
              {(chatHistories[activeSelectedTxnId] || []).map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.sender === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[92%] rounded-2xl p-3.5 text-xs space-y-2.5 shadow-2xs ${
                      msg.sender === 'user'
                        ? 'bg-[#00baf2] text-white rounded-br-xs'
                        : 'bg-white border border-zinc-200 text-zinc-900 rounded-tl-xs'
                    }`}
                  >
                    {/* Bot Action Status Header */}
                    {msg.sender === 'bot' && msg.actionTakenBadge && (
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-zinc-100">
                        <span
                          className={`inline-flex items-center gap-1 font-bold text-[11px] ${
                            msg.statusType === 'RESOLVED' ||
                            (msg.statusType === 'ESCALATED_HITL' &&
                              latestTicketForSelected?.status === 'COMPLETED')
                              ? 'text-emerald-700'
                              : msg.statusType === 'ESCALATED_HITL' &&
                                latestTicketForSelected?.status === 'REJECTED_BY_OPS'
                              ? 'text-red-700'
                              : msg.statusType === 'ESCALATED_HITL'
                              ? 'text-amber-700'
                              : msg.statusType === 'BLOCKED'
                              ? 'text-red-700'
                              : 'text-sky-700'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {msg.statusType === 'ESCALATED_HITL' &&
                            latestTicketForSelected?.status === 'COMPLETED'
                              ? `L2 Specialist Approved · Ref ${latestTicketForSelected.settlement_utr}`
                              : msg.statusType === 'ESCALATED_HITL' &&
                                latestTicketForSelected?.status === 'REJECTED_BY_OPS'
                              ? 'Rejected & Frozen by L2 Specialist'
                              : msg.actionTakenBadge}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => onSpeakIndicVoice(msg.text, msg.lang)}
                          className="px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[10px] flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <Volume2 className="w-3 h-3" />
                          <span>{isSpeaking ? 'Speaking...' : 'Play Indic Voice'}</span>
                        </button>
                      </div>
                    )}

                    {/* Main Message Text (in the user's selected language) */}
                    <p className="leading-relaxed text-[13px] font-medium">{msg.text}</p>

                    {/* Why It Happened & Settlement UTR Receipt Card */}
                    {msg.sender === 'bot' && msg.whyItHappened && (
                      <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-2.5 space-y-2 text-[11px] text-zinc-700">
                        <div className="leading-relaxed">{msg.whyItHappened}</div>

                        {msg.settlementUtr && (
                          <div className="pt-1.5 border-t border-zinc-200 flex items-center justify-between font-mono text-emerald-700 font-bold">
                            <span>Ref UTR: {msg.settlementUtr}</span>
                            <span>Settled in {msg.executionDurationSec || '3.6s'}</span>
                          </div>
                        )}

                        {msg.statusType === 'ESCALATED_HITL' && msg.ticketRef && (
                          <div className="pt-1.5 border-t border-amber-200 flex items-center justify-between gap-2">
                            {latestTicketForSelected?.status === 'COMPLETED' ? (
                              <span className="text-[10px] text-emerald-700 font-bold font-mono">
                                ✅ Approved in Backend Mode · UTR: {latestTicketForSelected.settlement_utr}
                              </span>
                            ) : latestTicketForSelected?.status === 'REJECTED_BY_OPS' ? (
                              <span className="text-[10px] text-red-700 font-bold">
                                🛑 Rejected &amp; Frozen by L2 Specialist in Backend Mode
                              </span>
                            ) : (
                              <>
                                <span className="text-[10px] text-amber-800 font-medium">
                                  Paused for L2 Specialist Approval
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onOpenInBackendStudio(activeSelectedTxnId, msg.ticketRef)
                                  }
                                  className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                                >
                                  <span>Approve in Backend Mode</span>
                                  <ArrowUpRight className="w-3 h-3" />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Interactive Action Button to Return to Balance & History and see updated status */}
                    {msg.sender === 'bot' && (
                      <div className="pt-1 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setActiveSelectedTxnId(null)}
                          className="text-[11px] font-bold text-[#00baf2] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <ArrowLeft className="w-3 h-3" />
                          <span>View Updated Status in Balance &amp; History</span>
                        </button>
                        <span className="text-[10px] text-zinc-400">{msg.timestamp}</span>
                      </div>
                    )}

                    {msg.sender === 'user' && (
                      <div className="text-[10px] text-right text-white/80">{msg.timestamp}</div>
                    )}
                  </div>
                </div>
              ))}

              {/* If an L2 Specialist approved or rejected a HITL ticket in Backend Mode, show live decision card here */}
              {latestTicketForSelected &&
                (latestTicketForSelected.status === 'COMPLETED' ||
                  latestTicketForSelected.status === 'REJECTED_BY_OPS') &&
                (chatHistories[activeSelectedTxnId] || []).some(
                  (m) => m.statusType === 'ESCALATED_HITL'
                ) && (
                  <div
                    className={`rounded-2xl p-3.5 text-xs space-y-2 shadow-2xs border ${
                      latestTicketForSelected.status === 'COMPLETED'
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between gap-2">
                      <span
                        className={`flex items-center gap-1 ${
                          latestTicketForSelected.status === 'COMPLETED'
                            ? 'text-emerald-900'
                            : 'text-red-900'
                        }`}
                      >
                        <ShieldCheck
                          className={`w-4 h-4 ${
                            latestTicketForSelected.status === 'COMPLETED'
                              ? 'text-emerald-600'
                              : 'text-red-600'
                          }`}
                        />
                        {latestTicketForSelected.status === 'COMPLETED'
                          ? 'L2 Specialist Approved Refund!'
                          : 'L2 Specialist Rejected & Froze Dispute'}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onSpeakIndicVoice(
                            voiceLang === 'en-IN'
                              ? latestTicketForSelected.voice_script_english
                              : latestTicketForSelected.voice_script_indic,
                            voiceLang
                          )
                        }
                        className="px-2 py-0.5 rounded-md bg-white/90 hover:bg-white text-indigo-700 font-semibold text-[10px] flex items-center gap-1 shrink-0 cursor-pointer border border-indigo-200"
                      >
                        <Volume2 className="w-3 h-3" />
                        <span>{isSpeaking ? 'Speaking...' : 'Play Indic Voice'}</span>
                      </button>
                    </div>
                    {latestTicketForSelected.settlement_utr && (
                      <div className="font-mono text-[11px] font-bold text-emerald-800">
                        Settlement UTR: {latestTicketForSelected.settlement_utr}
                      </div>
                    )}
                    <p
                      className={`leading-relaxed ${
                        latestTicketForSelected.status === 'COMPLETED'
                          ? 'text-emerald-950'
                          : 'text-red-950'
                      }`}
                    >
                      {voiceLang === 'en-IN'
                        ? latestTicketForSelected.voice_script_english
                        : latestTicketForSelected.voice_script_indic}
                    </p>
                  </div>
                )}

              {/* LIVE STEP-BY-STEP RESOLVEOPS TASK EXECUTION TRACKER (Takes ~3.6s before delivering response) */}
              {isBotThinking && (
                <div className="bg-white border-2 border-[#00baf2] rounded-2xl p-3.5 text-xs space-y-2.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-[#002970]">
                      <RefreshCw className="w-4 h-4 text-[#00baf2] animate-spin shrink-0" />
                      <span>
                        {voiceLang === 'hi-IN'
                          ? 'Paytm ResolveOps आपकी समस्या हल कर रहा है...'
                          : voiceLang === 'ta-IN'
                          ? 'Paytm ResolveOps உங்கள் பிரச்சனையை தீர்க்கிறது...'
                          : 'Paytm ResolveOps is executing your request...'}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-[#00baf2]">
                      Step {executionStageIndex + 1}/5
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#00baf2] transition-all duration-500 rounded-full"
                      style={{ width: `${((executionStageIndex + 1) / 5) * 100}%` }}
                    />
                  </div>

                  {/* Step-by-Step Checklist */}
                  <div className="space-y-1.5 pt-0.5">
                    {currentStages.map((stageLabel, idx) => {
                      const isDone = idx < executionStageIndex;
                      const isCurrent = idx === executionStageIndex;
                      return (
                        <div
                          key={idx}
                          className={`flex items-center gap-2 text-[11px] transition-opacity ${
                            isDone
                              ? 'text-emerald-700 font-medium'
                              : isCurrent
                              ? 'text-zinc-900 font-semibold'
                              : 'text-zinc-400 opacity-60'
                          }`}
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : isCurrent ? (
                            <RefreshCw className="w-3.5 h-3.5 text-[#00baf2] animate-spin shrink-0" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
                          )}
                          <span className="truncate">{stageLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>

            {/* Bottom Voice & Text Input Bar inside User Chat */}
            <div className="p-3 bg-white border-t border-zinc-200 space-y-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleUserVoiceMic}
                  disabled={isBotThinking}
                  title="Speak your problem in Hindi, Hinglish, Tamil, or English"
                  className={`p-2.5 rounded-full transition-all shrink-0 cursor-pointer ${
                    isRecordingVoice
                      ? 'bg-red-600 text-white animate-pulse'
                      : 'bg-sky-50 hover:bg-sky-100 text-[#002970] border border-sky-200'
                  }`}
                >
                  {isRecordingVoice ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendUserProblem();
                  }}
                  placeholder={
                    isRecordingVoice
                      ? `Listening (${recSeconds}s)... Tap mic to send`
                      : voiceLang === 'hi-IN'
                      ? 'अपनी समस्या लिखें या माइक दबाकर बोलें...'
                      : voiceLang === 'ta-IN'
                      ? 'உங்கள் பிரச்சனையை தட்டச்சு செய்யவும் அல்லது பேசவும்...'
                      : 'Ask why payment stuck or request refund...'
                  }
                  className="flex-1 px-3.5 py-2 text-xs bg-zinc-100 border border-zinc-200 rounded-full focus:bg-white focus:border-[#00baf2] focus:outline-none"
                />

                <button
                  type="button"
                  onClick={() => handleSendUserProblem()}
                  disabled={isBotThinking || !chatInput.trim()}
                  className="p-2.5 rounded-full bg-[#00baf2] hover:bg-[#009fd0] disabled:opacity-40 text-white transition-colors shrink-0 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
