export type AddressRow = {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  city: string;
  postal_code: string;
  street: string;
  apartment: string | null;
  note: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type AddressPayload = {
  fullName: string;
  phone: string;
  city: string;
  postalCode: string;
  street: string;
  apartment: string;
  note: string;
  isDefault: boolean;
};