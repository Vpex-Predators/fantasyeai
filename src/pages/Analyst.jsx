import React, { useCallback, useEffect, useRef, useState } from "react";
import { invokeAppFunction } from "@/api/appBackend";
import { base44 } from "@/api/base44Client";
import { isSupabaseBackend } from "@/lib/backendMode";
import {
  clearTradeAnalystMessages,
  loadTradeAnalystMessages,
  saveTradeAnalystMessages,
} from "@/lib/tradeAnalystSession";
import { Calculator, Loader2, RotateCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import MessageBubble from "@/components/analyst/MessageBubble";
import AppNavBar from "@/components/AppNavBar";

const FALLBACK_SUGGESTIONS = [
  "Which of my starters should I shop for a trade right now?",
  "Who on the waiver wire best fixes my weakest position?",
  "Which bench player should I start over my lowest-projected starter?",
];

export default function Analyst() {
  const supabasePath = isSupabaseBackend();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const bottomRef = useRef(null);

  const loadSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    try {
      const res = await invokeAppFunction("getAnalystSuggestions", {});
      setSuggestions(res.data?.questions?.length ? res.data.questions : FALLBACK_SUGGESTIONS);
    } catch {
      setSuggestions(FALLBACK_SUGGESTIONS);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  useEffect(() => {
    if (supabasePath) {
      setMessages(loadTradeAnalystMessages());
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const conversations = await base44.agents.listConversations({ agent_name: "trade_analyst" });
        if (!cancelled && Array.isArray(conversations) && conversations.length > 0) {
          setConversation(conversations[0]);
          setMessages(conversations[0].messages || []);
        }
      } catch {
        /* start a fresh conversation on first message */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabasePath]);

  useEffect(() => {
    if (supabasePath || !conversation) return undefined;
    const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
      setMessages(data.messages);
    });
    return unsubscribe;
  }, [conversation?.id, supabasePath]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendSupabase = async (content) => {
    const userMsg = { role: "user", content };
    const pending = [...messages, userMsg];
    setMessages(pending);
    setThinking(true);
    try {
      const res = await invokeAppFunction("tradeAnalystChat", { messages: pending });
      const assistant = {
        role: "assistant",
        content: res.data?.content || res.data?.message?.content || "No response from analyst.",
      };
      const full = [...pending, assistant];
      setMessages(full);
      saveTradeAnalystMessages(full);
    } catch (err) {
      const full = [
        ...pending,
        {
          role: "assistant",
          content: `Something went wrong: ${err.message || "unknown error"}`,
        },
      ];
      setMessages(full);
      saveTradeAnalystMessages(full);
    } finally {
      setThinking(false);
    }
  };

  const sendBase44 = async (content) => {
    let convo = conversation;
    if (!convo) {
      convo = await base44.agents.createConversation({
        agent_name: "trade_analyst",
        metadata: { name: "Trade & Roster Analysis" },
      });
      setConversation(convo);
    }
    await base44.agents.addMessage(convo, { role: "user", content });
    base44.analytics.track({
      eventName: "analyst_query_sent",
      properties: { length: content.length, content_length: content.length },
    });
  };

  const handleSend = async (text) => {
    const content = (text ?? input).trim();
    if (!content || thinking) return;
    setInput("");
    if (supabasePath) {
      await sendSupabase(content);
      return;
    }
    setThinking(true);
    try {
      await sendBase44(content);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Something went wrong sending that message: ${err.message || "unknown error"}`,
        },
      ]);
    } finally {
      setThinking(false);
    }
  };

  const handleNewChat = async () => {
    if (thinking) return;
    if (supabasePath) {
      clearTradeAnalystMessages();
      setMessages([]);
      loadSuggestions();
      return;
    }
    try {
      const convo = await base44.agents.createConversation({
        agent_name: "trade_analyst",
        metadata: { name: "Trade & Roster Analysis" },
      });
      setConversation(convo);
    } catch {
      /* next message will create a fresh conversation */
    }
    setMessages([]);
    loadSuggestions();
  };

  const waitingForReply =
    thinking ||
    (messages.length > 0 && messages[messages.length - 1].role === "user");

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500">
            <Calculator className="h-5 w-5 text-slate-900" />
          </div>
          <div>
            <h1 className="font-heading font-semibold leading-tight">Trade Analyst</h1>
            <p className="text-xs text-slate-500">Long-term value of trades, waivers, and roster calls</p>
          </div>
          <button
            onClick={handleNewChat}
            disabled={thinking}
            className="no-callout ml-auto flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
            New chat
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-24 pt-6">
        <div className="flex flex-1 flex-col gap-4">
          {messages.length === 0 && !waitingForReply && (
            <div className="space-y-4">
              <p className="text-center text-sm text-muted-foreground">
                Ask about a trade, waiver add, or bench decision — you'll get rest-of-season projections,
                value gaps, and a clear recommendation.
              </p>
              {loadingSuggestions ? (
                <p className="text-center text-sm text-muted-foreground">Tailoring suggestions to your team…</p>
              ) : (
                suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSend(s)}
                    className="no-callout min-h-[44px] w-full rounded-lg border border-border bg-card px-4 py-3 text-left text-sm text-foreground shadow-sm hover:border-ring"
                  >
                    {s}
                  </button>
                ))
              )}
            </div>
          )}
          {messages.map((m, i) => (
            <MessageBubble key={i} message={m} />
          ))}
          {waitingForReply && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Crunching the numbers…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="sticky bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] mt-6 flex gap-2 bg-background py-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. Trade my Pacheco for their Kupp?"
            className="min-h-[44px] flex-1 rounded-lg border border-input bg-card px-4 py-3 text-base text-foreground focus:border-ring focus:outline-none"
          />
          <Button
            type="submit"
            disabled={!input.trim() || thinking}
            className="h-11 min-h-[44px] w-11 px-0 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </main>
      <AppNavBar />
    </div>
  );
}