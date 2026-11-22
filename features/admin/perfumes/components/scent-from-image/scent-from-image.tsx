"use client";

import { useEffect, useRef, useState, type ClipboardEvent } from "react";
import styles from "../perfumes/perfumes.module.css";
import {
  fetchScentAiEnabled,
  readScentFromImages,
  type ScentImagePayload,
  type ScentResult,
} from "../../client/perfumes.api";

const MAX_IMAGES = 4;
/** Longest side of the image before upload: enough to read text and bars, at a lower cost. */
const MAX_SIDE = 1568;

type Picked = { preview: string; payload: ScentImagePayload };

type Props = {
  perfumeName: string;
  onResult: (result: ScentResult) => void;
  onMessage: (message: string) => void;
  onAuthError: (error: unknown) => boolean;
};

/** Downscale the image in the browser and convert it to base64 JPEG (faster upload, lower cost). */
async function prepareImage(file: Blob): Promise<Picked> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Slika ne može da se otvori."));
      image.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Slika ne može da se obradi.");
    ctx.fillStyle = "#ffffff"; // providna pozadina -> bela (JPEG nema providnost)
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    return {
      preview: dataUrl,
      payload: { mediaType: "image/jpeg", data: dataUrl.slice(dataUrl.indexOf(",") + 1) },
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * "Fill from image" (AI). Shown only when ANTHROPIC_API_KEY is configured;
 * otherwise just a short note on how to enable it.
 */
export default function ScentFromImage({ perfumeName, onResult, onMessage, onAuthError }: Props) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [reading, setReading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let alive = true;
    fetchScentAiEnabled()
      .then((value) => {
        if (alive) setEnabled(value);
      })
      .catch(() => {
        if (alive) setEnabled(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function addFiles(files: Blob[]) {
    const images = files.filter((file) => file.type.startsWith("image/"));
    if (!images.length) return;
    const room = MAX_IMAGES - picked.length;
    if (room <= 0) {
      onMessage(`Najviše ${MAX_IMAGES} slike odjednom.`);
      return;
    }
    try {
      const prepared = await Promise.all(images.slice(0, room).map(prepareImage));
      setPicked((prev) => [...prev, ...prepared].slice(0, MAX_IMAGES));
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Slika ne može da se učita.");
    }
  }

  function onPaste(event: ClipboardEvent<HTMLDivElement>) {
    const files = [...event.clipboardData.items]
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    if (files.length) {
      event.preventDefault();
      void addFiles(files);
    }
  }

  async function read() {
    if (!picked.length) {
      onMessage("Dodaj bar jednu sliku (izaberi fajl ili nalepi Ctrl+V).");
      return;
    }
    setReading(true);
    onMessage("");
    try {
      const result = await readScentFromImages(
        picked.map((p) => p.payload),
        perfumeName
      );
      onResult(result);
      setPicked([]);
    } catch (error) {
      if (onAuthError(error)) return;
      onMessage(error instanceof Error ? error.message : "AI čitanje nije uspelo.");
    } finally {
      setReading(false);
    }
  }

  if (enabled === null) return null;

  if (!enabled) {
    return (
      <p className={styles.subtle}>
        📷 <strong>Popuni sa slike</strong> (AI) nije uključeno. Da ga uključiš, upiši
        <code> ANTHROPIC_API_KEY</code> u <code>.env.local</code> i ponovo pokreni sajt.
      </p>
    );
  }

  return (
    <div className={styles.scentAi} onPaste={onPaste} tabIndex={0}>
      <div className={styles.cardHead}>
        <span className={styles.label}>📷 Popuni sa slike (AI)</span>
        <span className={styles.subtle}>
          Screenshot nota, akorda ili „kada nositi” — izaberi fajl ili klikni ovde i nalepi (Ctrl+V).
        </span>
      </div>

      <div className={styles.scentAiRow}>
        {picked.map((p, i) => (
          <div key={i} className={styles.scentAiThumb}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.preview} alt={`Slika ${i + 1}`} />
            <button
              type="button"
              onClick={() => setPicked((prev) => prev.filter((_, j) => j !== i))}
              aria-label="Ukloni sliku"
              disabled={reading}
            >
              ✕
            </button>
          </div>
        ))}

        {picked.length < MAX_IMAGES && (
          <button
            type="button"
            className={styles.btn}
            onClick={() => fileRef.current?.click()}
            disabled={reading}
          >
            + Slika
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          multiple
          hidden
          onChange={(e) => {
            void addFiles([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />

        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={() => void read()}
          disabled={reading || picked.length === 0}
        >
          {reading ? "Čitam sliku…" : "Pročitaj i popuni"}
        </button>
      </div>
    </div>
  );
}
