import { expect, test } from "@playwright/test";

/**
 * The full purchase flow as a customer sees it. Coupon and order endpoints are intercepted,
 * so the test doesn't depend on coupons in the database and doesn't create real orders.
 */
test.beforeEach(async ({ page }) => {
  // The cookie banner must not cover any buttons
  await page.addInitScript(() => {
    try {
      localStorage.setItem("atelier-consent", "denied");
    } catch {}
  });
});

test("shop: search finds a perfume", async ({ page }) => {
  await page.goto("/shop?q=aventus");
  await expect(page.getByRole("heading", { name: "Svi parfemi" })).toBeVisible();
  await expect(page.locator("article").filter({ hasText: "Aventus" }).first()).toBeVisible();
});

test("purchase: product → cart → coupon → checkout → confirmation", async ({ page }) => {
  await page.route("**/api/coupons/check", (route) =>
    route.fulfill({
      json: { coupon: { code: "TEST10", label: "Test popust", type: "percent", value: 10 } },
    })
  );
  let orderBody: { items?: unknown[]; couponCode?: string | null; customer?: Record<string, string> } | null = null;
  await page.route("**/api/orders", async (route) => {
    orderBody = route.request().postDataJSON();
    await route.fulfill({
      json: { ok: true, orderNumber: "AD-TEST01", payment: null, totals: { totalRsd: 3600 } },
    });
  });

  // 1. Product page: pick a volume and add to cart
  await page.goto("/shop/creed-aventus");
  await expect(page.getByRole("heading", { level: 1, name: "Aventus" })).toBeVisible();
  const tenMl = page.getByRole("radio", { name: /10 ml/ });
  await tenMl.click();
  await expect(tenMl).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Dodaj u korpu" }).click();
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("cart") ?? "[]").length))
    .toBe(1);

  // 2. Cart: the line item and a coupon
  await page.goto("/cart");
  await expect(page.getByText("Aventus").first()).toBeVisible();
  await page.getByLabel("Kupon kod").fill("test10");
  await page.getByRole("button", { name: "Primeni" }).click();
  await expect(page.getByText("TEST10").first()).toBeVisible();

  // 3. Checkout
  await page.getByRole("button", { name: "Nastavi na checkout" }).click();
  await page.getByLabel("Ime i prezime").fill("Test Kupac");
  await page.getByLabel("Email").fill("kupac@example.com");
  await page.getByLabel("Telefon").fill("0601234567");
  await page.getByLabel("Grad").fill("Beograd");
  await page.getByLabel("Adresa").fill("Test ulica 1");
  await page.getByRole("button", { name: "Poruči uz obavezu plaćanja" }).click();

  // 4. Confirmation + empty cart
  await expect(page.getByRole("heading", { name: "Uspešno ste poručili" })).toBeVisible();
  await expect(page.getByText("AD-TEST01")).toBeVisible();
  expect(orderBody).not.toBeNull();
  expect(orderBody!.couponCode).toBe("TEST10");
  expect(orderBody!.items).toHaveLength(1);
  expect(orderBody!.customer?.email).toBe("kupac@example.com");
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("cart") ?? "[]").length))
    .toBe(0);
});

test("404: an unknown URL returns a real 404 page with search", async ({ page }) => {
  const response = await page.goto("/ovaj-link-ne-postoji");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Ovaj miris nismo pronašli" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Pretraga parfema" }).fill("naxos");
  await page.getByRole("button", { name: "Traži" }).click();
  await expect(page).toHaveURL(/\/shop\?q=naxos/);
});
