"use client";

import { Check, Loader2, Mail, MessageCircle, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

interface FollowUpDraftCardProps {
  leadId: string;
  organizationId?: string;
  onSent?: () => void;
}

type Channel = "whatsapp" | "email";
type DraftState = "idle" | "draft" | "done";

export function FollowUpDraftCard({ leadId, organizationId, onSent }: FollowUpDraftCardProps) {
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [loading, setLoading] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [editedDraft, setEditedDraft] = useState("");
  const [state, setState] = useState<DraftState>("idle");
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase?.auth.getSession() ?? { data: { session: null } };
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("Your session expired. Sign in again.");
      }

      const response = await fetch("/api/ai/followup", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ leadId, channel, organizationId }),
      });
      const data = (await response.json()) as { draftId?: string; draft?: string; error?: string };

      if (!response.ok || !data.draftId || !data.draft) {
        throw new Error(data.error ?? "Draft generation failed");
      }

      setDraftId(data.draftId);
      setEditedDraft(data.draft);
      setState("draft");
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Draft generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function submitFeedback(status: "approved" | "rejected" | "sent") {
    if (!draftId) {
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
    const token = data.session?.access_token;

    if (!token) {
      setError("Your session expired. Sign in again.");
      return;
    }

    const response = await fetch(`/api/ai/followup/${draftId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status, draftText: editedDraft }),
    });

    if (!response.ok) {
      setError("Could not update draft status");
      return;
    }

    setState("done");

    if (status !== "rejected") {
      onSent?.();
    }
  }

  if (state === "done") {
    return <div className="rounded-xl border border-[#e6eae5] p-3 text-sm text-[#6f7d77]">Follow-up handled.</div>;
  }

  return (
    <div className="space-y-3 rounded-xl border border-[#e6eae5] bg-white p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[#176b4d]" />
        <span className="text-sm font-semibold text-[#31423b]">AI Follow-Up Draft</span>
      </div>

      {state === "idle" ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            {(["whatsapp", "email"] as Channel[]).map((candidate) => (
              <button
                key={candidate}
                type="button"
                onClick={() => setChannel(candidate)}
                className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  channel === candidate ? "bg-[#176b4d] text-white" : "border border-[#dfe5df] bg-white text-[#65736e] hover:bg-[#f4f9f6]"
                }`}
              >
                {candidate === "whatsapp" ? <MessageCircle className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                {candidate.charAt(0).toUpperCase() + candidate.slice(1)}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#176b4d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#10523a] disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Generating..." : "Generate message"}
          </button>
        </div>
      ) : null}

      {state === "draft" ? (
        <div className="space-y-3">
          <textarea
            value={editedDraft}
            onChange={(event) => setEditedDraft(event.target.value)}
            rows={6}
            className="w-full rounded-md border border-[#dfe5df] bg-white p-3 text-sm text-[#32433c] focus:border-[#8ab5a4] focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => submitFeedback("sent")}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#176b4d] px-3 py-2 text-sm font-semibold text-white"
            >
              <Check className="h-4 w-4" /> Send
            </button>
            <button
              type="button"
              onClick={() => submitFeedback("rejected")}
              className="flex items-center justify-center gap-1 rounded-lg border border-[#dfe5df] px-3 py-2 text-sm font-semibold text-[#65736e]"
            >
              <X className="h-4 w-4" /> Discard
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
