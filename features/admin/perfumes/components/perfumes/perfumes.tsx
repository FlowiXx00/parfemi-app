"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PiArrowsClockwise, PiPlus } from "react-icons/pi";
import AdminPageHeader from "@/features/admin/ui/admin-page-header";
import ui from "@/features/admin/ui/admin-ui.module.css";
import styles from "./perfumes.module.css";

import {
  buildSavePayload,
  createDefaultVariants,
  decantPrice,
  emptyEditor,
  filterPerfumes,
  hasNotes,
  normalizeConcentration,
  normalizeGender,
  readCostInput,
  slugify,
  stockLevel,
  toEditor,
} from "../../lib/perfumes.lib";
import {
  CONCENTRATIONS,
  GENDERS,
  ROUND_STEPS,
  type AccordRow,
  type EditorState,
  type ImageRow,
  type PerfumeAdminRow,
  type VariantRow,
} from "../../types";
import {
  isAllowedImageUrl,
  isStoredImage,
  MAX_PRODUCT_IMAGES,
} from "@/features/shop/lib/product-images";
import { DAY_NIGHT, SEASONS } from "@/features/shop/lib/scent";
import { formatRsd } from "@/lib/format";
import {
  AdminPerfumesApiError,
  deleteAdminPerfume,
  fetchAdminPerfumes,
  revalidateShop,
  saveAdminPerfume,
  setAdminPerfumeActive,
  setAdminStock,
  uploadPerfumeImage,
  type ScentResult,
} from "../../client/perfumes.api";
import { RichTextEditor } from "../rich-text-editor/rich-text-editor";
import ScentFromImage from "../scent-from-image/scent-from-image";

const WEAR_FIELDS = [...SEASONS, ...DAY_NIGHT];
/** Quick add for common decant volumes. */
const COMMON_ML = [2, 3, 5, 10, 15, 20, 30];

const NOTE_FIELDS = [
  ["notesTop", "Otvaranje", "npr. bergamot, limun, lavanda"],
  ["notesMiddle", "Srce", "npr. ruža, jasmin, cimet"],
  ["notesBase", "Baza", "npr. vanila, ambra, mošus"],
] as const;

/** Perfume list filter in the admin. */
type ListFilter = "all" | "active" | "hidden" | "norating" | "lowstock";
const LIST_FILTERS: { key: ListFilter; label: string; test: (perfume: PerfumeAdminRow) => boolean }[] = [
  { key: "all", label: "Svi", test: () => true },
  { key: "active", label: "U shopu", test: (perfume) => perfume.is_active },
  { key: "hidden", label: "Skriveni", test: (perfume) => !perfume.is_active },
  { key: "norating", label: "Bez ocene", test: (perfume) => perfume.rating === null },
  { key: "lowstock", label: "Malo zaliha", test: (perfume) => ["low", "out"].includes(stockLevel(perfume)) },
];

/** "" or a number from the input */
const numOrEmpty = (value: string): number | "" => (value === "" ? "" : Number(value));

export default function AdminPerfumesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [list, setList] = useState<PerfumeAdminRow[]>([]);
  const [query, setQuery] = useState("");
  const [listFilter, setListFilter] = useState<ListFilter>("all");
  const [selectedId, setSelectedId] = useState("");
  const [stockInput, setStockInput] = useState("");
  const currentStock = list.find((perfume) => perfume.id === selectedId)?.stock_ml ?? null;

  const [editor, setEditor] = useState<EditorState>(emptyEditor());
  const [msg, setMsg] = useState("");

  const uploadRef = useRef<HTMLInputElement | null>(null);

  const filterCounts = useMemo(
    () => Object.fromEntries(LIST_FILTERS.map((f) => [f.key, list.filter(f.test).length])) as Record<ListFilter, number>,
    [list]
  );
  const filtered = useMemo(() => {
    const test = LIST_FILTERS.find((f) => f.key === listFilter)?.test ?? (() => true);
    return filterPerfumes(list, query).filter(test);
  }, [list, query, listFilter]);
  const knownBrands = useMemo(() => [...new Set(list.map((perfume) => perfume.brand))].sort(), [list]);
  const cost = readCostInput(editor);

  /* ------------------------------------------------------------------ */
  /* Loading and selection */
  /* ------------------------------------------------------------------ */

  const handleApiError = useCallback(
    (error: unknown) => {
      if (error instanceof AdminPerfumesApiError) {
        if (error.status === 401) {
          router.replace("/login");
          return true;
        }
        if (error.status === 403) {
          router.replace("/");
          return true;
        }
      }
      return false;
    },
    [router]
  );

  const loadList = useCallback(async () => {
    const rows = await fetchAdminPerfumes();
    setList(rows);
    return rows;
  }, []);

  const selectFromRows = useCallback(
    (id: string, rowsArg?: PerfumeAdminRow[]) => {
      const found = (rowsArg ?? list).find((perfume) => perfume.id === id);
      if (!found) {
        setMsg("Parfem nije pronađen.");
        return;
      }
      setSelectedId(found.id);
      setEditor(toEditor(found));
      setStockInput("");
      setMsg("");
    },
    [list]
  );

  const newPerfume = useCallback(() => {
    setSelectedId("");
    setEditor(emptyEditor());
    setMsg("");
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await loadList();
      } catch (error) {
        if (handleApiError(error)) return;
        setMsg((error as Error).message || "Greška pri učitavanju.");
      } finally {
        setLoading(false);
      }
    })();
  }, [handleApiError, loadList]);

  /* ------------------------------------------------------------------ */
  /* Izmene u formi                                                      */
  /* ------------------------------------------------------------------ */

  const setEditorField = useCallback(<K extends keyof EditorState>(key: K, value: EditorState[K]) => {
    setEditor((prev) => ({ ...prev, [key]: value }));
  }, []);

  /** Brand/name: for a new perfume the ID is generated ("xerjoff-naxos") until the admin edits it by hand. */
  function setIdentityField(key: "brand" | "name", value: string) {
    setEditor((prev) => {
      const next = { ...prev, [key]: value };
      const autoId = !prev.id || prev.id === slugify(prev.brand, prev.name);
      if (!selectedId && autoId) next.id = slugify(next.brand, next.name);
      return next;
    });
  }

  // Zapremine
  const updateVariant = useCallback((index: number, patch: Partial<VariantRow>) => {
    setEditor((prev) => ({
      ...prev,
      variants: prev.variants.map((variant, i) => (i === index ? { ...variant, ...patch } : variant)),
    }));
  }, []);

  const removeVariant = useCallback((index: number) => {
    setEditor((prev) => ({ ...prev, variants: prev.variants.filter((_, i) => i !== index) }));
  }, []);

  function addVariant(ml: number | "" = "") {
    setEditor((prev) => {
      const variants = [...prev.variants, { ml, price_rsd: "" as const, in_stock: true }];
      // If the calculator is filled in, a new volume gets its price right away.
      const c = readCostInput(prev);
      const last = variants[variants.length - 1]!;
      if (c && typeof ml === "number") last.price_rsd = decantPrice(ml, c).price;
      return { ...prev, variants: variants.sort((a, b) => (Number(a.ml) || 999) - (Number(b.ml) || 999)) };
    });
  }

  /** Bottle price + bottle ml + margin (+ packaging) -> prices for every volume. */
  function calculatePrices() {
    const c = readCostInput(editor);
    if (!c) {
      setMsg("Upiši koliko si platio celu bocu i koliko ml ima boca.");
      return;
    }
    setEditor((prev) => {
      const base = prev.variants.length ? prev.variants : createDefaultVariants();
      return {
        ...prev,
        variants: base.map((variant) => {
          const ml = Number(variant.ml);
          return ml > 0 ? { ...variant, price_rsd: decantPrice(ml, c).price } : variant;
        }),
      };
    });
    setMsg("✅ Cene su izračunate. Možeš ih ručno doterati, pa klikni „Sačuvaj”.");
  }

  // Akordi
  const addAccord = useCallback(() => {
    setEditor((prev) =>
      prev.accords.length >= 10 ? prev : { ...prev, accords: [...prev.accords, { name: "", strength: 50 }] }
    );
  }, []);

  const updateAccord = useCallback((index: number, patch: Partial<AccordRow>) => {
    setEditor((prev) => ({
      ...prev,
      accords: prev.accords.map((accord, i) => (i === index ? { ...accord, ...patch } : accord)),
    }));
  }, []);

  const removeAccord = useCallback((index: number) => {
    setEditor((prev) => ({ ...prev, accords: prev.accords.filter((_, i) => i !== index) }));
  }, []);

  /** "Fill from image" (AI) result: only fills in what was found in the images. */
  function applyScentResult(result: ScentResult) {
    const noteCount = result.notes.top.length + result.notes.middle.length + result.notes.base.length;
    const hasWear = Object.keys(result.wear).length > 0;

    setEditor((prev) => ({
      ...prev,
      ...(noteCount > 0 && {
        notesTop: result.notes.top.join(", "),
        notesMiddle: result.notes.middle.join(", "),
        notesBase: result.notes.base.join(", "),
      }),
      ...(result.accords.length > 0 && { accords: result.accords.map((accord) => ({ ...accord })) }),
      ...(hasWear && { wear: { ...prev.wear, ...result.wear } }),
    }));

    const filled = [
      noteCount > 0 && `note (${noteCount})`,
      result.accords.length > 0 && `akordi (${result.accords.length})`,
      hasWear && "kada nositi",
    ].filter(Boolean);
    setMsg(
      filled.length
        ? `✅ AI je popunio: ${filled.join(", ")}. Proveri i klikni „Sačuvaj”.`
        : "AI na slikama nije našao note, akorde ni „kada nositi”."
    );
  }

  // Slike
  const addImageLink = useCallback(() => {
    setEditor((prev) =>
      prev.images.length >= MAX_PRODUCT_IMAGES
        ? prev
        : { ...prev, images: [...prev.images, { url: "", label: prev.images.length ? "" : "Parfem" }] }
    );
  }, []);

  const updateImage = useCallback((index: number, patch: Partial<ImageRow>) => {
    setEditor((prev) => ({
      ...prev,
      images: prev.images.map((image, i) => (i === index ? { ...image, ...patch } : image)),
    }));
  }, []);

  const removeImage = useCallback((index: number) => {
    setEditor((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
  }, []);

  /** Moves an image up/down; the first image is the main one (card, search, cart). */
  const moveImage = useCallback((index: number, direction: -1 | 1) => {
    setEditor((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.images.length) return prev;
      const images = [...prev.images];
      [images[index], images[target]] = [images[target]!, images[index]!];
      return { ...prev, images };
    });
  }, []);

  /** Images from the computer are uploaded right away and added to the list. */
  async function onUploadImages(files: File[]) {
    const images = files.filter((file) => file.type.startsWith("image/"));
    if (!images.length) return;

    const room = MAX_PRODUCT_IMAGES - editor.images.filter((image) => image.url.trim()).length;
    if (room <= 0) {
      setMsg(`Najviše ${MAX_PRODUCT_IMAGES} slika po parfemu.`);
      return;
    }

    setUploading(true);
    setMsg("");
    const folder = editor.id.trim() || slugify(editor.brand, editor.name);
    const uploaded: string[] = [];
    try {
      for (const file of images.slice(0, room)) {
        uploaded.push(await uploadPerfumeImage(file, folder));
      }
    } catch (error) {
      if (handleApiError(error)) return;
      setMsg((error as Error).message || "Slanje slike nije uspelo.");
    } finally {
      setUploading(false);
    }

    if (!uploaded.length) return;
    setEditor((prev) => {
      const kept = prev.images.filter((image) => image.url.trim());
      const added = uploaded.map((url, i) => ({ url, label: kept.length + i === 0 ? "Parfem" : "" }));
      return { ...prev, images: [...kept, ...added] };
    });
    setMsg(`✅ Dodato slika: ${uploaded.length}. Klikni „Sačuvaj” da ostanu uz parfem.`);
  }

  /* ------------------------------------------------------------------ */
  /* Save / delete */
  /* ------------------------------------------------------------------ */

  async function onSave() {
    setMsg("");

    try {
      buildSavePayload(editor);
    } catch (error) {
      setMsg((error as Error).message || "Proveri podatke.");
      return;
    }

    setSaving(true);
    try {
      const result = await saveAdminPerfume(editor);
      const rows = await loadList();
      selectFromRows(result.id, rows);
      setMsg(
        result.warnings.length
          ? `⚠️ Sačuvano, ali: ${result.warnings.join(" ")}`
          : `✅ Sačuvano — ${editor.is_active ? "parfem je u shopu" : "parfem je sačuvan kao skriven (kupci ga ne vide)"}.${
              result.storedImages > 0 ? ` Slike preuzete na naš server: ${result.storedImages}.` : ""
            }`
      );
    } catch (error) {
      if (handleApiError(error)) return;
      setMsg((error as Error).message || "Greška pri čuvanju.");
    } finally {
      setSaving(false);
    }
  }

  async function onRemove() {
    if (!selectedId) return;
    if (!confirm(`Obrisati parfem "${editor.brand} ${editor.name}"? Brišu se i njegove zapremine i slike.`)) {
      return;
    }

    setSaving(true);
    setMsg("");
    try {
      await deleteAdminPerfume(selectedId);
      await loadList();
      newPerfume();
      setMsg("🗑️ Obrisano.");
    } catch (error) {
      if (handleApiError(error)) return;
      setMsg((error as Error).message || "Greška pri brisanju.");
    } finally {
      setSaving(false);
    }
  }

  /** Stock is saved immediately (doesn't wait for "Save") so it can't overwrite orders placed meanwhile. */
  async function onStock(mode: "set" | "add" | "off", ml?: number) {
    if (!selectedId) return;
    setSaving(true);
    setMsg("");
    try {
      const next = await setAdminStock(selectedId, mode, ml);
      setList((rows) => rows.map((row) => (row.id === selectedId ? { ...row, stock_ml: mode === "off" ? null : next } : row)));
      setStockInput("");
      setMsg(
        mode === "off"
          ? "✅ Zalihe se više ne prate — važi ručno „na stanju”."
          : `✅ Zalihe: ${next} ml u boci. Zapremine koje ne mogu da se napune se same gase u shopu.`
      );
    } catch (error) {
      if (handleApiError(error)) return;
      setMsg((error as Error).message || "Čuvanje zaliha nije uspelo.");
    } finally {
      setSaving(false);
    }
  }

  /** Hide from shop / back to shop happens immediately, without "Save" (other unsaved form edits are left alone). */
  async function onToggleActive() {
    if (!selectedId) return;
    const next = !editor.is_active;
    setSaving(true);
    setMsg("");
    try {
      await setAdminPerfumeActive(selectedId, next);
      setList((rows) => rows.map((row) => (row.id === selectedId ? { ...row, is_active: next } : row)));
      setEditorField("is_active", next);
      setMsg(
        next
          ? `✅ „${editor.brand} ${editor.name}” je ponovo u shopu.`
          : `✅ „${editor.brand} ${editor.name}” je sakriven — kupci ga ne vide, a ovde ostaje sa svim podacima.`
      );
    } catch (error) {
      if (handleApiError(error)) return;
      setMsg((error as Error).message || "Promena vidljivosti nije uspela.");
    } finally {
      setSaving(false);
    }
  }

  async function onRevalidate() {
    setSaving(true);
    setMsg("");
    try {
      await revalidateShop();
      await loadList();
      setMsg("✅ Shop je osvežen — izmene se vide odmah.");
    } catch (error) {
      if (handleApiError(error)) return;
      setMsg((error as Error).message || "Greška pri osvežavanju shopa.");
    } finally {
      setSaving(false);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Prikaz                                                              */
  /* ------------------------------------------------------------------ */

  if (loading) {
    return <div className={styles.loading}>Učitavanje parfema…</div>;
  }

  const noticeClass = msg.startsWith("✅")
    ? styles.noticeSuccess
    : msg.startsWith("🗑️") || msg.startsWith("⚠️")
      ? styles.noticeWarn
      : styles.noticeError;

  const usedMl = new Set(editor.variants.map((variant) => Number(variant.ml)));

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <AdminPageHeader
          title="Parfemi"
          subtitle="Katalog, cene po zapremini, slike, note i zalihe. Sakriveni parfemi ostaju sačuvani."
          actions={
            <>
              <button
                type="button"
                className={ui.btn}
                onClick={onRevalidate}
                disabled={saving}
                title="Ako si menjao parfeme mimo admina (npr. u Supabase-u), ovo odmah prikaže izmene u shopu."
              >
                <PiArrowsClockwise aria-hidden="true" /> Osveži shop
              </button>
              <button type="button" className={ui.btnPrimary} onClick={newPerfume}>
                <PiPlus aria-hidden="true" /> Novi parfem
              </button>
            </>
          }
        />
        <div className={styles.shell}>

          <div className={styles.content}>
            {msg && <div className={`${styles.notice} ${noticeClass}`}>{msg}</div>}

            <div className={styles.grid}>
              {/* ---------------- Perfume list ---------------- */}
              <aside className={styles.sidebar}>
                <div className={styles.panelHead}>
                  <div className={styles.panelTitle}>Parfemi</div>
                  <div className={styles.badge}>{filtered.length}</div>
                </div>

                <div className={styles.sidebarBody}>
                  <input
                    className={`${styles.input} ${styles.search}`}
                    placeholder="Pretraga (naziv / brend)"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />

                  <div className={styles.listFilters} role="group" aria-label="Filter liste">
                    {LIST_FILTERS.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        className={`${styles.listFilter} ${listFilter === f.key ? styles.listFilterActive : ""}`}
                        aria-pressed={listFilter === f.key}
                        onClick={() => setListFilter(f.key)}
                      >
                        {f.label} <span>{filterCounts[f.key]}</span>
                      </button>
                    ))}
                  </div>

                  <div className={styles.list}>
                    {filtered.length === 0 && <div className={styles.subtle}>Nema parfema za ovaj filter.</div>}
                    {filtered.map((perfume) => (
                      <div
                        key={perfume.id}
                        className={`${styles.item} ${perfume.id === selectedId ? styles.itemActive : ""} ${
                          perfume.is_active ? "" : styles.itemHidden
                        }`}
                        onClick={() => selectFromRows(perfume.id)}
                      >
                        <div className={styles.itemTop}>
                          <div className={styles.itemName}>{perfume.name}</div>
                          <div className={styles.subtle}>
                            {[
                              perfume.is_active ? "" : "SKRIVEN",
                              stockLevel(perfume) === "out" ? "NEMA ZALIHA" : "",
                              stockLevel(perfume) === "low" ? `MALO (${perfume.stock_ml} ml)` : "",
                              perfume.on_sale ? "AKCIJA" : "",
                              perfume.is_featured ? "PREPORUKA" : "",
                              hasNotes(perfume.notes) ? "" : "BEZ NOTA",
                              perfume.images.length ? "" : "BEZ SLIKE",
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        </div>
                        <div className={styles.itemMeta}>{perfume.brand}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>

              {/* ---------------- Forma ---------------- */}
              <section className={styles.editorPanel}>
                <div className={styles.panelHead}>
                  <div className={styles.panelTitle}>
                    {selectedId ? `${editor.brand} ${editor.name}` : "Novi parfem"}
                  </div>
                  {selectedId && (
                    <div className={styles.headActions}>
                      {editor.is_active ? (
                        <Link href={`/shop/${selectedId}`} target="_blank" className={styles.subtle}>
                          Pogledaj u shopu ↗
                        </Link>
                      ) : (
                        <span className={styles.hiddenTag}>Skriven iz shopa</span>
                      )}
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSmall} ${editor.is_active ? "" : styles.btnPrimary}`}
                        onClick={onToggleActive}
                        disabled={saving}
                        title={
                          editor.is_active
                            ? "Kupci ga više ne vide. Cene, slike i note ostaju — možeš ga vratiti kad hoćeš."
                            : "Parfem se ponovo prikazuje u shopu."
                        }
                      >
                        {editor.is_active ? "Sakrij iz shopa" : "Vrati u shop"}
                      </button>
                    </div>
                  )}
                </div>

                <div className={styles.editorBody}>
                  {/* 1. Parfem */}
                  <div className={styles.card}>
                    <div className={styles.cardTitle}>
                      <span className={styles.step}>1</span> Parfem
                    </div>

                    <div className={styles.formGrid}>
                      <label className={styles.field}>
                        <span className={styles.label}>Brend *</span>
                        <input
                          className={styles.input}
                          value={editor.brand}
                          onChange={(e) => setIdentityField("brand", e.target.value)}
                          placeholder="npr. Xerjoff"
                          list="admin-brand-list"
                        />
                        <datalist id="admin-brand-list">
                          {knownBrands.map((brand) => (
                            <option key={brand} value={brand} />
                          ))}
                        </datalist>
                      </label>

                      <label className={styles.field}>
                        <span className={styles.label}>Naziv * (bez brenda)</span>
                        <input
                          className={styles.input}
                          value={editor.name}
                          onChange={(e) => setIdentityField("name", e.target.value)}
                          placeholder="npr. Naxos"
                        />
                      </label>

                      <label className={styles.field}>
                        <span className={styles.label}>Pol</span>
                        <select
                          className={styles.select}
                          value={editor.gender}
                          onChange={(e) => setEditorField("gender", normalizeGender(e.target.value))}
                        >
                          {GENDERS.map((gender) => (
                            <option key={gender} value={gender}>
                              {gender}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className={styles.field}>
                        <span className={styles.label}>Koncentracija</span>
                        <select
                          className={styles.select}
                          value={editor.concentration}
                          onChange={(e) =>
                            setEditorField("concentration", normalizeConcentration(e.target.value))
                          }
                        >
                          {CONCENTRATIONS.map((concentration) => (
                            <option key={concentration} value={concentration}>
                              {concentration}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className={styles.idRow}>
                      <span className={styles.subtle}>Adresa u shopu: /shop/</span>
                      <input
                        className={`${styles.input} ${styles.idInput}`}
                        value={editor.id}
                        onChange={(e) =>
                          setEditorField("id", e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-"))
                        }
                        placeholder="pravi-se-sama"
                        disabled={!!selectedId}
                        title={selectedId ? "Adresa se ne menja posle čuvanja" : "Pravi se sama iz brenda i naziva"}
                      />
                    </label>
                  </div>

                  {/* 2. Slike */}
                  <div className={styles.card}>
                    <div className={styles.cardHead}>
                      <div className={styles.cardTitle}>
                        <span className={styles.step}>2</span> Slike{" "}
                        <span className={styles.subtle}>(prva je glavna)</span>
                      </div>
                      <div className={styles.imageActions}>
                        <button
                          className={`${styles.btn} ${styles.btnPrimary}`}
                          type="button"
                          onClick={() => uploadRef.current?.click()}
                          disabled={uploading || editor.images.length >= MAX_PRODUCT_IMAGES}
                        >
                          {uploading ? "Šaljem…" : "⬆ Sa računara"}
                        </button>
                        <button
                          className={styles.btn}
                          type="button"
                          onClick={addImageLink}
                          disabled={editor.images.length >= MAX_PRODUCT_IMAGES}
                        >
                          + Link slike
                        </button>
                        <input
                          ref={uploadRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
                          multiple
                          hidden
                          onChange={(e) => {
                            void onUploadImages([...(e.target.files ?? [])]);
                            e.target.value = "";
                          }}
                        />
                      </div>
                    </div>

                    <p className={styles.subtle}>
                      Slike sa linka se pri čuvanju <strong>preuzmu na naš server</strong> — ostaju na
                      sajtu i kad ih originalni sajt ukloni. Najlepše izgleda PNG bez pozadine ili slika
                      na beloj pozadini.
                    </p>

                    <div className={styles.imageList}>
                      {editor.images.length === 0 && <span className={styles.subtle}>Nema slika.</span>}
                      {editor.images.map((image, idx) => {
                        const url = image.url.trim();
                        const valid = url !== "" && isAllowedImageUrl(url);
                        const stored = valid && isStoredImage(url);

                        return (
                          <div className={styles.imageRow} key={idx}>
                            <div className={styles.imageThumb}>
                              {valid ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={url} alt="" className={styles.previewImage} loading="lazy" />
                              ) : (
                                <span className={styles.subtle}>{url ? "!" : "—"}</span>
                              )}
                            </div>

                            <div className={styles.imageUrlCell}>
                              <input
                                className={styles.input}
                                value={image.url}
                                onChange={(e) => updateImage(idx, { url: e.target.value })}
                                placeholder="https://…/parfem.png"
                                aria-invalid={url !== "" && !valid}
                              />
                              {valid && (
                                <span className={`${styles.imageStatus} ${stored ? styles.imageStatusOk : ""}`}>
                                  {stored ? "✓ na našem serveru" : "↓ preuzeće se na naš server pri čuvanju"}
                                </span>
                              )}
                              {url !== "" && !valid && (
                                <span className={styles.imageStatus}>Link mora počinjati sa https://</span>
                              )}
                            </div>

                            <div className={styles.imageActions}>
                              <button
                                className={styles.btn}
                                type="button"
                                onClick={() => moveImage(idx, -1)}
                                disabled={idx === 0}
                                aria-label="Pomeri gore"
                              >
                                ↑
                              </button>
                              <button
                                className={styles.btn}
                                type="button"
                                onClick={() => moveImage(idx, 1)}
                                disabled={idx === editor.images.length - 1}
                                aria-label="Pomeri dole"
                              >
                                ↓
                              </button>
                              <button
                                className={styles.btn}
                                type="button"
                                onClick={() => removeImage(idx)}
                                aria-label="Ukloni sliku"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. Miris */}
                  <div className={styles.card}>
                    <div className={styles.cardTitle}>
                      <span className={styles.step}>3</span> Miris — note, akordi, kada nositi
                    </div>

                    <ScentFromImage
                      perfumeName={[editor.brand, editor.name].filter(Boolean).join(" ")}
                      onResult={applyScentResult}
                      onMessage={setMsg}
                      onAuthError={handleApiError}
                    />

                    <div className={styles.notesGrid}>
                      {NOTE_FIELDS.map(([key, label, placeholder]) => (
                        <label key={key} className={styles.field}>
                          <span className={styles.label}>{label}</span>
                          <input
                            className={styles.input}
                            value={editor[key]}
                            onChange={(e) => setEditorField(key, e.target.value)}
                            placeholder={placeholder}
                          />
                        </label>
                      ))}
                    </div>
                    <span className={styles.subtle}>Note odvoji zarezom.</span>

                    <div className={styles.subsection}>
                      <div className={styles.cardHead}>
                        <span className={styles.label}>Akordi (jačina 1–100)</span>
                        <button
                          className={styles.btn}
                          type="button"
                          onClick={addAccord}
                          disabled={editor.accords.length >= 10}
                        >
                          + Akord
                        </button>
                      </div>
                      <div className={styles.accordList}>
                        {editor.accords.length === 0 && <span className={styles.subtle}>Nema akorda.</span>}
                        {editor.accords.map((accord, idx) => (
                          <div className={styles.accordRow} key={idx}>
                            <input
                              className={styles.input}
                              value={accord.name}
                              onChange={(e) => updateAccord(idx, { name: e.target.value })}
                              placeholder="npr. slatki"
                            />
                            <input
                              type="range"
                              min={1}
                              max={100}
                              value={accord.strength || 1}
                              onChange={(e) => updateAccord(idx, { strength: Number(e.target.value) })}
                              aria-label={`Jačina akorda ${accord.name}`}
                            />
                            <span className={styles.rangeValue}>{accord.strength}</span>
                            <button
                              className={styles.btn}
                              type="button"
                              onClick={() => removeAccord(idx)}
                              aria-label="Ukloni akord"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className={styles.subsection}>
                      <span className={styles.label}>Kada nositi (0 = nikako, 100 = idealno)</span>
                      <div className={styles.wearGrid}>
                        {WEAR_FIELDS.map(({ key, label }) => (
                          <label key={key} className={styles.wearItem}>
                            <span className={styles.subtle}>{label}</span>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={5}
                              value={editor.wear[key]}
                              onChange={(e) =>
                                setEditorField("wear", { ...editor.wear, [key]: Number(e.target.value) })
                              }
                            />
                            <span className={styles.rangeValue}>{editor.wear[key]}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className={styles.subsection}>
                      <span className={styles.label}>Boja tečnosti (puni se u pipetu u shopu)</span>
                      <div className={styles.colorRow}>
                        <input
                          type="color"
                          className={styles.colorInput}
                          value={editor.liquid_color || "#e2c48c"}
                          onChange={(e) => setEditorField("liquid_color", e.target.value)}
                          aria-label="Izaberi boju tečnosti"
                        />
                        <span className={styles.subtle}>
                          {editor.liquid_color ? editor.liquid_color : "automatski iz slike"}
                        </span>
                        {editor.liquid_color && (
                          <button
                            type="button"
                            className={styles.btn}
                            onClick={() => setEditorField("liquid_color", "")}
                          >
                            Automatski
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 4. Cene */}
                  <div className={styles.card}>
                    <div className={styles.cardTitle}>
                      <span className={styles.step}>4</span> Cene dekanata
                    </div>

                    <div className={styles.costGrid}>
                      <label className={styles.field}>
                        <span className={styles.label}>Platio sam bocu (rsd)</span>
                        <input
                          className={styles.input}
                          type="number"
                          min="0"
                          value={editor.bottlePrice}
                          onChange={(e) => setEditorField("bottlePrice", numOrEmpty(e.target.value))}
                          placeholder="npr. 28000"
                        />
                      </label>
                      <label className={styles.field}>
                        <span className={styles.label}>Boca ima (ml)</span>
                        <input
                          className={styles.input}
                          type="number"
                          min="1"
                          value={editor.bottleMl}
                          onChange={(e) => setEditorField("bottleMl", numOrEmpty(e.target.value))}
                          placeholder="100"
                        />
                      </label>
                      <label className={styles.field}>
                        <span className={styles.label}>Marža (%)</span>
                        <input
                          className={styles.input}
                          type="number"
                          min="0"
                          value={editor.marginPct}
                          onChange={(e) => setEditorField("marginPct", numOrEmpty(e.target.value))}
                          placeholder="npr. 60"
                        />
                      </label>
                      <label className={styles.field}>
                        <span className={styles.label}>Bočica + pakovanje (rsd/kom)</span>
                        <input
                          className={styles.input}
                          type="number"
                          min="0"
                          value={editor.packaging}
                          onChange={(e) => setEditorField("packaging", numOrEmpty(e.target.value))}
                          placeholder="npr. 150"
                        />
                      </label>
                      <label className={styles.field}>
                        <span className={styles.label}>Zaokruži na</span>
                        <select
                          className={styles.select}
                          value={editor.roundStep}
                          onChange={(e) => setEditorField("roundStep", Number(e.target.value))}
                        >
                          {ROUND_STEPS.map((step) => (
                            <option key={step} value={step}>
                              {step === 1 ? "bez zaokruživanja" : `${step} rsd`}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className={styles.costSummary}>
                      <span className={styles.subtle}>
                        {cost
                          ? `Nabavna cena: ${formatRsd(Math.round(cost.bottlePrice / cost.bottleMl))} po ml`
                          : "Upiši cenu boce i koliko ml ima, pa klikni „Izračunaj cene”."}
                      </span>
                      <button
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        type="button"
                        onClick={calculatePrices}
                        disabled={!cost}
                      >
                        Izračunaj cene
                      </button>
                    </div>

                    <div className={styles.variantTable}>
                      <div className={`${styles.variantRow} ${styles.variantHead}`}>
                        <span>Zapremina</span>
                        <span>Cena (rsd)</span>
                        <span>Nabavno</span>
                        <span>Zarada</span>
                        <span>Na stanju</span>
                        <span />
                      </div>

                      {editor.variants.map((variant, idx) => {
                        const ml = Number(variant.ml);
                        const price = Number(variant.price_rsd);
                        const purchase = cost && ml > 0 ? decantPrice(ml, cost).purchase : null;
                        const profit = purchase !== null && price > 0 ? price - purchase : null;

                        return (
                          <div className={styles.variantRow} key={idx}>
                            <div className={styles.inputWithUnit}>
                              <input
                                className={styles.input}
                                type="number"
                                min="1"
                                value={variant.ml}
                                onFocus={(e) => e.currentTarget.select()}
                                onChange={(e) => updateVariant(idx, { ml: numOrEmpty(e.target.value) })}
                                placeholder="ml"
                                aria-label="Zapremina u ml"
                              />
                              <span>ml</span>
                            </div>
                            <input
                              className={styles.input}
                              type="number"
                              min="0"
                              value={variant.price_rsd}
                              onFocus={(e) => e.currentTarget.select()}
                              onChange={(e) => updateVariant(idx, { price_rsd: numOrEmpty(e.target.value) })}
                              placeholder="cena"
                              aria-label="Cena u rsd"
                            />
                            <span className={styles.subtle}>{purchase !== null ? formatRsd(purchase) : "—"}</span>
                            <span
                              className={
                                profit === null ? styles.subtle : profit > 0 ? styles.profitOk : styles.profitBad
                              }
                            >
                              {profit !== null ? formatRsd(profit) : "—"}
                            </span>
                            <label className={styles.checkboxRow}>
                              <input
                                type="checkbox"
                                checked={variant.in_stock}
                                onChange={(e) => updateVariant(idx, { in_stock: e.target.checked })}
                              />
                              <span className={styles.subtle}>da</span>
                            </label>
                            <button
                              className={styles.btn}
                              type="button"
                              onClick={() => removeVariant(idx)}
                              aria-label="Ukloni zapreminu"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <div className={styles.quickMl}>
                      <span className={styles.subtle}>Dodaj zapreminu:</span>
                      {COMMON_ML.filter((ml) => !usedMl.has(ml)).map((ml) => (
                        <button key={ml} type="button" className={styles.chipBtn} onClick={() => addVariant(ml)}>
                          + {ml} ml
                        </button>
                      ))}
                      <button type="button" className={styles.chipBtn} onClick={() => addVariant()}>
                        + druga
                      </button>
                    </div>
                  </div>

                  {/* Stock (ml in the bottle), saved immediately, independent of "Save" */}
                  {selectedId && (
                    <div className={styles.card}>
                      <div className={styles.cardTitle}>
                        <span className={styles.step}>⚗</span> Zalihe{" "}
                        <span className={styles.subtle}>(koliko ml je ostalo u boci)</span>
                      </div>

                      {currentStock === null ? (
                        <p className={styles.subtle}>
                          Zalihe se ne prate — zapremine su „na stanju” onako kako ih čekiraš gore. Upiši koliko ml ima u
                          boci i sajt će sam ugasiti zapreminu kad ponestane, a porudžbine će skidati ml.
                        </p>
                      ) : (
                        <div className={styles.stockStatus}>
                          <strong className={styles.stockValue}>{currentStock} ml</strong>
                          <span className={styles.stockVariants}>
                            {editor.variants
                              .filter((v) => Number(v.ml) > 0)
                              .map((v) => {
                                const ok = v.in_stock && currentStock >= Number(v.ml);
                                return (
                                  <span key={String(v.ml)} className={ok ? styles.stockOk : styles.stockOut}>
                                    {v.ml} ml {ok ? "✓" : "✗"}
                                  </span>
                                );
                              })}
                          </span>
                        </div>
                      )}

                      <div className={styles.stockRow}>
                        <input
                          className={styles.input}
                          inputMode="numeric"
                          placeholder={currentStock === null ? "npr. 85" : String(currentStock)}
                          value={stockInput}
                          onChange={(e) => setStockInput(e.target.value.replace(/[^\d]/g, ""))}
                          aria-label="Ostalo u boci (ml)"
                        />
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnPrimary}`}
                          disabled={saving || stockInput === ""}
                          onClick={() => void onStock("set", Number(stockInput))}
                        >
                          {currentStock === null ? "Počni da pratiš" : "Postavi"}
                        </button>
                        {Number(editor.bottleMl) > 0 && (
                          <button
                            type="button"
                            className={styles.btn}
                            disabled={saving}
                            onClick={() => void onStock("add", Number(editor.bottleMl))}
                            title="Kupio si novu bocu — dodaje njenu zapreminu na trenutno stanje"
                          >
                            + nova boca ({editor.bottleMl} ml)
                          </button>
                        )}
                        {currentStock !== null && (
                          <button type="button" className={styles.btn} disabled={saving} onClick={() => void onStock("off")}>
                            Ne prati
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 5. Shop display */}
                  <div className={styles.card}>
                    <div className={styles.cardTitle}>
                      <span className={styles.step}>5</span> Prikaz u shopu
                    </div>
                    <div className={styles.formGrid}>
                      <label className={styles.field}>
                        <span className={styles.label}>
                          Ocena <span className={styles.subtle}>(npr. sa Fragrantice, 0–5)</span>
                        </span>
                        <input
                          className={styles.input}
                          type="number"
                          step="0.01"
                          min="0"
                          max="5"
                          value={editor.rating}
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) => setEditorField("rating", numOrEmpty(e.target.value))}
                          placeholder="npr. 4.23"
                        />
                      </label>
                      <label className={styles.field}>
                        <span className={styles.label}>Broj glasova</span>
                        <input
                          className={styles.input}
                          type="number"
                          min="0"
                          value={editor.votes}
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) => setEditorField("votes", numOrEmpty(e.target.value))}
                          placeholder="npr. 6926"
                        />
                      </label>
                    </div>
                    <div className={styles.toggleRow}>
                      <label className={styles.checkboxRow}>
                        <input
                          type="checkbox"
                          checked={editor.on_sale}
                          onChange={(e) => setEditorField("on_sale", e.target.checked)}
                        />
                        <span>Akcija</span>
                      </label>
                      <label className={styles.checkboxRow}>
                        <input
                          type="checkbox"
                          checked={editor.is_featured}
                          onChange={(e) => setEditorField("is_featured", e.target.checked)}
                        />
                        <span>Preporuka</span>
                      </label>
                      <label className={styles.checkboxRow}>
                        <input
                          type="checkbox"
                          checked={editor.is_active}
                          onChange={(e) => setEditorField("is_active", e.target.checked)}
                        />
                        <span>Vidljiv u shopu</span>
                      </label>
                    </div>
                    <span className={styles.subtle}>
                      Bez ocene se zvezdice ne prikazuju. „Najprodavanije” se računa samo iz porudžbina.
                    </span>
                  </div>

                  {/* 6. Opis (opciono) */}
                  <details className={`${styles.card} ${styles.optional}`}>
                    <summary className={styles.cardTitle}>
                      <span className={styles.step}>6</span> Opis{" "}
                      <span className={styles.subtle}>
                        (opciono — prikazuje se na stranici parfema{editor.description.replace(/<[^>]*>/g, "").trim() ? ", popunjeno" : ""})
                      </span>
                    </summary>
                    <RichTextEditor
                      value={editor.description}
                      onChange={(value) => setEditorField("description", value)}
                      placeholder="Kratak opis parfema…"
                    />
                  </details>
                </div>

                <div className={styles.saveBar}>
                  {selectedId && (
                    <button className={`${styles.btn} ${styles.btnDanger}`} onClick={onRemove} disabled={saving}>
                      Obriši
                    </button>
                  )}
                  <button
                    className={`${styles.btn} ${styles.btnPrimary} ${styles.saveBtn}`}
                    onClick={onSave}
                    disabled={saving || uploading}
                  >
                    {saving ? "Čuvam…" : selectedId ? "Sačuvaj izmene" : "Sačuvaj parfem"}
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
