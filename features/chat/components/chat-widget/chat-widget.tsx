"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { FiRefreshCw, FiSend, FiX } from "react-icons/fi";
import { PiRobot } from "react-icons/pi";
import { formatRsd } from "@/lib/format";
import styles from "./chat-widget.module.css";

type ProductCard = {
  id: string;
  brand: string;
  name: string;
  image: string;
  priceFrom: number | null;
  rating: number | null;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  products?: ProductCard[];
  error?: boolean;
};

const STORAGE_KEY = "atelier-chat-v1";
const MAX_INPUT = 800;
const SUGGESTIONS = [
  "Nešto slatko i toplo za zimu",
  "Svež miris za leto do 2.000 rsd",
  "Šta je dobro za posao, nenametljivo?",
  "Kako ide dostava i plaćanje?",
];

/** The conversation is kept while the tab is open (also across reloads). */
function loadConversation(): Message[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Message[]) : [];
    return Array.isArray(parsed) ? parsed.slice(-30) : [];
  } catch {
    return [];
  }
}

function saveConversation(messages: Message[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
  } catch {
    // private mode or full storage: the conversation just won't survive a reload
  }
}

/** Minimal text rendering: **bold** and line breaks (no HTML from the response). */
function renderText(text: string): ReactNode {
  return text.split("\n").map((line, lineIndex) => (
    <Fragment key={lineIndex}>
      {lineIndex > 0 && <br />}
      {line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part
      )}
    </Fragment>
  ));
}

/**
 * Perfume shopping assistant: corner button and chat window.
 * Shown only when ANTHROPIC_API_KEY is configured on the server (GET /api/chat).
 */
export default function ChatWidget() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/chat", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { enabled: false }))
      .then((data: { enabled?: boolean }) => {
        if (alive) setEnabled(Boolean(data.enabled));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Always show the latest message
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  function openChat() {
    if (!loaded) {
      setMessages(loadConversation());
      setLoaded(true);
    }
    setOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 150);
  }

  function update(next: Message[]) {
    setMessages(next);
    saveConversation(next);
  }

  function reset() {
    update([]);
    setInput("");
  }

  async function send(text: string) {
    const question = text.trim().slice(0, MAX_INPUT);
    if (!question || busy) return;

    const history: Message[] = [...messages.filter((m) => !m.error), { role: "user", content: question }];
    let assistant: Message = { role: "assistant", content: "" };
    update([...history, assistant]);
    setInput("");
    setBusy(true);

    const patchAssistant = (patch: Partial<Message>) => {
      assistant = { ...assistant, ...patch };
      setMessages([...history, assistant]);
    };

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
      });

      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        patchAssistant({ content: data.error ?? "Savetnik trenutno ne može da odgovori.", error: true });
        return;
      }

      // The reply streams in: one JSON event per line
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as
            | { type: "text"; text: string }
            | { type: "products"; products: ProductCard[] }
            | { type: "error"; message: string }
            | { type: "done" };
          if (event.type === "text") patchAssistant({ content: assistant.content + event.text });
          if (event.type === "products") patchAssistant({ products: [...(assistant.products ?? []), ...event.products] });
          if (event.type === "error") patchAssistant({ content: event.message, error: true });
        }
      }
    } catch {
      patchAssistant({ content: "Veza je prekinuta. Probaj ponovo.", error: true });
    } finally {
      setBusy(false);
      saveConversation([...history, assistant]);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(input);
  }

  if (!enabled) return null;

  return (
    <>
      {!open && (
        <button type="button" className={styles.launcher} onClick={openChat} aria-label="Otvori AI savetnika za parfeme">
          <PiRobot aria-hidden="true" />
          <span className={styles.launcherTip} aria-hidden="true">
            AI savetnik
          </span>
        </button>
      )}

      {open && (
        <section className={styles.panel} role="dialog" aria-label="AI savetnik za parfeme">
          <header className={styles.head}>
            <span className={styles.headIcon} aria-hidden="true">
              <PiRobot />
            </span>
            <div className={styles.headTitle}>
              <strong>Savetnik za parfeme</strong>
              <span className={styles.headSub}>AI pomoćnik · preporučuje iz naše ponude</span>
            </div>
            <div className={styles.headActions}>
              {messages.length > 0 && (
                <button type="button" onClick={reset} aria-label="Novi razgovor" title="Novi razgovor" disabled={busy}>
                  <FiRefreshCw />
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} aria-label="Zatvori">
                <FiX />
              </button>
            </div>
          </header>

          <div className={styles.list} ref={listRef} aria-live="polite">
            {messages.length === 0 && (
              <div className={styles.welcome}>
                <p>
                  Zdravo! 👋 Reci mi kakav miris voliš, za koju priliku ili koliko želiš da potrošiš — predložiću ti
                  parfeme iz naše ponude.
                </p>
                <div className={styles.suggestions}>
                  {SUGGESTIONS.map((suggestion) => (
                    <button key={suggestion} type="button" onClick={() => void send(suggestion)}>
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={index}
                className={`${styles.message} ${message.role === "user" ? styles.user : styles.assistant} ${
                  message.error ? styles.error : ""
                }`}
              >
                {message.content ? (
                  <div className={styles.bubble}>{renderText(message.content)}</div>
                ) : (
                  busy &&
                  index === messages.length - 1 && (
                    <div className={`${styles.bubble} ${styles.typing}`} aria-label="Savetnik piše">
                      <span />
                      <span />
                      <span />
                    </div>
                  )
                )}

                {message.products && message.products.length > 0 && (
                  <div className={styles.cards}>
                    {message.products.map((product) => (
                      <Link
                        key={product.id}
                        href={`/shop?open=${encodeURIComponent(product.id)}`}
                        className={styles.card}
                        scroll={false}
                        onClick={() => {
                          if (window.matchMedia("(max-width: 640px)").matches) setOpen(false);
                        }}
                      >
                        <span className={styles.cardImage}>
                          <Image src={product.image} alt="" width={48} height={48} sizes="48px" />
                        </span>
                        <span className={styles.cardText}>
                          <small>{product.brand}</small>
                          <strong>{product.name}</strong>
                          <span>
                            {product.priceFrom ? `od ${formatRsd(product.priceFrom)}` : ""}
                            {product.rating ? ` · ★ ${product.rating.toFixed(2)}` : ""}
                          </span>
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <form className={styles.form} onSubmit={onSubmit}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_INPUT))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder="Npr. tražim drvenast miris za veče…"
              rows={1}
              disabled={busy}
              aria-label="Tvoje pitanje"
            />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Pošalji">
              <FiSend />
            </button>
          </form>
          <p className={styles.disclaimer}>AI može da pogreši — cenu i stanje proveri u prozoru parfema.</p>
        </section>
      )}
    </>
  );
}
