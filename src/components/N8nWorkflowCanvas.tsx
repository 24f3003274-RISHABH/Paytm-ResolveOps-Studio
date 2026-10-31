import React, { useState } from 'react';
import {
  Webhook,
  ShieldCheck,
  Server,
  Activity,
  Scale,
  GitBranch,
  Database,
  Coins,
  UserCheck,
  Volume2,
  Send,
  CheckCircle2,
  Loader2,
  PauseCircle,
  ShieldAlert,
  Play,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Sparkles,
  Info,
  Cpu,
} from 'lucide-react';

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

interface N8nWorkflowCanvasProps {
  trace: GraphNodeTrace[];
  policyDecision?:
    | 'AUTO_REVERSE'
    | 'AUTO_REVERSE_RBI_COMP'
    | 'CREDIT_RETRY'
    | 'INFO_ONLY'
    | 'HITL'
    | 'SECURITY_BLOCK';
  ticketStatus?: 'COMPLETED' | 'PAUSED_HITL' | 'REJECTED_BY_OPS' | 'BLOCKED_INJECTION';
  activeAnimStep: number; // 0 = idle, 1 = node1, 2 = parallel 2A/2B/2C, 3 = node3, 4 = node4A/4B/4C, 5 = node5 voice, 6 = node6 closure, 7 = done
  isAnimating: boolean;
  selectedCanvasNodeId: string;
  onSelectCanvasNode: (nodeId: string) => void;
  onReplayAnimation: () => void;
  onStepChange?: (step: number, nodeId: string) => void;
  onPlayFemaleVoice?: () => void;
}

interface CanvasNodeDef {
  id: string;
  title: string;
  subtitle: string;
  toolLabel: string;
  x: number;
  y: number;
  stepIndex: number;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  badgeText?: string;
}

const NODE_WIDTH = 186;
const NODE_HEIGHT = 82;

const CANVAS_NODES: CanvasNodeDef[] = [
  {
    id: 'TRIGGER_WEBHOOK',
    title: 'ReqComplaint Trigger',
    subtitle: 'Soundbox / ODR Ingest',
    toolLabel: 'POST /api/disputes/run',
    x: 18,
    y: 158,
    stepIndex: 1,
    icon: Webhook,
    accentColor: 'bg-zinc-900 text-white',
    badgeText: 'WEBHOOK',
  },
  {
    id: 'NODE_1_INGEST_PII',
    title: 'Node 1: PII & GenAI NLU',
    subtitle: 'Masks PAN/Card + Intent',
    toolLabel: 'ingest_and_mask_pii()',
    x: 232,
    y: 158,
    stepIndex: 1,
    icon: ShieldCheck,
    accentColor: 'bg-indigo-600 text-white',
    badgeText: 'GENAI + REGEX',
  },
  {
    id: 'NODE_2A_SWITCH_MCP',
    title: 'MCP A: NPCI Switch',
    subtitle: 'UDIR ReqChkTxn Status',
    toolLabel: 'req_chk_txn(utr)',
    x: 458,
    y: 26,
    stepIndex: 2,
    icon: Server,
    accentColor: 'bg-violet-600 text-white',
    badgeText: 'PARALLEL A',
  },
  {
    id: 'NODE_2B_FRAUD_MCP',
    title: 'MCP B: Fraud Desk',
    subtitle: '10m Velocity & Device',
    toolLabel: 'check_account_risk()',
    x: 458,
    y: 158,
    stepIndex: 2,
    icon: Activity,
    accentColor: 'bg-violet-600 text-white',
    badgeText: 'PARALLEL B',
  },
  {
    id: 'NODE_2C_RECON_TAT_MCP',
    title: 'MCP E: 3-Way & RBI TAT',
    subtitle: 'CBS↔NPCI↔Acquirer + T+5',
    toolLabel: 'verify_3way_recon_tat()',
    x: 458,
    y: 290,
    stepIndex: 2,
    icon: Scale,
    accentColor: 'bg-violet-600 text-white',
    badgeText: 'PARALLEL C',
  },
  {
    id: 'NODE_3_POLICY_ROUTER',
    title: 'Node 3: Policy Router',
    subtitle: 'Deterministic UDIR/RBI',
    toolLabel: 'decide(s: DisputeState)',
    x: 690,
    y: 158,
    stepIndex: 3,
    icon: GitBranch,
    accentColor: 'bg-zinc-900 text-white',
    badgeText: 'DETERMINISTIC',
  },
  {
    id: 'NODE_4A_AUTO_EXEC',
    title: 'Node 4A: URCS Ledger C',
    subtitle: 'Auto-Reverse / Credit Adj',
    toolLabel: 'execute_settlement_rev()',
    x: 922,
    y: 26,
    stepIndex: 4,
    icon: Database,
    accentColor: 'bg-emerald-600 text-white',
    badgeText: 'SAFE ≤ ₹25K',
  },
  {
    id: 'NODE_4B_RBI_COMP_EXEC',
    title: 'Node 4B: RBI Penalty F',
    subtitle: 'Refund + ₹100/d TAT Comp',
    toolLabel: 'credit_rbi_tat_comp()',
    x: 922,
    y: 158,
    stepIndex: 4,
    icon: Coins,
    accentColor: 'bg-teal-600 text-white',
    badgeText: '> T+5 BREACH',
  },
  {
    id: 'NODE_4C_HITL_OPS',
    title: 'Node 4C: HITL Bridge D',
    subtitle: 'LangGraph interrupt()',
    toolLabel: 'dispatch_hitl_ticket()',
    x: 922,
    y: 290,
    stepIndex: 4,
    icon: UserCheck,
    accentColor: 'bg-amber-600 text-white',
    badgeText: 'INTERRUPT',
  },
  {
    id: 'NODE_5_INDIC_VOICE',
    title: 'Node 5: Sarvam Voice AI',
    subtitle: 'GenAI Script + Indic TTS',
    toolLabel: 'synthesize_indic_voice()',
    x: 1152,
    y: 92,
    stepIndex: 5,
    icon: Volume2,
    accentColor: 'bg-indigo-600 text-white',
    badgeText: 'INDIC TTS',
  },
  {
    id: 'NODE_6_UDIR_CLOSURE',
    title: 'Node 6: NPCI ODR Close',
    subtitle: 'ReqTxnConfirmation Bus',
    toolLabel: 'broadcast_udir_update()',
    x: 1152,
    y: 224,
    stepIndex: 6,
    icon: Send,
    accentColor: 'bg-zinc-900 text-white',
    badgeText: 'UDIR BUS',
  },
];

// Detailed architectural & operational explanations for every node in the workflow
const NODE_ARCHITECTURE_GUIDE: Record<
  string,
  {
    stageTitle: string;
    whatItDoes: string;
    howItWorks: string;
  }
> = {
  TRIGGER_WEBHOOK: {
    stageTitle: 'Entry Trigger · Paytm App / Soundbox / NPCI ODR Webhook',
    whatItDoes:
      'Receives live dispute requests when a customer taps a transaction in Paytm Balance & History or speaks into a Paytm Soundbox.',
    howItWorks:
      'Captures the transaction ID (TXN-ID), 12-digit NPCI RRN/UTR, voice/text complaint payload, and regional language preference (Hindi, English, or Tamil).',
  },
  NODE_1_INGEST_PII: {
    stageTitle: 'Stage 1 of 6 · Node 1: Ingestion, PII Guardrail & NLU Intent',
    whatItDoes:
      'Sanitizes sensitive banking PII before any downstream processing, blocks adversarial prompt injection, and classifies the user’s exact issue.',
    howItWorks:
      'Applies regex + security guardrails to mask PAN, Aadhaar, and 16-digit card numbers, extracts the 12-digit UTR, and uses GenAI NLU to understand the customer/merchant problem.',
  },
  NODE_2A_SWITCH_MCP: {
    stageTitle: 'Stage 2 of 6 (Parallel Branch A) · MCP Server A: NPCI UDIR Switch Service',
    whatItDoes:
      'Polls the NPCI Unified Dispute & Issue Resolution (UDIR) switch in real time to verify the authoritative network status of the UPI payment.',
    howItWorks:
      'Calls tool `req_chk_txn(txn_id, utr)` to inspect the NPCI return code (`U69` timeout, `00_SUCCESS`, `DEEMED_UP`, `RB-01`, `U16`, or `PENDING`) and gateway hop trace.',
  },
  NODE_2B_FRAUD_MCP: {
    stageTitle: 'Stage 2 of 6 (Parallel Branch B) · MCP Server B: Fraud & Velocity Desk',
    whatItDoes:
      'Evaluates user account risk and velocity patterns in parallel so high-risk or collusive refund claims never get auto-approved.',
    howItWorks:
      'Calls tool `check_account_risk(user_id)` to analyze 10-minute transaction burst velocity, 30-day repeat dispute count, and device fingerprint anomalies to output a [0.00 – 1.00] risk score.',
  },
  NODE_2C_RECON_TAT_MCP: {
    stageTitle: 'Stage 2 of 6 (Parallel Branch C) · MCP Server E: 3-Way Recon & RBI TAT Engine',
    whatItDoes:
      'Cross-verifies Issuer Bank CBS debit, NPCI Switch clearing, and Paytm Acquirer sub-ledger credit, while checking RBI Turnaround Time (TAT) compliance.',
    howItWorks:
      'Calls tool `verify_3way_recon_and_rbi_tat(txn_id)` to pinpoint where funds are stuck and checks if the dispute exceeds the RBI T+5 day SLA (which mandates ₹100/day suo-motu customer compensation).',
  },
  NODE_3_POLICY_ROUTER: {
    stageTitle: 'Stage 3 of 6 · Node 3: Deterministic UDIR & RBI Policy Router',
    whatItDoes:
      'Joins telemetry from all 3 parallel MCP servers (A, B, and E) and executes a 100% deterministic policy check to select the safe resolution branch.',
    howItWorks:
      'Enforces hard financial rules: Prompt Injection → Security Block (4C); Amount > ₹25,000 or Risk ≥ 0.50 or U16 → L2 Human Escalation (4C); U69 > T+5 days → Refund + ₹100/day RBI Comp (4B); Safe U69 / Uncredited Success → Auto-Settle (4A).',
  },
  NODE_4A_AUTO_EXEC: {
    stageTitle: 'Stage 4 of 6 (Branch 4A) · Node 4A: URCS Ledger Auto-Reversal / Credit Retry',
    whatItDoes:
      'Autonomously executes bank reversals or merchant credit adjustments for verified, low-risk disputes (≤ ₹25,000) in under 2 seconds.',
    howItWorks:
      'Calls MCP Server C `execute_settlement_reversal()` with an atomic SQLite idempotency key lock (`IDEMP-TXN-UTR`) so duplicate clicks can never double-refund, issuing an official Settlement UTR.',
  },
  NODE_4B_RBI_COMP_EXEC: {
    stageTitle: 'Stage 4 of 6 (Branch 4B) · Node 4B: RBI T+5 Suo-Motu ₹100/Day Penalty & Refund',
    whatItDoes:
      'Automatically credits both the stuck principal amount and the mandatory RBI ₹100/day delay penalty when a failed UPI debit breaches T+5 days.',
    howItWorks:
      'Calls MCP Server F `credit_rbi_tat_compensation()` to credit principal + ₹200 compensation (2 breach days × ₹100/day) and generates dual settlement & compensation UTRs.',
  },
  NODE_4C_HITL_OPS: {
    stageTitle: 'Stage 4 of 6 (Branch 4C) · Node 4C: Human-in-the-Loop (HITL) Specialist Interrupt',
    whatItDoes:
      'Halts autonomous ledger mutation for high-value (> ₹25,000), high-velocity risk (≥ 0.50), or adversarial transactions and hands off to an L2 human specialist.',
    howItWorks:
      'Executes a LangGraph `interrupt()` checkpoint via MCP Server D, packaging a pre-audited 3-Way Reconciliation dossier so the L2 officer can Approve or Reject in 1 click.',
  },
  NODE_5_INDIC_VOICE: {
    stageTitle: 'Stage 5 of 6 · Node 5: Sarvam AI Bulbul Indic Voice & Script Synthesis',
    whatItDoes:
      'Generates a natural, reassuring spoken and written response in the user’s chosen Indian language (Hindi, Tamil, or English).',
    howItWorks:
      'Combines the root-cause diagnosis ("why it happened") and the new Settlement UTR into a localized script and synthesizes natural Indian female voice audio via Sarvam AI Bulbul TTS.',
  },
  NODE_6_UDIR_CLOSURE: {
    stageTitle: 'Stage 6 of 6 · Node 6: NPCI ReqTxnConfirmation & SHA-256 Audit Ledger',
    whatItDoes:
      'Broadcasts the final dispute closure status to the NPCI UDIR network bus and seals the execution record in an immutable cryptographic ledger.',
    howItWorks:
      'Dispatches `ReqTxnConfirmation (UDIR_AUTOUPDATE)` with the final UTR and appends a SHA-256 hash-chained audit block (`prev_hash + event -> curr_hash`) in SQLite.',
  },
};

function createBezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.abs(x2 - x1) * 0.48;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

export const N8nWorkflowCanvas: React.FC<N8nWorkflowCanvasProps> = ({
  trace,
  policyDecision,
  activeAnimStep,
  isAnimating,
  selectedCanvasNodeId,
  onSelectCanvasNode,
  onReplayAnimation,
  onStepChange,
  onPlayFemaleVoice,
}) => {
  const [zoom, setZoom] = useState<number>(0.78);

  const activeBranch4: '4A' | '4B' | '4C' =
    policyDecision === 'AUTO_REVERSE_RBI_COMP'
      ? '4B'
      : policyDecision === 'HITL' || policyDecision === 'SECURITY_BLOCK'
      ? '4C'
      : '4A';

  const branch4NodeId =
    activeBranch4 === '4B'
      ? 'NODE_4B_RBI_COMP_EXEC'
      : activeBranch4 === '4C'
      ? 'NODE_4C_HITL_OPS'
      : 'NODE_4A_AUTO_EXEC';

  const STAGE_STEPS = [
    { step: 1, label: 'Stage 1: Node 1 (PII & NLU)', nodeId: 'NODE_1_INGEST_PII' },
    { step: 2, label: 'Stage 2: Parallel MCP A, B & E', nodeId: 'NODE_2C_RECON_TAT_MCP' },
    { step: 3, label: 'Stage 3: Node 3 (Policy Router)', nodeId: 'NODE_3_POLICY_ROUTER' },
    { step: 4, label: `Stage 4: Branch ${activeBranch4} Execution`, nodeId: branch4NodeId },
    { step: 5, label: 'Stage 5: Node 5 (Indic Voice)', nodeId: 'NODE_5_INDIC_VOICE' },
    { step: 6, label: 'Stage 6: Node 6 (NPCI Closure)', nodeId: 'NODE_6_UDIR_CLOSURE' },
  ];

  const findTraceForNode = (nodeId: string): GraphNodeTrace | undefined => {
    if (nodeId === 'NODE_4A_AUTO_EXEC') {
      return trace.find(
        (t) => t.node_id === 'NODE_4A_AUTO_EXEC' || t.node_id === 'NODE_4A_INFO_ONLY'
      );
    }
    if (nodeId === 'NODE_4B_RBI_COMP_EXEC') {
      return trace.find((t) => t.node_id === 'NODE_4B_RBI_COMP_EXEC');
    }
    if (nodeId === 'NODE_4C_HITL_OPS') {
      return trace.find(
        (t) => t.node_id === 'NODE_4C_HITL_OPS' || t.node_id === 'NODE_4C_SECURITY_BLOCK'
      );
    }
    return trace.find((t) => t.node_id === nodeId);
  };

  const isNode4Skipped = (nodeId: string): boolean => {
    if (nodeId === 'NODE_4A_AUTO_EXEC') return activeBranch4 !== '4A';
    if (nodeId === 'NODE_4B_RBI_COMP_EXEC') return activeBranch4 !== '4B';
    if (nodeId === 'NODE_4C_HITL_OPS') return activeBranch4 !== '4C';
    return false;
  };

  const getNodeVisualState = (
    node: CanvasNodeDef
  ): 'IDLE' | 'RUNNING' | 'COMPLETED' | 'PAUSED' | 'BLOCKED' | 'SKIPPED' => {
    if (trace.length === 0 && !isAnimating) return 'IDLE';

    if (isAnimating || (activeAnimStep >= 1 && activeAnimStep <= 6)) {
      if (activeAnimStep < node.stepIndex) return 'IDLE';
      if (node.stepIndex === 4 && isNode4Skipped(node.id)) return 'SKIPPED';
      if (activeAnimStep === node.stepIndex && isAnimating) return 'RUNNING';
    } else {
      if (node.stepIndex === 4 && isNode4Skipped(node.id)) return 'SKIPPED';
    }

    if (node.id === 'TRIGGER_WEBHOOK') return 'COMPLETED';

    const matched = findTraceForNode(node.id);
    if (!matched) return 'IDLE';
    if (matched.status === 'PAUSED_INTERRUPT') return 'PAUSED';
    if (matched.status === 'BLOCKED') return 'BLOCKED';
    return 'COMPLETED';
  };

  const edges: Array<{
    id: string;
    from: string;
    to: string;
    label?: string;
    stepWhenActive: number;
    branch4?: 'ALL' | '4A' | '4B' | '4C';
  }> = [
    { id: 'e-trig-n1', from: 'TRIGGER_WEBHOOK', to: 'NODE_1_INGEST_PII', stepWhenActive: 1, branch4: 'ALL' },
    { id: 'e-n1-2a', from: 'NODE_1_INGEST_PII', to: 'NODE_2A_SWITCH_MCP', label: 'ReqChkTxn', stepWhenActive: 2, branch4: 'ALL' },
    { id: 'e-n1-2b', from: 'NODE_1_INGEST_PII', to: 'NODE_2B_FRAUD_MCP', label: 'velocity', stepWhenActive: 2, branch4: 'ALL' },
    { id: 'e-n1-2c', from: 'NODE_1_INGEST_PII', to: 'NODE_2C_RECON_TAT_MCP', label: '3-way+TAT', stepWhenActive: 2, branch4: 'ALL' },
    { id: 'e-2a-n3', from: 'NODE_2A_SWITCH_MCP', to: 'NODE_3_POLICY_ROUTER', stepWhenActive: 3, branch4: 'ALL' },
    { id: 'e-2b-n3', from: 'NODE_2B_FRAUD_MCP', to: 'NODE_3_POLICY_ROUTER', stepWhenActive: 3, branch4: 'ALL' },
    { id: 'e-2c-n3', from: 'NODE_2C_RECON_TAT_MCP', to: 'NODE_3_POLICY_ROUTER', stepWhenActive: 3, branch4: 'ALL' },
    { id: 'e-n3-4a', from: 'NODE_3_POLICY_ROUTER', to: 'NODE_4A_AUTO_EXEC', label: 'Safe ≤ ₹25k', stepWhenActive: 4, branch4: '4A' },
    { id: 'e-n3-4b', from: 'NODE_3_POLICY_ROUTER', to: 'NODE_4B_RBI_COMP_EXEC', label: '> T+5 TAT', stepWhenActive: 4, branch4: '4B' },
    { id: 'e-n3-4c', from: 'NODE_3_POLICY_ROUTER', to: 'NODE_4C_HITL_OPS', label: 'HITL / Block', stepWhenActive: 4, branch4: '4C' },
    { id: 'e-4a-n5', from: 'NODE_4A_AUTO_EXEC', to: 'NODE_5_INDIC_VOICE', stepWhenActive: 5, branch4: '4A' },
    { id: 'e-4b-n5', from: 'NODE_4B_RBI_COMP_EXEC', to: 'NODE_5_INDIC_VOICE', stepWhenActive: 5, branch4: '4B' },
    { id: 'e-4c-n5', from: 'NODE_4C_HITL_OPS', to: 'NODE_5_INDIC_VOICE', stepWhenActive: 5, branch4: '4C' },
    { id: 'e-n5-n6', from: 'NODE_5_INDIC_VOICE', to: 'NODE_6_UDIR_CLOSURE', stepWhenActive: 6, branch4: 'ALL' },
  ];

  const currentStageNum = activeAnimStep >= 1 && activeAnimStep <= 6 ? activeAnimStep : 6;

  // Determine which node explanation to show right now
  const activeExplainerNodeId = isAnimating
    ? STAGE_STEPS.find((s) => s.step === activeAnimStep)?.nodeId || selectedCanvasNodeId
    : selectedCanvasNodeId || 'NODE_1_INGEST_PII';

  const activeGuide =
    NODE_ARCHITECTURE_GUIDE[activeExplainerNodeId] || NODE_ARCHITECTURE_GUIDE.NODE_1_INGEST_PII;
  const activeNodeTrace = findTraceForNode(activeExplainerNodeId);

  // When Stage 2 is running (Parallel MCP A, B, E), also gather all 3 parallel traces so the user sees all 3 MCP servers working together
  const trace2A = findTraceForNode('NODE_2A_SWITCH_MCP');
  const trace2B = findTraceForNode('NODE_2B_FRAUD_MCP');
  const trace2C = findTraceForNode('NODE_2C_RECON_TAT_MCP');
  const isParallelStage2Selected =
    (isAnimating && activeAnimStep === 2) ||
    (!isAnimating &&
      (selectedCanvasNodeId === 'NODE_2A_SWITCH_MCP' ||
        selectedCanvasNodeId === 'NODE_2B_FRAUD_MCP' ||
        selectedCanvasNodeId === 'NODE_2C_RECON_TAT_MCP'));

  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
      {/* Studio Top Debugger Bar */}
      <div className="px-4 py-2.5 bg-zinc-950 text-white flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-emerald-400">
            <Sparkles className="w-3.5 h-3.5" />
            LIVE 10-NODE DAG
          </span>
          <span className="text-zinc-700">|</span>
          <span className="text-xs text-zinc-300 font-medium">
            {trace.length === 0 && !isAnimating
              ? 'Ready — Click "Execute Workflow" to watch step-by-step node execution & live explanation'
              : isAnimating
              ? `Executing Stage ${activeAnimStep} of 6 (~2.2s per stage)...`
              : `Completed ${trace.length} nodes · Route: Branch ${activeBranch4} (${policyDecision}) — Click any node below to inspect`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="hidden sm:flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 text-[11px] font-mono text-zinc-400">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.68, +(z - 0.1).toFixed(2)))}
              className="px-1.5 py-1 hover:text-white transition-colors cursor-pointer"
              title="Zoom Out Canvas"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(0.78)}
              className="px-2 py-0.5 hover:text-white transition-colors cursor-pointer"
              title="Reset Fit Zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.0, +(z + 0.1).toFixed(2)))}
              className="px-1.5 py-1 hover:text-white transition-colors cursor-pointer"
              title="Zoom In Canvas"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {trace.length > 0 && (
            <button
              type="button"
              onClick={onReplayAnimation}
              disabled={isAnimating}
              className="px-2.5 py-1 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-200 rounded-lg border border-zinc-700 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
            >
              <Play className="w-3 h-3 text-emerald-400" />
              {isAnimating ? 'Executing...' : 'Replay Slow Step-by-Step'}
            </button>
          )}

          {trace.length > 0 && onPlayFemaleVoice && (
            <button
              type="button"
              onClick={onPlayFemaleVoice}
              className="px-3 py-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5" />
              Play Indic Voice
            </button>
          )}
        </div>
      </div>

      {/* Interactive Stage Scrubber Bar (Allows scrubbing through stages 1..6 or watching live progress) */}
      <div className="px-4 py-2 bg-zinc-900/95 border-b border-zinc-800 flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1">
          {STAGE_STEPS.map((st) => {
            const isStepActive =
              (isAnimating && activeAnimStep === st.step) ||
              (!isAnimating && selectedCanvasNodeId === st.nodeId);
            const isStepCompleted =
              trace.length > 0 && (!isAnimating || activeAnimStep > st.step);
            return (
              <button
                key={st.step}
                type="button"
                onClick={() => {
                  onSelectCanvasNode(st.nodeId);
                  if (onStepChange) onStepChange(st.step, st.nodeId);
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  isStepActive
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs ring-2 ring-indigo-400/40'
                    : isStepCompleted
                    ? 'bg-zinc-800/90 text-emerald-400 hover:bg-zinc-800'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {isAnimating && activeAnimStep === st.step && (
                  <Loader2 className="w-3 h-3 animate-spin text-white" />
                )}
                {!isAnimating && isStepCompleted && (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                )}
                <span>{st.label}</span>
              </button>
            );
          })}
        </div>

        {trace.length > 0 && onStepChange && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                const prev = Math.max(1, currentStageNum - 1);
                const found = STAGE_STEPS.find((s) => s.step === prev);
                if (found) {
                  onSelectCanvasNode(found.nodeId);
                  onStepChange(found.step, found.nodeId);
                }
              }}
              className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
              title="Previous Stage"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                const next = Math.min(6, currentStageNum + 1);
                const found = STAGE_STEPS.find((s) => s.step === next);
                if (found) {
                  onSelectCanvasNode(found.nodeId);
                  onStepChange(found.step, found.nodeId);
                }
              }}
              className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
              title="Next Stage"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ==================== LIVE NODE EXECUTION EXPLAINER BANNER ==================== */}
      <div
        className={`px-4 py-3 border-b transition-colors ${
          isAnimating
            ? 'bg-indigo-50/90 border-indigo-200'
            : 'bg-zinc-50/90 border-zinc-200'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
          <div className="space-y-1 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                  isAnimating
                    ? 'bg-indigo-600 text-white'
                    : 'bg-zinc-900 text-white'
                }`}
              >
                {isAnimating ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>LIVE EXECUTING STEP {activeAnimStep}/6</span>
                  </>
                ) : (
                  <>
                    <Info className="w-3 h-3 text-indigo-400" />
                    <span>NODE ARCHITECTURE EXPLAINER (CLICK ANY NODE)</span>
                  </>
                )}
              </span>
              <span className="text-xs font-bold text-zinc-900">
                {isAnimating && activeAnimStep === 2
                  ? 'Stage 2 of 6 · Parallel Execution: MCP Server A (NPCI Switch) + MCP Server B (Fraud Risk) + MCP Server E (3-Way Recon & RBI TAT)'
                  : activeGuide.stageTitle}
              </span>
            </div>

            <p className="text-xs text-zinc-700 leading-relaxed">
              <strong className="text-zinc-900">What this node does: </strong>
              {isAnimating && activeAnimStep === 2
                ? 'Fires 3 asynchronous MCP tool calls simultaneously to poll NPCI UDIR Switch status (MCP A), evaluate account velocity & device risk (MCP B), and run 3-Way Bank-Switch-Acquirer reconciliation + RBI T+5 SLA verification (MCP E).'
                : activeGuide.whatItDoes}
            </p>

            <p className="text-[11px] text-zinc-600 leading-relaxed">
              <strong className="text-zinc-800">How it works: </strong>
              {activeGuide.howItWorks}
            </p>
          </div>

          {/* Live Telemetry Output Box for the Currently Active / Selected Node */}
          <div className="lg:w-[390px] shrink-0 bg-white border border-zinc-200/90 rounded-lg p-2.5 text-[11px] space-y-1 shadow-2xs">
            <div className="flex items-center justify-between font-mono text-[10px] text-zinc-500">
              <span className="font-bold text-indigo-600 flex items-center gap-1">
                <Cpu className="w-3 h-3" />
                <span>LIVE NODE TELEMETRY</span>
              </span>
              {activeNodeTrace && (
                <span className="text-emerald-700 font-semibold">
                  {activeNodeTrace.latency_ms}ms · {activeNodeTrace.status}
                </span>
              )}
            </div>

            {isParallelStage2Selected && (trace2A || trace2B || trace2C) ? (
              <div className="space-y-1 font-mono text-[10px] text-zinc-800">
                {trace2A && (
                  <div className="truncate">
                    <strong className="text-violet-700">MCP-A:</strong> {trace2A.summary}
                  </div>
                )}
                {trace2B && (
                  <div className="truncate">
                    <strong className="text-violet-700">MCP-B:</strong> {trace2B.summary}
                  </div>
                )}
                {trace2C && (
                  <div className="truncate">
                    <strong className="text-violet-700">MCP-E:</strong> {trace2C.summary}
                  </div>
                )}
              </div>
            ) : activeNodeTrace ? (
              <div className="space-y-1">
                <div className="font-mono text-[10px] text-zinc-500 truncate">
                  Tool: <strong className="text-zinc-800">{activeNodeTrace.tool_called}</strong>
                </div>
                <div className="text-zinc-900 font-medium leading-snug">
                  {activeNodeTrace.summary}
                </div>
              </div>
            ) : (
              <div className="text-zinc-500 italic">
                Click &ldquo;Execute Workflow&rdquo; on the left to watch live telemetry stream through each node.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Dotted Vector Canvas */}
      <div
        className="relative w-full overflow-x-auto select-none"
        style={{
          backgroundImage: 'radial-gradient(#d4d4d8 1.25px, transparent 1.25px)',
          backgroundSize: '16px 16px',
          backgroundColor: '#fafafa',
        }}
      >
        <div
          style={{
            width: `${Math.round(1365 * zoom)}px`,
            height: `${Math.round(398 * zoom)}px`,
          }}
          className="relative transition-all duration-200"
        >
          <div
            style={{
              width: '1365px',
              height: '398px',
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            }}
            className="relative"
          >
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              <defs>
                <marker
                  id="arrow-active"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#4f46e5" />
                </marker>
                <marker
                  id="arrow-done"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
                </marker>
                <marker
                  id="arrow-muted"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#d4d4d8" />
                </marker>
              </defs>

              {edges.map((edge) => {
                const fromNode = CANVAS_NODES.find((n) => n.id === edge.from)!;
                const toNode = CANVAS_NODES.find((n) => n.id === edge.to)!;

                const x1 = fromNode.x + NODE_WIDTH;
                const y1 = fromNode.y + NODE_HEIGHT / 2;
                const x2 = toNode.x;
                const y2 = toNode.y + NODE_HEIGHT / 2;
                const d = createBezierPath(x1, y1, x2, y2);

                const isBranchSkipped =
                  edge.branch4 !== 'ALL' && edge.branch4 !== activeBranch4;

                const isCurrentlyFlowing =
                  isAnimating && activeAnimStep === edge.stepWhenActive && !isBranchSkipped;

                const isCompletedEdge =
                  !isBranchSkipped &&
                  trace.length > 0 &&
                  (!isAnimating || activeAnimStep > edge.stepWhenActive);

                const strokeColor = isCurrentlyFlowing
                  ? '#4f46e5'
                  : isCompletedEdge
                  ? '#10b981'
                  : '#d4d4d8';

                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;

                return (
                  <g key={edge.id}>
                    <path
                      d={d}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={isCurrentlyFlowing ? 3 : isCompletedEdge ? 2.25 : 1.75}
                      strokeDasharray={isBranchSkipped ? '4 4' : undefined}
                      markerEnd={
                        isCurrentlyFlowing
                          ? 'url(#arrow-active)'
                          : isCompletedEdge
                          ? 'url(#arrow-done)'
                          : 'url(#arrow-muted)'
                      }
                      opacity={isBranchSkipped ? 0.38 : 1}
                    />

                    {(isCurrentlyFlowing || (isCompletedEdge && !isAnimating)) && (
                      <circle
                        r={isCurrentlyFlowing ? '6' : '3.5'}
                        fill={isCurrentlyFlowing ? '#4f46e5' : '#10b981'}
                      >
                        <animateMotion
                          dur={isCurrentlyFlowing ? '0.9s' : '2.6s'}
                          repeatCount="indefinite"
                          path={d}
                        />
                      </circle>
                    )}

                    {edge.label && (
                      <g transform={`translate(${midX}, ${midY})`}>
                        <rect
                          x="-38"
                          y="-9"
                          width="76"
                          height="18"
                          rx="4"
                          fill="#ffffff"
                          stroke={isCompletedEdge ? '#a7f3d0' : '#e4e4e7'}
                          strokeWidth="1"
                        />
                        <text
                          textAnchor="middle"
                          dy="3"
                          className="text-[9.5px] font-mono fill-zinc-600 font-medium"
                        >
                          {edge.label}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>

            {CANVAS_NODES.map((node) => {
              const vState = getNodeVisualState(node);
              const matchedTrace = findTraceForNode(node.id);
              const Icon = node.icon;
              const isSelected = selectedCanvasNodeId === node.id;

              let borderClass = 'border-zinc-300 bg-white hover:border-zinc-400';
              if (vState === 'RUNNING') {
                borderClass = 'border-indigo-600 ring-4 ring-indigo-500/25 bg-indigo-50/30';
              } else if (vState === 'COMPLETED') {
                borderClass = 'border-emerald-500 bg-white hover:border-emerald-600';
              } else if (vState === 'PAUSED') {
                borderClass = 'border-amber-500 ring-4 ring-amber-500/15 bg-amber-50/50';
              } else if (vState === 'BLOCKED') {
                borderClass = 'border-red-500 ring-4 ring-red-500/15 bg-red-50/50';
              } else if (vState === 'SKIPPED') {
                borderClass = 'border-zinc-200 bg-zinc-50/70 opacity-40';
              }

              if (isSelected && vState !== 'SKIPPED') {
                borderClass += ' shadow-md ring-2 ring-zinc-950';
              }

              return (
                <div
                  key={node.id}
                  onClick={() => onSelectCanvasNode(node.id)}
                  style={{
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    width: `${NODE_WIDTH}px`,
                    height: `${NODE_HEIGHT}px`,
                  }}
                  className={`absolute rounded-xl border-2 p-2.5 cursor-pointer transition-all flex flex-col justify-between ${borderClass}`}
                >
                  {node.id !== 'TRIGGER_WEBHOOK' && (
                    <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-zinc-400" />
                  )}

                  {node.id !== 'NODE_6_UDIR_CLOSURE' && (
                    <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-zinc-400" />
                  )}

                  <div className="flex items-start justify-between gap-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${node.accentColor}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-zinc-900 truncate">
                          {node.title}
                        </div>
                        <div className="text-[10px] text-zinc-500 truncate">
                          {node.subtitle}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {vState === 'RUNNING' && (
                        <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                      )}
                      {vState === 'COMPLETED' && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                      {vState === 'PAUSED' && (
                        <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
                      )}
                      {vState === 'BLOCKED' && (
                        <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-1 pt-1 border-t border-zinc-100 text-[9.5px] font-mono tabular-nums">
                    <span className="text-zinc-500 truncate">{node.toolLabel}</span>
                    {vState === 'RUNNING' ? (
                      <span className="font-bold text-indigo-600 shrink-0">working...</span>
                    ) : matchedTrace && vState !== 'IDLE' && vState !== 'SKIPPED' ? (
                      <span className="font-semibold text-emerald-700 shrink-0">
                        {matchedTrace.latency_ms}ms
                      </span>
                    ) : vState === 'COMPLETED' ? (
                      <span className="font-semibold text-emerald-700 shrink-0">ok</span>
                    ) : (
                      <span className="text-zinc-400 shrink-0">
                        {vState === 'SKIPPED' ? 'skipped' : 'ready'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
