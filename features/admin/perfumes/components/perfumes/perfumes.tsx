"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./perfumes.module.css";

import {
  buildSavePayload,
  emptyEditor,
  filterPerfumes,
  normalizeConcentration,
  normalizeGender,
  toEditor,
} from "../../lib/perfumes.lib";

import {
  CONCENTRATIONS,
  GENDERS,
  type EditorState,
  type PerfumeAdminRow,
  type VariantRow,
} from "../../types";

import {
  AdminPerfumesApiError,
  deleteAdminPerfume,
  fetchAdminPerfumes,
  saveAdminPerfume,
} from "../../client/perfumes.api";
import { RichTextEditor } from "../rich-text-editor/rich-text-editor";

export default function AdminPerfumesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [list, setList] = useState<PerfumeAdminRow[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");

  const [editor, setEditor] = useState<EditorState>(emptyEditor());
  const [msg, setMsg] = useState("");

  const filtered = useMemo(() => filterPerfumes(list, query), [list, query]);

  const handleApiError = useCallback((error: unknown) => {
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
  }, [router]);

  const loadList = useCallback(async () => {
    const rows = await fetchAdminPerfumes();
    setList(rows);
    return rows;
  }, []);

  const selectFromRows = useCallback((id: string, rowsArg?: PerfumeAdminRow[]) => {
    const rows = rowsArg ?? list;
    const found = rows.find((perfume) => perfume.id === id);

    if (!found) {
      setMsg("Parfem nije pronađen.");
      return;
    }

    setSelectedId(found.id);
    setEditor(toEditor(found));
    setMsg("");
  }, [list]);

  const newPerfume = useCallback(() => {
    setSelectedId("");
    setEditor(emptyEditor());
    setMsg("");
  }, []);

  const setEditorField = useCallback(<K extends keyof EditorState,>(
    key: K,
    value: EditorState[K]
  ) => {
    setEditor((prev) => ({ ...prev, [key]: value }));
  }, []);

  const addVariant = useCallback(() => {
    setEditor((prev) => ({
      ...prev,
      variants: [...prev.variants, { ml: "", price_rsd: "", in_stock: true }],
    }));
  }, []);

  const updateVariant = useCallback((index: number, patch: Partial<VariantRow>) => {
    setEditor((prev) => {
      const variants = [...prev.variants];
      const current = variants[index] ?? {
        ml: "",
        price_rsd: "",
        in_stock: true,
      };

      variants[index] = {
        ...current,
        ...patch,
      };

      return { ...prev, variants };
    });
  }, []);

  const removeVariant = useCallback((index: number) => {
    setEditor((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index),
    }));
  }, []);

  function onSelect(id: string) {
    try {
      setMsg("");
      selectFromRows(id);
    } catch (error) {
      const e = error as Error;
      setMsg(e.message || "Ne mogu da učitam parfem.");
    }
  }

  async function onSave() {
    setMsg("");

    try {
      buildSavePayload(editor);
    } catch (error) {
      const e = error as Error;
      setMsg(e.message || "Greška pri proveri podataka.");
      return;
    }

    setSaving(true);

    try {
      const savedId = await saveAdminPerfume(editor);
      const rows = await loadList();
      selectFromRows(savedId, rows);
      setMsg("✅ Sačuvano.");
    } catch (error) {
      if (handleApiError(error)) return;

      const e = error as Error;
      setMsg(e.message || "Greška pri čuvanju.");
    } finally {
      setSaving(false);
    }
  }

  async function onRemove() {
    if (!selectedId) return;

    const ok = confirm(
      `Obriši parfem "${selectedId}"? Ovo briše i varijante i note veze.`
    );
    if (!ok) return;

    setSaving(true);
    setMsg("");

    try {
      await deleteAdminPerfume(selectedId);
      await loadList();
      newPerfume();
      setMsg("🗑️ Obrisano.");
    } catch (error) {
      if (handleApiError(error)) return;

      const e = error as Error;
      setMsg(e.message || "Greška pri brisanju.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setMsg("");

        await loadList();
      } catch (error) {
        if (handleApiError(error)) return;

        const e = error as Error;
        setMsg(e.message || "Greška pri učitavanju.");
      } finally {
        setLoading(false);
      }
    })();
  }, [handleApiError, loadList]);

  if (loading) {
    return <div className={styles.loading}>Učitavanje parfema…</div>;
  }

  const noticeClass = msg.startsWith("✅")
    ? styles.noticeSuccess
    : msg.startsWith("🗑️")
    ? styles.noticeWarn
    : styles.noticeError;

  return (
    <div className={`${styles.page} ui-page-glass`}>
      <div className={styles.wrap}>
        <div className={`${styles.shell} ui-glass-card`}>
          <div className={styles.topbar}>
            <div className={styles.topbarLeft}>
              <div className={styles.title}>Admin — Dekanti</div>
            </div>

            <div className={styles.topbarActions}>
              <button className={styles.btn} onClick={newPerfume}>
                + Novi parfem
              </button>
            </div>
          </div>

          <div className={styles.content}>
            {msg && (
              <div className={`${styles.notice} ${noticeClass}`}>{msg}</div>
            )}

            <div className={styles.grid}>
              <aside className={styles.sidebar}>
                <div className={styles.panelHead}>
                  <div className={styles.panelTitle}>Parfemi</div>
                  <div className={styles.badge}>{filtered.length}</div>
                </div>

                <div className={styles.sidebarBody}>
                  <input
                    className={`${styles.input} ${styles.search}`}
                    placeholder="Pretraga (naziv / brend / id)"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />

                  <div className={styles.list}>
                    {filtered.map((perfume: PerfumeAdminRow) => (
                      <div
                        key={perfume.id}
                        className={`${styles.item} ${
                          perfume.id === selectedId ? styles.itemActive : ""
                        }`}
                        onClick={() => onSelect(perfume.id)}
                      >
                        <div className={styles.itemTop}>
                          <div className={styles.itemName}>{perfume.name}</div>
                          <div className={styles.subtle}>
                            {perfume.on_sale ? "AKCIJA" : ""}
                          </div>
                        </div>

                        <div className={styles.itemMeta}>
                          {perfume.brand} ·{" "}
                          <span style={{ fontFamily: "monospace" }}>
                            {perfume.id}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>

              <section className={styles.editorPanel}>
                <div className={styles.panelHead}>
                  <div className={styles.panelTitle}>
                    {selectedId ? "Izmena parfema" : "Novi parfem"}
                  </div>
                </div>

                <div className={styles.editorBody}>
                  <div className={styles.hero}>
                    <div>
                      <div className={styles.field}>
                        <label className={styles.label}>ID (slug) *</label>
                        <input
                          className={styles.input}
                          value={editor.id}
                          onChange={(e) => setEditorField("id", e.target.value)}
                          placeholder="npr. amouage-guidance"
                          disabled={!!selectedId}
                        />
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>Naziv *</label>
                        <input
                          className={styles.input}
                          value={editor.name}
                          onChange={(e) =>
                            setEditorField("name", e.target.value)
                          }
                          placeholder="npr. Guidance"
                        />
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>Brend *</label>
                        <input
                          className={styles.input}
                          value={editor.brand}
                          onChange={(e) =>
                            setEditorField("brand", e.target.value)
                          }
                          placeholder="npr. Amouage"
                        />
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>Opis</label>
                        <RichTextEditor
                          value={editor.description}
                          onChange={(value) =>
                            setEditorField("description", value)
                          }
                          placeholder="Unesi opis parfema i formatiraj ga..."
                        />
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>Image URL</label>
                        <input
                          className={styles.input}
                          value={editor.image_url}
                          onChange={(e) =>
                            setEditorField("image_url", e.target.value)
                          }
                          placeholder="https://..."
                        />
                      </div>

                      <div className={styles.rowStart}>
                        <div className={styles.col}>
                          <div className={styles.field}>
                            <label className={styles.label}>
                              Ocena (Fragrantica)
                            </label>
                            <input
                              className={styles.input}
                              type="number"
                              step="0.01"
                              value={editor.rating}
                              onFocus={(e) => e.currentTarget.select()}
                              onChange={(e) =>
                                setEditorField(
                                  "rating",
                                  e.target.value === ""
                                    ? ""
                                    : Number(e.target.value)
                                )
                              }
                              placeholder="npr. 4.23"
                            />
                          </div>
                        </div>

                        <div className={styles.col}>
                          <div className={styles.field}>
                            <label className={styles.label}>Glasovi</label>
                            <input
                              className={styles.input}
                              type="number"
                              value={editor.votes}
                              onFocus={(e) => e.currentTarget.select()}
                              onChange={(e) =>
                                setEditorField(
                                  "votes",
                                  e.target.value === ""
                                    ? ""
                                    : Number(e.target.value)
                                )
                              }
                              placeholder="npr. 6926"
                            />
                          </div>
                        </div>

                        <div className={styles.col}>
                          <div className={styles.field}>
                            <label className={styles.label}>Akcija</label>
                            <label className={styles.checkboxRow}>
                              <input
                                type="checkbox"
                                checked={editor.on_sale}
                                onChange={(e) =>
                                  setEditorField("on_sale", e.target.checked)
                                }
                              />
                              <span className={styles.subtle}>na akciji ?</span>
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className={styles.rowStart}>
                        <div className={styles.col}>
                          <div className={styles.field}>
                            <label className={styles.label}>Pol</label>
                            <select
                              className={styles.select}
                              value={editor.gender}
                              onChange={(e) =>
                                setEditorField(
                                  "gender",
                                  normalizeGender(e.target.value)
                                )
                              }
                            >
                              {GENDERS.map((gender) => (
                                <option key={gender} value={gender}>
                                  {gender}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className={styles.col}>
                          <div className={styles.field}>
                            <label className={styles.label}>Koncentracija</label>
                            <select
                              className={styles.select}
                              value={editor.concentration}
                              onChange={(e) =>
                                setEditorField(
                                  "concentration",
                                  normalizeConcentration(e.target.value)
                                )
                              }
                            >
                              {CONCENTRATIONS.map((concentration) => (
                                <option
                                  key={concentration}
                                  value={concentration}
                                >
                                  {concentration}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={styles.heroPreviewWrap}>
                      <div className={styles.previewLabel}>Preview</div>

                      <div className={styles.previewBox}>
                        {editor.image_url ? (
                          <img
                            src={editor.image_url}
                            alt=""
                            className={styles.previewImage}
                          />
                        ) : (
                          <div className={styles.emptyPreview}>nema slike</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={styles.sectionDivider} />

                  <div className={styles.card}>
                    <div className={styles.cardHead}>
                      <div className={styles.cardTitle}>
                        Varijante (ml / cena / stanje)
                      </div>

                      <button
                        className={styles.btn}
                        type="button"
                        onClick={addVariant}
                      >
                        + Dodaj varijantu
                      </button>
                    </div>

                    <div className={styles.variantList}>
                      {editor.variants.map(
                        (variant: VariantRow, idx: number) => (
                          <div className={styles.variantRow} key={idx}>
                            <input
                              className={styles.input}
                              type="number"
                              value={variant.ml}
                              onFocus={(e) => e.currentTarget.select()}
                              onChange={(e) => {
                                const raw = e.target.value;
                                updateVariant(idx, {
                                  ml: raw === "" ? "" : Number(raw),
                                });
                              }}
                              placeholder="ml"
                            />

                            <input
                              className={styles.input}
                              type="number"
                              value={variant.price_rsd}
                              onFocus={(e) => e.currentTarget.select()}
                              onChange={(e) => {
                                const raw = e.target.value;
                                updateVariant(idx, {
                                  price_rsd: raw === "" ? "" : Number(raw),
                                });
                              }}
                              placeholder="cena (rsd)"
                            />

                            <label className={styles.checkboxRow}>
                              <input
                                type="checkbox"
                                checked={variant.in_stock}
                                onChange={(e) =>
                                  updateVariant(idx, {
                                    in_stock: e.target.checked,
                                  })
                                }
                              />
                              <span className={styles.subtle}>na stanju</span>
                            </label>

                            <button
                              className={styles.btn}
                              type="button"
                              onClick={() => removeVariant(idx)}
                            >
                              ✕
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  <div className={styles.editorFooterActions}>
                    {selectedId && (
                      <button
                        className={`${styles.btn} ${styles.btnDanger}`}
                        onClick={onRemove}
                        disabled={saving}
                      >
                        Obriši
                      </button>
                    )}

                    <button
                      className={`${styles.btn} ${styles.btnPrimary}`}
                      onClick={onSave}
                      disabled={saving}
                    >
                      {saving ? "Čuvam..." : "Sačuvaj"}
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}