"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  FiCheckCircle,
  FiEdit2,
  FiMapPin,
  FiPlus,
  FiStar,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import styles from "./addresses-page.module.css";
import type { AddressPayload, AddressRow } from "@/features/account/types";
import {
  createAddressRequest,
  deleteAddressRequest,
  setDefaultAddressRequest,
  updateAddressRequest,
} from "@/features/account/client/addresses.api";

type AddressForm = {
  fullName: string;
  phone: string;
  city: string;
  postalCode: string;
  street: string;
  apartment: string;
  note: string;
  isDefault: boolean;
};

type AddressesPageProps = {
  initialAddresses: AddressRow[];
};

const emptyForm: AddressForm = {
  fullName: "",
  phone: "",
  city: "",
  postalCode: "",
  street: "",
  apartment: "",
  note: "",
  isDefault: false,
};

function sortAddresses(addresses: AddressRow[]) {
  return [...addresses].sort((a, b) => {
    if (a.is_default === b.is_default) {
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    return Number(b.is_default) - Number(a.is_default);
  });
}

function mapAddressToForm(address: AddressRow): AddressForm {
  return {
    fullName: address.full_name,
    phone: address.phone,
    city: address.city,
    postalCode: address.postal_code,
    street: address.street,
    apartment: address.apartment ?? "",
    note: address.note ?? "",
    isDefault: address.is_default,
  };
}

function mapFormToPayload(form: AddressForm): AddressPayload {
  return {
    fullName: form.fullName.trim(),
    phone: form.phone.trim(),
    city: form.city.trim(),
    postalCode: form.postalCode.trim(),
    street: form.street.trim(),
    apartment: form.apartment.trim(),
    note: form.note.trim(),
    isDefault: form.isDefault,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export default function AddressesPage({
  initialAddresses,
}: AddressesPageProps) {
  const [addresses, setAddresses] = useState<AddressRow[]>(
    sortAddresses(initialAddresses)
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressForm>(emptyForm);
  const [isMutating, setIsMutating] = useState(false);

  const isEditing = !!editingId;

  const defaultAddress = useMemo(
    () => addresses.find((address) => address.is_default) ?? null,
    [addresses]
  );

  function openCreateModal() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      isDefault: addresses.length === 0,
    });
    setModalOpen(true);
  }

  function openEditModal(address: AddressRow) {
    setEditingId(address.id);
    setForm(mapAddressToForm(address));
    setModalOpen(true);
  }

  function closeModal() {
    if (isMutating) return;

    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function updateField<K extends keyof AddressForm>(
    key: K,
    value: AddressForm[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function handleSetDefault(id: string) {
    try {
      setIsMutating(true);
      const nextAddresses = await setDefaultAddressRequest(id);
      setAddresses(sortAddresses(nextAddresses));
    } catch (error) {
      window.alert(
        getErrorMessage(
          error,
          "Došlo je do greške pri postavljanju podrazumevane adrese."
        )
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function handleRemove(id: string) {
    const confirmed = window.confirm(
      "Da li si siguran da želiš da obrišeš ovu adresu?"
    );

    if (!confirmed) return;

    try {
      setIsMutating(true);
      const nextAddresses = await deleteAddressRequest(id);
      setAddresses(sortAddresses(nextAddresses));
    } catch (error) {
      window.alert(
        getErrorMessage(error, "Došlo je do greške pri brisanju adrese.")
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      setIsMutating(true);

      const payload = mapFormToPayload(form);

      const nextAddresses = editingId
        ? await updateAddressRequest(editingId, payload)
        : await createAddressRequest(payload);

      setAddresses(sortAddresses(nextAddresses));
      setModalOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    } catch (error) {
      window.alert(
        getErrorMessage(error, "Došlo je do greške pri čuvanju adrese.")
      );
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <section className={styles.hero}>
          <div>
            <div className={styles.kicker}>Moj nalog</div>
            <h1 className={styles.title}>Adrese</h1>
            <p className={styles.subtitle}>
              Sačuvaj adrese za brži checkout i lakše poručivanje pri sledećoj
              kupovini.
            </p>
          </div>

          <button
            type="button"
            className={styles.primaryBtn}
            onClick={openCreateModal}
            disabled={isMutating}
          >
            <FiPlus />
            <span>Dodaj novu adresu</span>
          </button>
        </section>

        {defaultAddress && (
          <section className={styles.highlightCard}>
            <div className={styles.highlightIcon}>
              <FiCheckCircle />
            </div>

            <div className={styles.highlightContent}>
              <div className={styles.highlightLabel}>Podrazumevana adresa</div>
              <div className={styles.highlightName}>
                {defaultAddress.full_name}
              </div>
              <div className={styles.highlightText}>
                {defaultAddress.street}
                {defaultAddress.apartment
                  ? `, ${defaultAddress.apartment}`
                  : ""}
              </div>
              <div className={styles.highlightText}>
                {defaultAddress.city}, {defaultAddress.postal_code}
              </div>
            </div>
          </section>
        )}

        {addresses.length === 0 ? (
          <section className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <FiMapPin />
            </div>

            <h2 className={styles.emptyTitle}>Još nemaš sačuvane adrese</h2>
            <p className={styles.emptyText}>
              Dodaj adresu kako bi kupovina bila brža i jednostavnija pri
              sledećoj porudžbini.
            </p>

            <button
              type="button"
              className={styles.primaryBtn}
              onClick={openCreateModal}
              disabled={isMutating}
            >
              <FiPlus />
              <span>Dodaj prvu adresu</span>
            </button>
          </section>
        ) : (
          <section className={styles.grid}>
            {addresses.map((address) => (
              <article key={address.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <div>
                    <div className={styles.cardName}>{address.full_name}</div>
                    <div className={styles.cardPhone}>{address.phone}</div>
                  </div>

                  {address.is_default && (
                    <span className={styles.defaultBadge}>
                      <FiStar />
                      <span>Podrazumevana</span>
                    </span>
                  )}
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.addressLine}>{address.street}</div>

                  {address.apartment && (
                    <div className={styles.addressLine}>{address.apartment}</div>
                  )}

                  <div className={styles.addressLine}>
                    {address.city}, {address.postal_code}
                  </div>

                  {address.note && (
                    <div className={styles.noteBox}>{address.note}</div>
                  )}
                </div>

                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => openEditModal(address)}
                    disabled={isMutating}
                  >
                    <FiEdit2 />
                    <span>Izmeni</span>
                  </button>

                  {!address.is_default && (
                    <button
                      type="button"
                      className={styles.ghostBtn}
                      onClick={() => handleSetDefault(address.id)}
                      disabled={isMutating}
                    >
                      <FiStar />
                      <span>Postavi kao podrazumevanu</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className={styles.dangerBtn}
                    onClick={() => handleRemove(address.id)}
                    disabled={isMutating}
                  >
                    <FiTrash2 />
                    <span>Obriši</span>
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>

      {modalOpen && (
        <div className={styles.overlay} onMouseDown={closeModal}>
          <div
            className={styles.modal}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.modalKicker}>Adresa za dostavu</div>
                <h2 className={styles.modalTitle}>
                  {isEditing ? "Izmeni adresu" : "Nova adresa"}
                </h2>
              </div>

              <button
                type="button"
                className={styles.closeBtn}
                onClick={closeModal}
                aria-label="Zatvori"
                disabled={isMutating}
              >
                <FiX />
              </button>
            </div>

            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Ime i prezime</span>
                  <input
                    value={form.fullName}
                    onChange={(e) => updateField("fullName", e.target.value)}
                    placeholder="Unesi ime i prezime"
                    required
                    disabled={isMutating}
                  />
                </label>

                <label className={styles.field}>
                  <span>Telefon</span>
                  <input
                    value={form.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    placeholder="+381 6x xxx xx xx"
                    required
                    disabled={isMutating}
                  />
                </label>

                <label className={styles.field}>
                  <span>Grad</span>
                  <input
                    value={form.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    placeholder="Novi Sad"
                    required
                    disabled={isMutating}
                  />
                </label>

                <label className={styles.field}>
                  <span>Poštanski broj</span>
                  <input
                    value={form.postalCode}
                    onChange={(e) => updateField("postalCode", e.target.value)}
                    placeholder="21000"
                    required
                    disabled={isMutating}
                  />
                </label>

                <label className={`${styles.field} ${styles.fieldFull}`}>
                  <span>Ulica i broj</span>
                  <input
                    value={form.street}
                    onChange={(e) => updateField("street", e.target.value)}
                    placeholder="Bulevar oslobođenja 12"
                    required
                    disabled={isMutating}
                  />
                </label>

                <label className={`${styles.field} ${styles.fieldFull}`}>
                  <span>Stan / sprat / ulaz</span>
                  <input
                    value={form.apartment}
                    onChange={(e) => updateField("apartment", e.target.value)}
                    placeholder="Stan 6, 2. sprat"
                    disabled={isMutating}
                  />
                </label>

                <label className={`${styles.field} ${styles.fieldFull}`}>
                  <span>Napomena za dostavu</span>
                  <textarea
                    value={form.note}
                    onChange={(e) => updateField("note", e.target.value)}
                    placeholder="Na primer: pozvati pre isporuke"
                    rows={4}
                    disabled={isMutating}
                  />
                </label>
              </div>

              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => updateField("isDefault", e.target.checked)}
                  disabled={isMutating}
                />
                <span>Postavi kao podrazumevanu adresu</span>
              </label>

              <div className={styles.formActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={closeModal}
                  disabled={isMutating}
                >
                  Otkaži
                </button>

                <button
                  type="submit"
                  className={styles.primaryBtn}
                  disabled={isMutating}
                >
                  {isMutating
                    ? "Čuvanje..."
                    : isEditing
                    ? "Sačuvaj izmene"
                    : "Sačuvaj adresu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}