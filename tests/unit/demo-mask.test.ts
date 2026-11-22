import { describe, expect, it } from "vitest";
import { maskAddress, maskEmail, maskName, maskOrderCustomer, maskPhone } from "@/features/admin/demo/mask";

describe("customer data masking (demo account)", () => {
  it("name -> first name + last-name initial", () => {
    expect(maskName("Marko Petrović")).toBe("Marko P.");
    expect(maskName("Ana")).toBe("Ana");
    expect(maskName("")).toBe("");
  });

  it("email and phone don't reveal the full value", () => {
    expect(maskEmail("marko.petrovic@gmail.com")).toBe("m•••@gmail.com");
    expect(maskPhone("060 123 4567")).toBe("06• ••• ••67");
  });

  it("address keeps only the first word", () => {
    expect(maskAddress("Bulevar oslobođenja 12")).toBe("Bulevar ••••");
  });

  it("order: masks the customer, keeps amounts and city", () => {
    const masked = maskOrderCustomer({
      order_number: "AD-1",
      customer_full_name: "Jelena Jovanović",
      customer_email: "jelena@example.com",
      customer_phone: "0641112233",
      customer_address: "Knez Mihailova 5",
      customer_city: "Beograd",
      customer_note: "Pozvati posle 17h",
      total_rsd: 4500,
    });
    expect(masked).toMatchObject({
      order_number: "AD-1",
      customer_full_name: "Jelena J.",
      customer_email: "j•••@example.com",
      customer_city: "Beograd",
      total_rsd: 4500,
    });
    expect(masked.customer_phone).not.toContain("1112");
    expect(masked.customer_note).not.toContain("17h");
  });
});
