import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("create, export, reopen, order and ship a real pattern", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const name = `Workshop test ${Date.now()}`;
  await page.goto("/");
  await page.getByRole("button", { name: "Tote", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Pattern name", exact: true })
    .fill(name);
  await page.getByRole("button", { name: "Save pattern", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(`Saved "${name}"`);
  const pdf = page.getByRole("link", { name: `Download PDF for ${name}` });
  await expect(pdf).toBeVisible();
  const pdfResponse = await request.get((await pdf.getAttribute("href"))!);
  expect(pdfResponse.status()).toBe(200);
  expect((await pdfResponse.body()).subarray(0, 5).toString()).toBe("%PDF-");
  const svg = await request.get(
    (await page
      .getByRole("link", { name: `Download SVG for ${name}` })
      .getAttribute("href"))!,
  );
  expect(await svg.text()).toContain("<svg");
  await page.getByRole("button", { name: /Pattern library/ }).click();
  await page.getByRole("searchbox", { name: "Search patterns" }).fill(name);
  const card = page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
  await expect(card).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await card.getByRole("button", { name: "Open", exact: true }).click();
  await expect(
    page.getByRole("spinbutton", { name: "Finished width (mm)" }),
  ).toHaveValue("320");
  await expect(
    page.getByRole("button", { name: "Save as new pattern" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Pattern library/ }).click();
  await card.getByRole("button", { name: /Create production order/ }).click();
  await page
    .getByRole("spinbutton", { name: "Quantity", exact: true })
    .fill("3");
  await page.getByRole("textbox", { name: "Workshop note" }).fill(name);
  await page.getByRole("button", { name: "Create order", exact: true }).click();
  const order = page.getByRole("article").filter({ hasText: name });
  await expect(order).toContainText("3 pieces");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await order.getByRole("button", { name: "Start production" }).click();
  await expect(order).toContainText("In production");
  await order.getByRole("button", { name: "Mark shipped" }).click();
  await expect(order).toContainText("Shipped");
  await page.getByRole("button", { name: /Pattern library/ }).click();
  await card
    .getByRole("button", { name: `Delete ${name}`, exact: true })
    .click();
  await card.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByRole("alert")).toContainText("linked to an order");
  expect(errors).toEqual([]);
});

test("keyboard, draft recovery, validation and responsive layout", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to workspace" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Wallet", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Pattern name", exact: true }),
  ).toHaveValue("Wallet panel");
  await page.getByRole("spinbutton", { name: "Finished width (mm)" }).fill("0");
  await expect(
    page.getByRole("button", { name: "Save pattern", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText(
    "must be greater than 0 mm",
  );
  await page.getByRole("button", { name: "Tote", exact: true }).click();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.getByText("125%", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Fit", exact: true }).click();
  await expect(page.getByText("100%", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("deletes an unreferenced pattern after confirmation", async ({ page }) => {
  const name = `Delete test ${Date.now()}`;
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Pattern name", exact: true })
    .fill(name);
  await page.getByRole("button", { name: "Save pattern", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(`Saved "${name}"`);
  await page.getByRole("button", { name: /Pattern library/ }).click();
  await page.getByRole("searchbox", { name: "Search patterns" }).fill(name);
  const card = page.getByRole("article").filter({ hasText: name });
  await card
    .getByRole("button", { name: `Delete ${name}`, exact: true })
    .click();
  await card.getByRole("button", { name: "Confirm delete" }).click();
  await expect(
    page.getByRole("heading", { name: "No matching patterns" }),
  ).toBeVisible();
});
