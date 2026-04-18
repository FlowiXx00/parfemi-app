export type Coupon = {
  code: string;
  label: string;
  type: "percent" | "fixed";
  value: number;
  minSubtotal?: number;
};

export const coupons: Coupon[] = [
  {
    code: "WELCOME5",
    label: "Dobrodošli popust",
    type: "percent",
    value: 5,
  },
  {
    code: "DEKANT10",
    label: "Popust na celu kupovinu",
    type: "percent",
    value: 10,
    minSubtotal: 3000,
  },
  {
    code: "FLOW15",
    label: "Jači promo popust",
    type: "percent",
    value: 15,
    minSubtotal: 5000,
  },
  {
    code: "LESS500",
    label: "Fiksni popust",
    type: "fixed",
    value: 500,
    minSubtotal: 4000,
  },
];

export function normalizeCouponCode(input: string) {
  return input.trim().toUpperCase();
}

export function findCoupon(input: string) {
  const code = normalizeCouponCode(input);
  return coupons.find((coupon) => coupon.code === code) ?? null;
}

export function getCouponDiscount(subtotal: number, coupon: Coupon | null) {
  if (!coupon || subtotal <= 0) return 0;
  if (coupon.minSubtotal && subtotal < coupon.minSubtotal) return 0;

  if (coupon.type === "percent") {
    return Math.round((subtotal * coupon.value) / 100);
  }

  return Math.min(coupon.value, subtotal);
}
