/**
 * "Fill from image": the AI reads a screenshot of notes / accords / "when to wear" and returns
 * data ready for the admin form (in Serbian).
 *
 * Optional: only works when ANTHROPIC_API_KEY is set in .env.local (Claude API, billed
 * per request to the key owner). Without the key the admin doesn't show the button.
 * The model can be changed with SCENT_AI_MODEL (e.g. the cheaper "claude-haiku-5-5").
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { normalizeAccords, normalizeNotes, normalizeWear, type Accord, type Notes, type Wear } from "@/features/shop/lib/scent";
import { ImportError } from "./safe-fetch";

const SCENT_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export type ScentImageType = (typeof SCENT_IMAGE_TYPES)[number];

export type ScentImage = { mediaType: ScentImageType; data: string };

export type ScentFromImage = {
  notes: Notes;
  accords: Accord[];
  /** empty if the images contain no "when to wear" */
  wear: Wear;
};

const DEFAULT_MODEL = "claude-opus-5-5";
/** The Claude API accepts at most 5 MB per image (base64 is ~4/3 the file size). */
const MAX_BASE64_LENGTH = Math.floor(5 * 1024 * 1024 * 1.33);
const MAX_SCENT_IMAGES = 4;

export function isScentAiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

/** Accord names the site already uses -> same filters and bar colors. */
const ACCORD_VOCABULARY =
  "slatki, drvenast, citrusni, voćni, cvetni, ružin, začinski, topli začinski, aromatični, mošusni, pudrasti, ambra, vanila, karamela, medeni, kožni, duvanski, dimni, oud, svež, morski, zeleni, čajni, zemljani, balzamični, kremasti, kokos, kafa, kakao, bademov, pačuli, lavandin, iris, ozonski, metalni, sapunasti, životinjski";

const SYSTEM_PROMPT = `Čitaš screenshotove sa sajtova o parfemima (npr. piramida nota, trake akorda, "When to wear" / godišnja doba) i popunjavaš formu za prodavnicu parfema u Srbiji.

Pravila:
- Piši na srpskom, latinicom, malim slovima. Prevedi engleske nazive na uobičajene srpske: "Bergamot" -> "bergamot", "Tonka Bean" -> "tonka zrno", "Sandalwood" -> "sandalovina", "Musk" -> "mošus", "Amber" -> "ambra", "Patchouli" -> "pačuli", "Cedar" -> "kedar", "Incense" / "Olibanum" -> "tamjan", "Leather" -> "koža", "Honey" -> "med", "Pink Pepper" -> "ružičasti biber". Vlastita imena sastojaka (npr. "Ambroxan", "Cashmeran", "Iso E Super") ostavi kako jesu.
- Note: "Top" = top, "Middle"/"Heart" = middle, "Base" = base. Ako slika ima samo jednu listu bez podele, stavi sve u middle.
- Akordi: naziv kao pridev, po mogućstvu iz ovog rečnika: ${ACCORD_VOCABULARY}. Jačina 1–100 prema dužini trake (najduža traka ≈ 100). Najviše 10 akorda.
- Kada nositi: proleće/leto/jesen/zima i dan/noć kao 0–100 prema dužini ili popunjenosti trake (najjača ≈ 100). Ako na slikama toga nema, wear_found = false i sve vrednosti 0.
- Upiši samo ono što se vidi na slikama. Ne izmišljaj note ni akorde. Ono čega nema ostavi praznim.`;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    notes: {
      type: "object",
      properties: {
        top: { type: "array", items: { type: "string" } },
        middle: { type: "array", items: { type: "string" } },
        base: { type: "array", items: { type: "string" } },
      },
      required: ["top", "middle", "base"],
      additionalProperties: false,
    },
    accords: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          strength: { type: "integer" },
        },
        required: ["name", "strength"],
        additionalProperties: false,
      },
    },
    wear_found: { type: "boolean" },
    wear: {
      type: "object",
      properties: {
        spring: { type: "integer" },
        summer: { type: "integer" },
        fall: { type: "integer" },
        winter: { type: "integer" },
        day: { type: "integer" },
        night: { type: "integer" },
      },
      required: ["spring", "summer", "fall", "winter", "day", "night"],
      additionalProperties: false,
    },
  },
  required: ["notes", "accords", "wear_found", "wear"],
  additionalProperties: false,
} as const;

let client: Anthropic | null = null;
function getClient() {
  client ??= new Anthropic(); // key from ANTHROPIC_API_KEY
  return client;
}

export async function readScentFromImages(images: ScentImage[], perfumeName: string): Promise<ScentFromImage> {
  if (!isScentAiEnabled()) {
    throw new ImportError("AI nije uključen (nema ANTHROPIC_API_KEY u podešavanjima sajta).", 400);
  }
  if (!images.length || images.length > MAX_SCENT_IMAGES) {
    throw new ImportError(`Dodaj od 1 do ${MAX_SCENT_IMAGES} slike.`, 400);
  }
  for (const image of images) {
    if (!SCENT_IMAGE_TYPES.includes(image.mediaType) || !image.data) {
      throw new ImportError("Slika mora biti PNG, JPG, WEBP ili GIF.", 400);
    }
    if (image.data.length > MAX_BASE64_LENGTH) {
      throw new ImportError("Slika je prevelika (najviše 5 MB).", 400);
    }
  }

  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    ...images.map(
      (image): Anthropic.Beta.BetaContentBlockParam => ({
        type: "image",
        source: { type: "base64", media_type: image.mediaType, data: image.data },
      })
    ),
    {
      type: "text",
      text: perfumeName.trim()
        ? `Parfem: ${perfumeName.trim().slice(0, 140)}. Pročitaj note, akorde i kada nositi sa ovih slika.`
        : "Pročitaj note, akorde i kada nositi sa ovih slika.",
    },
  ];

  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await getClient().beta.messages.create({
      model: process.env.SCENT_AI_MODEL?.trim() || DEFAULT_MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      // If the safety filter rejects a request by mistake, the API retries it on another model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      // Simple extraction from an image -> low "effort" (faster and cheaper), response in strict JSON.
      output_config: { effort: "low", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      messages: [{ role: "user", content }],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new ImportError("AI ključ (ANTHROPIC_API_KEY) nije ispravan.", 500);
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new ImportError("AI je trenutno zauzet (previše zahteva). Probaj ponovo za minut.", 429);
    }
    if (error instanceof Anthropic.BadRequestError) {
      throw new ImportError(`AI nije prihvatio zahtev: ${error.message}`, 400);
    }
    if (error instanceof Anthropic.APIError) {
      throw new ImportError(`AI greška (${error.status ?? "mreža"}). Probaj ponovo.`, 502);
    }
    throw error;
  }

  if (response.stop_reason === "refusal") {
    throw new ImportError("AI je odbio da pročita ove slike. Popuni ručno.", 422);
  }
  if (response.stop_reason === "max_tokens") {
    throw new ImportError("AI odgovor je bio predugačak. Probaj sa manje slika odjednom.", 422);
  }

  const text = response.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  let parsed: { notes?: unknown; accords?: unknown; wear_found?: unknown; wear?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ImportError("AI nije vratio ispravan odgovor. Probaj ponovo.", 502);
  }

  const lower = (list: string[]) => list.map((note) => note.toLowerCase());
  const notes = normalizeNotes(parsed.notes);

  return {
    notes: { top: lower(notes.top), middle: lower(notes.middle), base: lower(notes.base) },
    accords: normalizeAccords(parsed.accords).map((a) => ({ ...a, name: a.name.toLowerCase() })),
    wear: parsed.wear_found === true ? normalizeWear(parsed.wear) : {},
  };
}
