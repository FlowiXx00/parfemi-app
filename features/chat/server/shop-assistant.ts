/**
 * Perfume shopping assistant (chat in the corner of the site).
 *
 * Customer types -> /api/chat -> Claude. The model doesn't make up the catalog: when it needs data it
 * calls
 * our tools (catalog search, shop info), and the perfumes it recommends are shown as cards
 * (show_perfumes tool). The reply is streamed to the browser.
 *
 * Only works when ANTHROPIC_API_KEY is set in .env.local. Model: CHAT_AI_MODEL
 * (default claude-opus-5-5; cheaper: claude-sonnet-5-5 or claude-haiku-5-5).
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getProducts } from "@/db/queries/perfumes";
import { getShopSettings } from "@/db/queries/settings";
import { describeShipping, type ShopSettings } from "@/features/orders/lib/shipping";
import { getPrimaryImage } from "@/features/shop/lib/product-images";
import type { Product } from "@/features/shop/types";

const DEFAULT_MODEL = "claude-opus-5-5";
const MAX_TOOL_ROUNDS = 5;
const MAX_TOKENS = 2048;
/** Models that support automatic fallback when the safety filter rejects a request by mistake. */
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-sonnet-5-5", "claude-opus-5", "claude-fable-5-2", "claude-fable-5-1"]);

export function isChatEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatProductCard = {
  id: string;
  brand: string;
  name: string;
  image: string;
  priceFrom: number | null;
  rating: number | null;
};

export type ChatEvent =
  | { type: "text"; text: string }
  | { type: "products"; products: ChatProductCard[] }
  | { type: "error"; message: string }
  | { type: "done" };

/* ------------------------------------------------------------------ */
/* Shop info (same as the Shipping / Returns / FAQ pages) */
/* ------------------------------------------------------------------ */

/** The shipping price comes from Admin > Settings (hence a function, not a constant). */
const shopInfo = (settings: ShopSettings) => `
Atelier Dekant prodaje originalne parfeme pretočene u manje bočice (dekante), da kupac proba miris pre kupovine cele bočice.
Paketi za probu (više dekanata uz popust) su na stranici "Paketi"; kviz "Pronađi svoj miris" pomaže pri izboru.
Dostava: Post-express, obično 1–3 radna dana od slanja. Cena dostave: ${describeShipping(settings)} (iznos proizvoda posle popusta). Sve se vidi u korpi pre potvrde.
Plaćanje: pouzećem ili uplatom na račun.
Status porudžbine: prijavljeni kupci na stranici "Porudžbine"; gosti unosom broja porudžbine i email-a.
Izmena adrese: moguća dok porudžbina nije poslata — kupac treba da se javi sa brojem porudžbine.
Reklamacije i povrat: kupac nas prvo kontaktira (stranica Kontakt) sa brojem porudžbine, opisom i po mogućstvu fotografijom; svaki slučaj se rešava pojedinačno. Robu ne slati nazad bez dogovora.
Oštećen paket: prijaviti kuriru odmah pri preuzimanju i javiti nam se.
Ocene parfema na sajtu (zvezdice) su sa sajta Fragrantica.
`.trim();

const SYSTEM_PROMPT = `Ti si savetnik za parfeme u online prodavnici dekanata "Atelier Dekant" (Srbija).

Kako radiš:
- Odgovaraš na srpskom, latinicom, toplo i kratko (2–5 rečenica). Bez nabrajanja dugih lista.
- Pre nego što preporučiš parfem, UVEK pozovi search_perfumes. Preporučuješ SAMO parfeme koje alat vrati — nikad ne izmišljaj parfeme, note ni cene.
- Kad izabereš šta preporučuješ (najviše 3), pozovi show_perfumes sa njihovim id-jevima da ih kupac vidi kao kartice; u tekstu ukratko reci zašto baš oni (note, prilika, godišnje doba).
- Cene su u dinarima (rsd) po zapremini dekanta, tačno kako ih alat vrati. Parfem koji nije na stanju ne preporučuj kao prvi izbor.
- Za dostavu, plaćanje, porudžbine i povrat pozovi get_shop_info i odgovori samo na osnovu toga.
- Ne obećavaj popuste, kupone ni rokove koji ne piše u podacima. Ne pitaj kupca za lične podatke.
- Ako pitanje nema veze sa parfemima ili kupovinom, ljubazno vrati razgovor na parfeme.
- Ako ne znaš odgovor, reci to i uputi kupca na stranicu Kontakt.`;

/* ------------------------------------------------------------------ */
/* Alati                                                               */
/* ------------------------------------------------------------------ */

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "search_perfumes",
    description:
      "Pretraga kataloga prodavnice. Vraća parfeme sa notama, akordima, kada se nose, cenama po zapremini i stanjem. " +
      "Koristi reči na srpskom ili engleskom (npr. 'vanila', 'svež', 'citrus', 'oud', ime brenda ili parfema). " +
      "Bez query-ja vraća najbolje ocenjene parfeme koji odgovaraju filterima.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Ključne reči: note, akordi, stil, brend ili ime parfema." },
        gender: { type: "string", enum: ["Muški", "Ženski", "Unisex"], description: "Za koga je parfem." },
        max_price_rsd: { type: "number", description: "Najviša cena najmanjeg dekanta u rsd." },
        season: { type: "string", enum: ["spring", "summer", "fall", "winter"], description: "Godišnje doba." },
        time_of_day: { type: "string", enum: ["day", "night"], description: "Dan ili veče." },
        limit: { type: "number", description: "Koliko rezultata (1–12, podrazumevano 8)." },
      },
    },
  },
  {
    name: "show_perfumes",
    description: "Prikaži kupcu kartice parfema koje preporučuješ (slika, cena, klik otvara parfem). Najviše 3 id-ja iz rezultata pretrage.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        ids: { type: "array", items: { type: "string" }, description: "id-jevi parfema iz search_perfumes." },
      },
      required: ["ids"],
    },
  },
  {
    name: "get_shop_info",
    description: "Informacije o dostavi, plaćanju, porudžbinama, reklamacijama i povratu.",
    eager_input_streaming: true,
    input_schema: { type: "object", properties: {} },
  },
];

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "dj")
    .toLowerCase();

const SEASON_LABELS: Record<string, string> = {
  spring: "proleće",
  summer: "leto",
  fall: "jesen",
  winter: "zima",
  day: "dan",
  night: "noć",
};

function cheapestPrice(product: Product) {
  const inStock = product.variants.filter((variant) => variant.inStock);
  const list = inStock.length ? inStock : product.variants;
  return list.length ? Math.min(...list.map((variant) => variant.priceRsd)) : null;
}

/** Compact perfume description for the model (few tokens, but everything needed for advice). */
function describe(product: Product) {
  const strong = Object.entries(product.wear)
    .filter(([, value]) => (value ?? 0) >= 60)
    .map(([key]) => SEASON_LABELS[key] ?? key);
  return {
    id: product.id,
    brand: product.brand,
    name: product.name,
    concentration: product.concentration,
    gender: product.gender,
    rating: product.rating ? `${product.rating.toFixed(2)} (${product.votes ?? 0} glasova, Fragrantica)` : null,
    accords: product.accords.slice(0, 6).map((accord) => `${accord.name} ${accord.strength}`).join(", "),
    notes: {
      top: product.notes.top.join(", "),
      heart: product.notes.middle.join(", "),
      base: product.notes.base.join(", "),
    },
    best_for: strong,
    variants: product.variants.map((variant) => ({
      ml: variant.ml,
      price_rsd: variant.priceRsd,
      in_stock: variant.inStock,
    })),
    tags: [
      product.onSale ? "akcija" : null,
      product.isFeatured ? "preporuka prodavnice" : null,
      product.isBestseller ? "najprodavanije" : null,
    ].filter(Boolean),
  };
}

type SearchInput = {
  query?: unknown;
  gender?: unknown;
  max_price_rsd?: unknown;
  season?: unknown;
  time_of_day?: unknown;
  limit?: unknown;
};

function searchPerfumes(catalog: Product[], input: SearchInput) {
  const query = typeof input.query === "string" ? fold(input.query).trim() : "";
  const tokens = query.split(/[\s,]+/).filter((token) => token.length >= 2);
  const gender = typeof input.gender === "string" ? input.gender : null;
  const maxPrice = Number(input.max_price_rsd) > 0 ? Number(input.max_price_rsd) : null;
  const season = typeof input.season === "string" ? input.season : null;
  const time = typeof input.time_of_day === "string" ? input.time_of_day : null;
  const limit = Math.min(12, Math.max(1, Math.round(Number(input.limit) || 8)));

  const scored = catalog
    .filter((product) => product.variants.length > 0)
    .filter((product) => !gender || product.gender === gender || product.gender === "Unisex")
    .filter((product) => {
      if (!maxPrice) return true;
      const price = cheapestPrice(product);
      return price !== null && price <= maxPrice;
    })
    .filter((product) => !season || (product.wear[season as keyof Product["wear"]] ?? 0) >= 55)
    .filter((product) => !time || (product.wear[time as keyof Product["wear"]] ?? 0) >= 55)
    .map((product) => {
      if (!tokens.length) return { product, score: 1 };
      const haystack = fold(
        [
          product.brand,
          product.name,
          product.concentration,
          product.accords.map((accord) => accord.name).join(" "),
          product.notes.top.join(" "),
          product.notes.middle.join(" "),
          product.notes.base.join(" "),
        ].join(" ")
      );
      const score = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
      return { product, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || (b.product.votes ?? 0) - (a.product.votes ?? 0));

  return {
    found: scored.length,
    perfumes: scored.slice(0, limit).map((entry) => describe(entry.product)),
  };
}

function toCard(product: Product): ChatProductCard {
  return {
    id: product.id,
    brand: product.brand,
    name: product.name,
    image: getPrimaryImage(product),
    priceFrom: cheapestPrice(product),
    rating: product.rating ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Conversation (tool loop, streamed reply) */
/* ------------------------------------------------------------------ */

let client: Anthropic | null = null;
function getClient() {
  client ??= new Anthropic(); // key from ANTHROPIC_API_KEY
  return client;
}

export async function runShopAssistant(history: ChatMessage[], emit: (event: ChatEvent) => void) {
  const [catalog, settings] = await Promise.all([getProducts(), getShopSettings()]);
  const byId = new Map(catalog.map((product) => [product.id, product]));
  const model = process.env.CHAT_AI_MODEL?.trim() || DEFAULT_MODEL;
  const withFallback = FALLBACK_MODELS.has(model);

  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  let jsonRetries = 0;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const stream = getClient().beta.messages.stream({
      model,
      max_tokens: MAX_TOKENS,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: TOOLS,
      messages,
      // Chat should feel fast: low "effort" (less thinking, shorter answers).
      output_config: { effort: "low" },
      ...(withFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });

    stream.on("text", (delta) => emit({ type: "text", text: delta }));

    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await stream.finalMessage();
      jsonRetries = 0;
    } catch (error) {
      // Invalid tool input (rare) -> retry the same step once; real API errors propagate.
      if (error instanceof Anthropic.APIError || jsonRetries++ >= 1) throw error;
      continue;
    }

    if (message.stop_reason === "refusal") {
      emit({ type: "text", text: "\n\nIzvini, na ovo ne mogu da odgovorim. Pitaj me nešto o parfemima." });
      return;
    }
    if (message.stop_reason !== "tool_use") return; // end_turn or max_tokens: the reply is done

    const toolUses = message.content.filter(
      (block): block is Anthropic.Beta.BetaToolUseBlock => block.type === "tool_use"
    );
    if (!toolUses.length) return;

    messages.push({ role: "assistant", content: message.content });

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolUses.map((tool) => {
      const input = (tool.input && typeof tool.input === "object" ? tool.input : {}) as Record<string, unknown>;

      if (tool.name === "search_perfumes") {
        return { type: "tool_result", tool_use_id: tool.id, content: JSON.stringify(searchPerfumes(catalog, input)) };
      }

      if (tool.name === "show_perfumes") {
        const ids = Array.isArray(input.ids) ? input.ids.filter((id): id is string => typeof id === "string") : [];
        const cards = ids
          .map((id) => byId.get(id))
          .filter((product): product is Product => Boolean(product))
          .slice(0, 3)
          .map(toCard);
        if (cards.length) emit({ type: "products", products: cards });
        return {
          type: "tool_result",
          tool_use_id: tool.id,
          content: cards.length
            ? `Kupcu su prikazane kartice: ${cards.map((card) => `${card.brand} ${card.name}`).join(", ")}.`
            : "Nijedan id nije pronađen u katalogu — koristi id-jeve iz search_perfumes.",
          ...(cards.length ? {} : { is_error: true }),
        };
      }

      if (tool.name === "get_shop_info") {
        return { type: "tool_result", tool_use_id: tool.id, content: shopInfo(settings) };
      }

      return { type: "tool_result", tool_use_id: tool.id, content: "Nepoznat alat.", is_error: true };
    });

    messages.push({ role: "user", content: results });
  }
}
