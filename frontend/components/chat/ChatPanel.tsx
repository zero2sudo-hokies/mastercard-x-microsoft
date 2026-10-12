"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Badge, ErrorBox, TopicIcon } from "@/components/ui";
import { postChat } from "@/lib/api";
import { fmtInt, fmtScore } from "@/lib/format";
import { BENEFIT_TITLE } from "@/lib/topics";
import type { ChatContext, ChatMessage, ChatResponse, Recommendation } from "@/lib/types";

type Turn = { role: "user"; content: string } | { role: "assistant"; content: string; response: ChatResponse };

const STARTERS = [
  "Where should we pilot a no-fee account?",
  "Best counties in this state for fraud protection",
  "Which areas have the most frustrated customers?",
  "Show look-alikes for the selected county",
];

export default function ChatPanel({ context, onFocus, onSelect }: { context: ChatContext; onFocus: (fips: string[]) => void; onSelect: (fips: string) => void }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<{ message: string; retry: string } | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [turns.length, sending]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || sending) return;
    const history: ChatMessage[] = [...turns.map((t) => ({ role: t.role, content: t.content })), { role: "user", content: question }];
    setTurns((t) => [...t, { role: "user", content: question }]);
    setInput("");
    setError(null);
    setSending(true);
    try {
      const response = await postChat({ messages: history, context });
      setTurns((t) => [...t, { role: "assistant", content: response.reply, response }]);
      if (response.focus_fips.length) onFocus(response.focus_fips);
    } catch (e) {
      setTurns((t) => t.slice(0, -1)); // drop the unanswered question so a retry doesn't duplicate it
      setError({ message: (e as Error).message, retry: question });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-[420px] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {turns.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted">Ask where to pilot, which frustration to fix, or how an area compares. Answers cite Navigator data.</p>
            <div className="flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border border-line bg-white px-3 py-1 text-left text-xs text-navy hover:border-accent hover:bg-accent/5">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="ml-8 rounded-xl rounded-br-sm bg-navy px-3 py-2 text-sm text-white">
              {t.content}
            </div>
          ) : (
            <AssistantTurn key={i} r={t.response} onFocus={onFocus} onSelect={onSelect} />
          ),
        )}

        {sending && (
          <div className="flex items-center gap-2 text-xs text-muted" role="status">
            <span className="flex gap-1">
              {[0, 1, 2].map((d) => (
                <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${d * 120}ms` }} />
              ))}
            </span>
            Checking the data...
          </div>
        )}
        {error && <ErrorBox message={error.message} onRetry={() => send(error.retry)} />}
        <div ref={end} />
      </div>

      <form
        className="mt-3 flex gap-2 border-t border-line pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <label htmlFor="chat-input" className="sr-only">
          Ask the agent
        </label>
        <input
          id="chat-input"
          value={input}
          maxLength={2000}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
          placeholder="Where should we pilot a no-fee account?"
          className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm text-navy outline-none focus:border-navy disabled:opacity-60"
        />
        <button type="submit" disabled={sending || !input.trim()} className="rounded-lg bg-navy px-3 py-2 text-sm font-medium text-white hover:bg-navy-soft disabled:opacity-50">
          Ask
        </button>
      </form>
    </div>
  );
}

function AssistantTurn({ r, onFocus, onSelect }: { r: ChatResponse; onFocus: (fips: string[]) => void; onSelect: (fips: string) => void }) {
  return (
    <div className="mr-4 space-y-2 rounded-xl rounded-bl-sm border border-line bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={r.mode === "foundry" ? "accent" : "neutral"}>{r.mode === "foundry" ? "Azure AI Foundry · gpt-5-mini" : "Rules fallback"}</Badge>
        <span className="text-[11px] text-muted">AI-generated, review before use</span>
      </div>
      <div className="md text-sm text-navy">
        <ReactMarkdown>{r.reply}</ReactMarkdown>
      </div>
      {r.warnings.length > 0 && (
        <ul className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
          {r.warnings.map((w) => (
            <li key={w}>⚠ {w}</li>
          ))}
        </ul>
      )}
      {r.recommendations.length > 0 && (
        <div className="space-y-1.5">
          {r.recommendations.map((rec) => (
            <RecCard key={rec.fips} rec={rec} onSelect={onSelect} />
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {r.focus_fips.length > 0 && (
          <button onClick={() => onFocus(r.focus_fips)} className="font-medium text-navy underline underline-offset-2">
            Show on map
          </button>
        )}
        {r.tool_calls.length > 0 && (
          <details className="text-muted">
            <summary className="cursor-pointer">How I got this ({r.tool_calls.length} data lookups)</summary>
            <ul className="mt-1 space-y-0.5 font-mono text-[11px]">
              {r.tool_calls.map((c, i) => (
                <li key={i}>
                  {c.name}({Object.entries(c.args).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ")})
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}

function RecCard({ rec, onSelect }: { rec: Recommendation; onSelect: (fips: string) => void }) {
  return (
    <button onClick={() => onSelect(rec.fips)} className="w-full rounded-lg border border-line p-2 text-left text-xs hover:border-accent hover:bg-accent/5">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy text-[10px] font-semibold text-white">{rec.rank}</span>
        <span className="font-semibold text-navy">
          {rec.name}, {rec.state_abbr}
        </span>
        {rec.clear_lead && <Badge tone="good">Clear lead</Badge>}
        <span className="ml-auto font-semibold tabular-nums text-navy">{fmtScore(rec.priority_score)}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-muted">
        <span>Exclusion {fmtScore(rec.exclusion_index)}</span>
        <span>Frustration {fmtScore(rec.frustration_score)}</span>
        <span>{fmtInt(rec.est_underserved_hh)} underserved households (modeled)</span>
      </div>
      {rec.benefit_id && (
        <div className="mt-1 flex items-center gap-1 text-navy">
          {rec.top_topic && <TopicIcon topic={rec.top_topic} size={12} className="text-accent" />}
          {BENEFIT_TITLE[rec.benefit_id] ?? rec.benefit_id}
        </div>
      )}
      {rec.reasons[0] && <div className="mt-0.5 text-muted">{rec.reasons[0]}</div>}
    </button>
  );
}
