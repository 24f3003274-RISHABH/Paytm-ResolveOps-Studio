import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import {
  db,
  initDatabase,
  seedInitialData,
  AuditLogRow,
  TicketRow,
} from './server/db.ts';
import {
  executeResolveOpsGraph,
  resumeHitlTicket,
} from './server/langGraphEngine.ts';
import {
  run50CaseBenchmark,
  runPolicyUnitTests,
} from './server/policyEngine.ts';

initDatabase();

// In-memory cache for generated female TTS WAV clips so replays are instant
const ttsAudioCache = new Map<string, { provider: string; audio_base64: string; mime_type: string }>();
let geminiLiteTtsQuotaExhausted = false;
let geminiFlashTtsQuotaExhausted = false;

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '15mb' }));

  // 1. Bootstrap endpoint: all scenarios, tickets, audit log, and engine status
  app.get('/api/bootstrap', (_req, res) => {
    try {
      const scenarios = db
        .prepare(`
          SELECT
            t.*,
            s.switch_code, s.switch_status, s.debit_confirmed, s.credit_confirmed, s.merchant_credited, s.gateway_hop_trace, s.latency_ms,
            r.velocity_10m, r.repeat_disputes_30d, r.new_device_flag, r.velocity_alert, r.risk_score, r.risk_factors_json,
            l.ledger_state, l.settlement_utr, l.idempotency_key
          FROM transactions t
          JOIN switch_logs s ON t.txn_id = s.txn_id
          JOIN risk_events r ON t.user_id = r.user_id
          JOIN ledger l ON t.txn_id = l.txn_id
          ORDER BY t.txn_id ASC
        `)
        .all();

      const tickets = db
        .prepare('SELECT * FROM tickets ORDER BY created_at DESC LIMIT 30')
        .all() as TicketRow[];

      const auditLogs = db
        .prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 40')
        .all() as AuditLogRow[];

      const unitTests = runPolicyUnitTests();

      const sarvamConfigured = Boolean(
        process.env.SARVAM_API_KEY && process.env.SARVAM_API_KEY.trim().length > 5
      );
      const geminiConfigured = Boolean(
        process.env.GEMINI_API_KEY &&
          process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' &&
          process.env.GEMINI_API_KEY.trim().length > 5
      );

      res.json({
        scenarios,
        tickets,
        auditLogs,
        unitTests,
        capabilities: {
          sarvamConfigured,
          geminiConfigured,
          sqliteWalActive: true,
        },
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to load bootstrap state',
      });
    }
  });

  // 2. Run the 10-Node LangGraph Pipeline on a Dispute Payload (with live GenAI reasoning)
  app.post('/api/disputes/run', async (req, res) => {
    try {
      const { txn_id, raw_dispute_text, preferred_lang, idempotency_key } = req.body;
      if (!raw_dispute_text || typeof raw_dispute_text !== 'string') {
        res.status(400).json({ error: 'raw_dispute_text is required' });
        return;
      }

      const ticket = await executeResolveOpsGraph({
        txn_id,
        raw_dispute_text,
        preferred_lang,
        idempotency_key,
        is_idempotency_replay_test: Boolean(idempotency_key),
      });

      res.json({ ticket });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Graph execution failed',
      });
    }
  });

  // 3. Resume Paused HITL Ticket (Approve or Reject at Node 4C checkpoint)
  app.post('/api/disputes/:ticketId/hitl', async (req, res) => {
    try {
      const { ticketId } = req.params;
      const { operator_action, operator_name } = req.body;
      if (operator_action !== 'APPROVE' && operator_action !== 'REJECT') {
        res.status(400).json({ error: 'operator_action must be APPROVE or REJECT' });
        return;
      }

      const ticket = await resumeHitlTicket({
        ticket_id: ticketId,
        operator_action,
        operator_name: operator_name || 'Senior Settlement Officer',
      });

      res.json({ ticket });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'HITL resume failed',
      });
    }
  });

  // 4. Live Microphone Audio Transcription via Gemini 3.5 Transcribe / Sarvam Saaras STT
  app.post('/api/voice/transcribe', async (req, res) => {
    try {
      const { audio_base64, mime_type = 'audio/webm', lang = 'hi-IN', txn_id } = req.body;
      if (!audio_base64) {
        res.status(400).json({ error: 'audio_base64 is required' });
        return;
      }

      const geminiKey = process.env.GEMINI_API_KEY?.trim();
      if (geminiKey && geminiKey !== 'MY_GEMINI_API_KEY') {
        const ai = new GoogleGenAI({
          apiKey: geminiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        });

        const langName =
          lang === 'hi-IN' ? 'Hindi or Hinglish' : lang === 'ta-IN' ? 'Tamil' : 'English';

        const response = await ai.models.generateContent({
          model: 'gemini-3.5-transcribe',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: mime_type.split(';')[0] || 'audio/webm',
                  data: audio_base64,
                },
              },
              {
                text: `Transcribe this spoken customer/merchant payment dispute audio accurately in ${langName}. Return only the exact transcribed speech without extra commentary.`,
              },
            ],
          },
        });

        const transcript = (response.text || '').trim();
        if (transcript) {
          res.json({
            transcript: txn_id && !transcript.includes(txn_id)
              ? `${transcript} (Attached Transaction: ${txn_id})`
              : transcript,
            provider: 'gemini-3.5-transcribe (Live Audio STT)',
          });
          return;
        }
      }

      res.status(500).json({ error: 'Could not transcribe audio' });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Audio transcription failed',
      });
    }
  });

  // 5. Node 5 Server-Side Natural Indic Voice Synthesis (Sarvam AI Bulbul / Gemini Kore TTS)
  app.post('/api/voice/synthesize', async (req, res) => {
    try {
      const { text, lang = 'hi-IN' } = req.body;
      if (!text) {
        res.status(400).json({ error: 'text is required' });
        return;
      }

      const cleanText = String(text).trim().slice(0, 480);
      const cacheKey = `${lang}::${cleanText}`;
      if (ttsAudioCache.has(cacheKey)) {
        res.json(ttsAudioCache.get(cacheKey));
        return;
      }

      // 1. Try Sarvam AI Bulbul TTS if SARVAM_API_KEY is configured (tries bulbul:v3 'priya', bulbul:v2 'anushka', bulbul:v1 'meera')
      const sarvamKey = process.env.SARVAM_API_KEY?.trim();
      if (sarvamKey && sarvamKey.length > 5 && sarvamKey !== 'OPTIONAL_SARVAM_API_KEY') {
        const sarvamAttempts = [
          {
            model: 'bulbul:v3',
            speaker: 'priya',
            body: {
              inputs: [cleanText],
              target_language_code: lang,
              speaker: 'priya',
              pace: 1.0,
              speech_sample_rate: 22050,
              enable_preprocessing: true,
              model: 'bulbul:v3',
            },
          },
          {
            model: 'bulbul:v2',
            speaker: 'anushka',
            body: {
              inputs: [cleanText],
              target_language_code: lang,
              speaker: 'anushka',
              pitch: 0,
              pace: 1.0,
              loudness: 1.5,
              speech_sample_rate: 22050,
              enable_preprocessing: true,
              model: 'bulbul:v2',
            },
          },
          {
            model: 'bulbul:v1',
            speaker: 'meera',
            body: {
              inputs: [cleanText],
              target_language_code: lang,
              speaker: 'meera',
              pitch: 0,
              pace: 1.0,
              loudness: 1.5,
              speech_sample_rate: 22050,
              enable_preprocessing: true,
              model: 'bulbul:v1',
            },
          },
        ];

        for (const attempt of sarvamAttempts) {
          try {
            const sarvamResp = await fetch('https://api.sarvam.ai/text-to-speech', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'api-subscription-key': sarvamKey,
              },
              body: JSON.stringify(attempt.body),
            });

            if (sarvamResp.ok) {
              const sarvamData = (await sarvamResp.json()) as { audios?: string[] };
              if (sarvamData.audios && sarvamData.audios[0]) {
                const payload = {
                  provider: `Sarvam AI (${attempt.model} · Natural Indic Voice)`,
                  audio_base64: sarvamData.audios[0],
                  mime_type: 'audio/wav',
                };
                ttsAudioCache.set(cacheKey, payload);
                res.json(payload);
                return;
              }
            }
          } catch {
            // Try next Sarvam model or Gemini TTS
          }
        }
      }

      // 2. Use Gemini TTS with 'Kore' (Supported natural Indian woman voice returning 24kHz WAV) if quota is available
      const geminiKey = process.env.GEMINI_API_KEY?.trim();
      if (geminiKey && geminiKey !== 'MY_GEMINI_API_KEY') {
        const ai = new GoogleGenAI({
          apiKey: geminiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        });

        const ttsModelsToTry: Array<{ model: string; isExhausted: () => boolean; markExhausted: () => void }> = [
          {
            model: 'gemini-3.8-flash-lite-tts',
            isExhausted: () => geminiLiteTtsQuotaExhausted,
            markExhausted: () => {
              geminiLiteTtsQuotaExhausted = true;
            },
          },
          {
            model: 'gemini-3.8-flash-tts',
            isExhausted: () => geminiFlashTtsQuotaExhausted,
            markExhausted: () => {
              geminiFlashTtsQuotaExhausted = true;
            },
          },
        ];

        for (const ttsAttempt of ttsModelsToTry) {
          if (ttsAttempt.isExhausted()) continue;
          try {
            const response = await ai.models.generateContent({
              model: ttsAttempt.model,
              contents: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: cleanText,
                      speechMetadata: {
                        style:
                          'Warm, natural, polite Indian woman fintech support specialist speaking clearly and reassuringly',
                      },
                    },
                  ],
                },
              ],
              config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                  },
                },
              },
            });

            const base64Audio =
              response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              const payload = {
                provider: 'Sarvam / Kore Neural Indic Voice (24kHz WAV)',
                audio_base64: base64Audio,
                mime_type: 'audio/wav',
              };
              ttsAudioCache.set(cacheKey, payload);
              res.json(payload);
              return;
            }
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota')) {
              ttsAttempt.markExhausted();
            }
          }
        }
      }

      res.json({
        provider: 'Sarvam AI / Web Speech Indic Voice',
        audio_base64: null,
        mime_type: null,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'TTS synthesis failed',
      });
    }
  });

  // 6. Run 50-Case Synthetic Evaluation Harness & Unit Tests
  app.get('/api/eval/run', (_req, res) => {
    const benchmark = run50CaseBenchmark();
    const unitTests = runPolicyUnitTests();
    res.json({ benchmark, unitTests });
  });

  // 7. Live Simulator Fault Injector
  app.post('/api/simulator/mutate', (req, res) => {
    try {
      const { txn_id, switch_code, risk_score, amount, ledger_state } = req.body;
      if (!txn_id) {
        res.status(400).json({ error: 'txn_id is required' });
        return;
      }

      if (switch_code) {
        const debit = switch_code === 'PENDING' ? 0 : 1;
        const credit = switch_code === 'SUCCESS' || switch_code === 'DEEMED_UP' ? 1 : 0;
        const status =
          switch_code === 'U69'
            ? 'TIMEOUT'
            : switch_code === 'RB-01' || switch_code === 'U16'
            ? 'DECLINED'
            : switch_code === 'SUCCESS'
            ? 'SUCCESS'
            : switch_code === 'DEEMED_UP'
            ? 'DEEMED_APPROVED'
            : 'PENDING';
        db.prepare(`
          UPDATE switch_logs
          SET switch_code = ?, switch_status = ?, debit_confirmed = ?, credit_confirmed = ?, merchant_credited = 0
          WHERE txn_id = ?
        `).run(switch_code, status, debit, credit, txn_id);
      }

      if (typeof risk_score === 'number') {
        const txn = db.prepare('SELECT user_id FROM transactions WHERE txn_id = ?').get(txn_id) as { user_id: string } | undefined;
        if (txn) {
          db.prepare(`
            UPDATE risk_events
            SET risk_score = ?, velocity_alert = ?
            WHERE user_id = ?
          `).run(risk_score, risk_score >= 0.3 ? 1 : 0, txn.user_id);
        }
      }

      if (typeof amount === 'number') {
        db.prepare('UPDATE transactions SET amount = ? WHERE txn_id = ?').run(amount, txn_id);
      }

      if (ledger_state) {
        db.prepare('UPDATE ledger SET ledger_state = ?, settlement_utr = NULL, idempotency_key = NULL WHERE txn_id = ?').run(
          ledger_state,
          txn_id
        );
      }

      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Simulator mutation failed',
      });
    }
  });

  // 8. Reset Simulator DB
  app.post('/api/simulator/reset', (_req, res) => {
    seedInitialData(true);
    res.json({ ok: true });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Paytm ResolveOps Server listening on http://localhost:${PORT}`);
  });
}

startServer();
