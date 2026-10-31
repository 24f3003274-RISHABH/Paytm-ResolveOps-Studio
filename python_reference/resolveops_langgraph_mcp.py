"""
Paytm ResolveOps — Reference LangGraph + FastMCP + Deterministic Policy Engine (Python)
Team Spotpicx · Rishabh Keshari · Paytm Build for India AI Hackathon (Noida Finals)

Key Principle for Judges:
  "LLMs reason and explain; deterministic Python code decides financial state transitions."
"""

from dataclasses import dataclass
from typing import Literal
import re
import sqlite3
import hashlib


@dataclass
class DisputeState:
    txn_id: str
    utr: str
    user_id: str
    amount: float
    risk_score: float
    velocity_alert: bool
    switch_code: str          # "U69", "RB-01", "SUCCESS", "PENDING"
    debit_confirmed: bool
    credit_confirmed: bool
    merchant_credited: bool
    ledger_state: str         # "DEBITED_UNSETTLED", "REFUND_SETTLED", "ALREADY_CREDITED"
    prompt_injection_detected: bool = False


def decide(s: DisputeState) -> Literal["SECURITY_BLOCK", "HITL", "INFO_ONLY", "AUTO_REVERSE", "CREDIT_RETRY"]:
    """
    Deterministic Policy Engine (Node 3).
    Zero LLM involvement in financial routing or limit enforcement.
    """
    # Rule 0: Prompt Injection Guardrail
    if s.prompt_injection_detected:
        return "SECURITY_BLOCK"

    # Rule 1: Risk or value (> ₹25,000) always goes to humans (LangGraph interrupt)
    if s.risk_score >= 0.3 or s.amount > 25_000 or s.velocity_alert:
        return "HITL"

    # Rule 3: Nothing to mutate (Idempotent already settled or in T+0 pending window)
    if s.ledger_state in ("REFUND_SETTLED", "ALREADY_CREDITED", "MERCHANT_CREDIT_RETRIED"):
        return "INFO_ONLY"
    if s.switch_code == "PENDING":
        return "INFO_ONLY"

    # Rule 2A: Safe, legitimate NPCI timeout failure -> Autonomous reversal
    if s.switch_code in ("U69", "TIMEOUT") and s.debit_confirmed and not s.credit_confirmed:
        return "AUTO_REVERSE"

    # Rule 2B: Domain nuance -> Switch SUCCESS but merchant not credited triggers credit retry, NOT customer refund
    if s.switch_code == "SUCCESS" and not s.merchant_credited:
        return "CREDIT_RETRY"

    # Default-deny: unknown switch state means a human operator looks
    return "HITL"


# --- Unit Tests (Run with `pytest python_reference/resolveops_langgraph_mcp.py`) ---
def test_u69_safe_auto_reverse():
    s = DisputeState("TXN-1", "430418921045", "U1", 1450.0, 0.08, False, "U69", True, False, False, "DEBITED_UNSETTLED")
    assert decide(s) == "AUTO_REVERSE"


def test_high_value_48k_escalates_to_hitl():
    s = DisputeState("TXN-2", "430499201884", "U2", 48000.0, 0.19, False, "U69", True, False, False, "DEBITED_UNSETTLED")
    assert decide(s) == "HITL"


def test_velocity_fraud_escalates_to_hitl():
    s = DisputeState("TXN-3", "430477129003", "U3", 9500.0, 0.84, True, "RB-01", True, False, False, "DEBITED_UNSETTLED")
    assert decide(s) == "HITL"


def test_switch_success_uncredited_merchant_retries_credit():
    s = DisputeState("TXN-4", "430455612390", "U4", 680.0, 0.04, False, "SUCCESS", True, True, False, "DEBITED_UNSETTLED")
    assert decide(s) == "CREDIT_RETRY"


def test_prompt_injection_blocked():
    s = DisputeState("TXN-5", "430466109982", "U5", 90000.0, 0.96, True, "PENDING", False, False, False, "DEBITED_UNSETTLED", True)
    assert decide(s) == "SECURITY_BLOCK"
