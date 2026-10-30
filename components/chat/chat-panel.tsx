"use client";

import { useRouter } from "next/navigation";
import { Send, SquarePen } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ChatMessage } from "@/lib/ai/messages";
import { cn } from "@/lib/utils";

// A request without a valid session is redirected to the sign-in page by the proxy.
// fetch would follow that redirect and get HTML, so requests do not follow redirects; a
// redirect means the session is gone, and router.refresh() lets the server-side check
// of the page send the user to sign in (same as the notes screen, lib/auth/session-loss.ts).
const NO_FOLLOW: RequestInit = { redirect: "manual" };
const sessionEnded = (response: Response) => response.type === "opaqueredirect";
const SESSION_NOTICE = "Your session has ended. Signing you in again…";

// Same limits as the server (lib/ai/messages.ts); the server stays the authority.
const MAX_MESSAGES = 60;
const MAX_LENGTH = 8000;

type ChatPanelProps = {
  /** Shown at the start of the header (the page's back link). */
  headerStart?: ReactNode;
  /** Shown at the end of the header (the widget's close button). */
  headerEnd?: ReactNode;
  /** False while the widget is closed: the state is kept, but focus and scrolling wait. */
  active?: boolean;
};

// The conversation lives in this component. Every send posts the whole history, which
// is how the model "remembers" what was said earlier; the server adds its own system
// instruction and chooses the model. A failed send never enters the history (the
// roles must alternate), and the typed text goes back into the box.
// Persistence sits on top: the server saves each exchange and returns the conversation
// id; the newest conversation is loaded once, the first time the panel is active, so a
// reload brings it back. "New conversation" asks the server for an empty one.
export function ChatPanel({ headerStart, headerEnd, active = true }: ChatPanelProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [starting, setStarting] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const sending = pending !== null;
  const full = messages.length + 2 > MAX_MESSAGES;
  const ready = loaded && !starting;
  const canSend = ready && !sending && !full && draft.trim().length > 0;
  const requested = useRef(false);

  // Load the newest saved conversation once, when the panel first becomes active.
  useEffect(() => {
    if (!active || requested.current) return;
    requested.current = true;
    fetch("/api/chat/history", NO_FOLLOW)
      .then((response) => {
        if (sessionEnded(response)) {
          setNotice(SESSION_NOTICE);
          router.refresh();
          return { conversation: null };
        }
        return response.ok ? response.json() : Promise.reject(new Error("history"));
      })
      .then((data: { conversation?: { id: number; messages: ChatMessage[] } | null }) => {
        if (data.conversation) {
          setConversationId(data.conversation.id);
          setMessages(data.conversation.messages);
        }
      })
      .catch(() => setNotice("Your earlier conversation could not be loaded."))
      .finally(() => setLoaded(true));
  }, [active, router]);

  useEffect(() => {
    if (active) endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, pending, error, active]);

  // The box is disabled while a reply is pending; give it focus back afterwards, and
  // when the widget opens.
  useEffect(() => {
    if (active && ready && !sending) inputRef.current?.focus();
  }, [active, ready, sending]);

  async function send() {
    const text = draft.trim();
    if (!text || !ready || sending || full) return;
    setDraft("");
    setError(null);
    setNotice(null);
    setPending(text);
    try {
      const response = await fetch("/api/chat", {
        ...NO_FOLLOW,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, { role: "user", content: text }], conversationId }),
      });
      if (sessionEnded(response)) {
        setDraft(text);
        setNotice(SESSION_NOTICE);
        router.refresh();
        return;
      }
      const data: { content?: unknown; error?: unknown; conversationId?: unknown; saved?: unknown } = await response
        .json()
        .catch(() => ({}));
      if (!response.ok || typeof data.content !== "string") {
        throw new Error(typeof data.error === "string" ? data.error : "The chat is temporarily unavailable.");
      }
      setMessages((current) => [
        ...current,
        { role: "user", content: text },
        { role: "assistant", content: data.content as string },
      ]);
      if (typeof data.conversationId === "number") setConversationId(data.conversationId);
      if (data.saved === false) setNotice("This exchange could not be saved and will be gone after a reload.");
    } catch (caught) {
      setDraft(text);
      setError(
        caught instanceof TypeError
          ? "Could not reach the server. Check your connection and try again."
          : caught instanceof Error ? caught.message : "The chat is temporarily unavailable.",
      );
    } finally {
      setPending(null);
    }
  }

  async function newConversation() {
    if (!ready || sending) return;
    setStarting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/chat/conversations", { ...NO_FOLLOW, method: "POST" });
      if (sessionEnded(response)) {
        setNotice(SESSION_NOTICE);
        router.refresh();
        return;
      }
      const data: { id?: unknown } = await response.json().catch(() => ({}));
      if (!response.ok || typeof data.id !== "number") throw new Error("new");
      setConversationId(data.id);
      setMessages([]);
      setDraft("");
    } catch {
      setError("Could not start a new conversation. Please try again.");
    } finally {
      setStarting(false);
    }
  }

  const visible: ChatMessage[] = pending ? [...messages, { role: "user", content: pending }] : messages;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 px-3 py-3">
        {headerStart}
        <h1 className="flex-1 text-lg font-semibold">Chat</h1>
        <Button variant="outline" size="sm" onClick={() => void newConversation()} disabled={!ready || sending || messages.length === 0}>
          <SquarePen /> New conversation
        </Button>
        {headerEnd}
      </header>

      <div
        className="mx-3 min-h-0 flex-1 space-y-3 overflow-y-auto rounded-lg border bg-muted/30 p-3"
        role="log"
        aria-live="polite"
        aria-label="Conversation"
      >
        {!loaded && (
          <p className="py-12 text-center text-sm text-muted-foreground" role="status">Loading your conversation…</p>
        )}
        {loaded && visible.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Ask anything. The assistant remembers what you said earlier in this conversation.
          </p>
        )}
        {visible.map((message, index) => (
          <div key={index} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
            <p
              className={cn(
                "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-sm",
                message.role === "user"
                  ? "rounded-br-sm bg-primary text-primary-foreground"
                  : "rounded-bl-sm border bg-background",
              )}
              data-role={message.role}
            >
              {message.content}
            </p>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start" role="status">
            <p className="rounded-2xl rounded-bl-sm border bg-background px-4 py-2 text-sm text-muted-foreground">
              Thinking…
            </p>
          </div>
        )}
        {notice && (
          <p role="status" className="rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">{notice}</p>
        )}
        {error && (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        {full && (
          <p className="pb-2 text-sm text-muted-foreground">
            This conversation is full. Start a new conversation to continue.
          </p>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends, Shift+Enter inserts a line break (not while composing, e.g. IME).
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void send();
              }
            }}
            maxLength={MAX_LENGTH}
            rows={2}
            placeholder="Type a message…"
            aria-label="Message"
            disabled={!ready || sending || full}
            className="max-h-40 resize-none"
          />
          <Button type="submit" disabled={!canSend} className="h-[60px]" aria-label="Send message">
            <Send /> <span className="max-sm:sr-only">Send</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
