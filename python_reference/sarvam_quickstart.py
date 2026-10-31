"""
Paytm ResolveOps — Sarvam AI Minimal Quickstart Script
Track 3: Autonomous AI Teammates (Paytm Build for India AI Hackathon)

Setup:
  1. pip install sarvamai python-dotenv
  2. Paste your SARVAM_API_KEY into .env (SARVAM_API_KEY=your_key_here)
  3. python python_reference/sarvam_quickstart.py
"""

import os
import sys
from dotenv import load_dotenv

load_dotenv()

SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "").strip()
if not SARVAM_API_KEY:
    print("ERROR: SARVAM_API_KEY is missing in .env. Please paste your key into .env first.", file=sys.stderr)
    sys.exit(1)

from sarvamai import SarvamAI

client = SarvamAI(api_subscription_key=SARVAM_API_KEY)

response = client.chat.completions(
    model="sarvam-105b-conversations",
    messages=[
        {
            "role": "system",
            "content": (
                "You are Paytm ResolveOps, an autonomous Indic FinTech operations teammate. "
                "Respond in reassuring Hinglish to a kirana store merchant whose ₹1,450 UPI QR payment "
                "timed out with NPCI code U69 and has now been auto-refunded."
            ),
        },
        {
            "role": "user",
            "content": "Bhaiya ₹1,450 ka HDFC payment अटका था, UTR 430418921045 का क्या हुआ?",
        },
    ],
    temperature=0.0,
)

print(response.choices[0].message.content)
