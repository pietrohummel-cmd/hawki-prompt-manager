"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

export default function SimulationPage() {
  const { id } = useParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [promptVersion, setPromptVersion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setError(null);
    setSending(true);

    const userMessage: Message = { role: "user", content: text };
    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMessage, { role: "assistant", content: "", streaming: true }]);

    try {
      const res = await fetch(`/api/clients/${id}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erro na simulação");
      }

      const version = res.headers.get("X-Prompt-Version");
      if (version) setPromptVersion(Number(version));

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: accumulated, streaming: true };
          return next;
        });
      }

      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: accumulated, streaming: false };
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      setMessages((prev) => prev.filter((m) => !m.streaming));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [id, input, messages, sending]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function clearConversation() {
    setMessages([]);
    setError(null);
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] min-h-[500px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <p className="text-sm text-[var(--text-secondary)]">
            Simulação em tempo real
            {promptVersion && (
              <span className="ml-2 text-xs text-[var(--text-muted)] bg-[var(--surface-raised)] px-2 py-0.5 rounded-full">
                usando versão {promptVersion}
              </span>
            )}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Digite como se fosse um lead. A Sofia responde usando o prompt ativo.
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearConversation}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-3 py-1.5 border border-[var(--surface-border)] hover:border-[var(--surface-border)] rounded-md transition-colors"
          >
            Limpar conversa
          </button>
        )}
      </div>

      {/* Área de mensagens */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <p className="text-[var(--text-muted)] text-sm">Nenhuma mensagem ainda.</p>
              <p className="text-[var(--text-disabled)] text-xs mt-1">Envie uma mensagem para iniciar a simulação.</p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0 mr-2 mt-1">
                S
              </div>
            )}
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-[var(--accent)] text-white rounded-br-sm"
                  : "bg-[var(--surface-raised)] text-[var(--text-primary)] rounded-bl-sm border border-[var(--surface-border)]"
              }`}
            >
              {msg.content || (msg.streaming ? (
                <span className="flex gap-1 items-center py-1">
                  <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" />
                </span>
              ) : "")}
              {msg.streaming && msg.content && (
                <span className="inline-block w-0.5 h-3.5 bg-current ml-0.5 animate-pulse align-middle" />
              )}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Erro */}
      {error && (
        <div className="mt-2 bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-2 rounded-md shrink-0">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="mt-3 flex gap-2 shrink-0">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
          rows={2}
          placeholder="Digite a mensagem do lead... (Enter para enviar, Shift+Enter para nova linha)"
          className="flex-1 bg-[var(--surface)] border border-[var(--surface-border)] text-[var(--text-primary)] text-sm rounded-xl px-4 py-3 resize-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 disabled:opacity-50 transition-colors"
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-medium text-sm px-5 rounded-xl transition-colors shrink-0"
        >
          {sending ? (
            <span className="animate-spin inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full" />
          ) : "→"}
        </button>
      </div>
    </div>
  );
}
