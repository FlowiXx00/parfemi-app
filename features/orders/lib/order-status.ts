import {
  FiCheckCircle,
  FiClock,
  FiTruck,
  FiXCircle,
} from "react-icons/fi";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipped"
  | "received"
  | "cancelled";

export function getOrderStatusMeta(status: OrderStatus) {
  if (status === "pending") {
    return {
      label: "Nova porudžbina",
      icon: FiClock,
      tone: "pending" as const,
      description: "Porudžbina je uspešno kreirana i čeka potvrdu.",
      progress: 1,
    };
  }

  if (status === "confirmed") {
    return {
      label: "Potvrđena",
      icon: FiCheckCircle,
      tone: "confirmed" as const,
      description: "Porudžbina je potvrđena i priprema se za slanje.",
      progress: 2,
    };
  }

  if (status === "shipped") {
    return {
      label: "Poslata",
      icon: FiTruck,
      tone: "shipped" as const,
      description: "Paket je poslat i uskoro stiže na tvoju adresu.",
      progress: 3,
    };
  }

  if (status === "received") {
    return {
      label: "Preuzeta",
      icon: FiCheckCircle,
      tone: "received" as const,
      description: "Pošiljka je uspešno preuzeta.",
      progress: 4,
    };
  }

  return {
    label: "Otkazana",
    icon: FiXCircle,
    tone: "cancelled" as const,
    description: "Porudžbina je otkazana.",
    progress: 0,
  };
}