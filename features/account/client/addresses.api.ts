import type { AddressPayload, AddressRow } from "@/features/account/types";
import { readJsonSafe, resolveErrorMessage } from "@/lib/http";

const API_BASE = "/api/account/addresses";

class AddressesApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AddressesApiError";
    this.status = status;
  }
}

function extractAddresses(data: unknown): AddressRow[] {
  if (
    typeof data === "object" &&
    data !== null &&
    "addresses" in data &&
    Array.isArray(data.addresses)
  ) {
    return data.addresses as AddressRow[];
  }

  return [];
}

async function requestAddresses(
  input: RequestInfo | URL,
  init?: RequestInit,
  fallbackMessage = "Greška pri radu sa adresama."
): Promise<AddressRow[]> {
  const response = await fetch(input, init);
  const data = await readJsonSafe(response);

  if (!response.ok) {
    throw new AddressesApiError(
      response.status,
      resolveErrorMessage(data, fallbackMessage)
    );
  }

  return extractAddresses(data);
}

export async function loadAddressesRequest(): Promise<AddressRow[]> {
  return requestAddresses(
    API_BASE,
    {
      method: "GET",
      cache: "no-store",
    },
    "Greška pri učitavanju adresa."
  );
}

export async function createAddressRequest(
  payload: AddressPayload
): Promise<AddressRow[]> {
  return requestAddresses(
    API_BASE,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Greška pri dodavanju adrese."
  );
}

export async function updateAddressRequest(
  id: string,
  payload: AddressPayload
): Promise<AddressRow[]> {
  return requestAddresses(
    `${API_BASE}/${id}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Greška pri izmeni adrese."
  );
}

export async function deleteAddressRequest(id: string): Promise<AddressRow[]> {
  return requestAddresses(
    `${API_BASE}/${id}`,
    {
      method: "DELETE",
    },
    "Greška pri brisanju adrese."
  );
}

export async function setDefaultAddressRequest(
  id: string
): Promise<AddressRow[]> {
  return requestAddresses(
    `${API_BASE}/${id}/default`,
    {
      method: "POST",
    },
    "Greška pri postavljanju podrazumevane adrese."
  );
}