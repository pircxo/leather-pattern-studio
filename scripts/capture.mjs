// Capture portfolio previews using disposable services and sample patterns.
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { chromium } from "@playwright/test";

const server = spawn("python3", ["scripts/e2e_server.py"], {
  stdio: "inherit",
});
let browser;
try {
  const base = "http://127.0.0.1:15173";
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(`${base}/api/v1/patterns`);
      if (response.ok) break;
    } catch {
      /* Both services need to finish starting. */
    }
    if (attempt >= 60) throw new Error("Preview services did not start.");
    await setTimeout(500);
  }
  const samples = [
    ["Crossbody strap", 250, 25, 3, 5],
    ["Wallet panel", 110, 90, 8, 4],
    ["Tote body", 320, 360, 20, 6],
    ["Card pocket", 95, 65, 5, 4],
  ];
  let toteId;
  for (const [name, width, height, radius, seam] of samples) {
    const response = await fetch(`${base}/api/v1/patterns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        finished_width_mm: width,
        finished_height_mm: height,
        corner_radius_mm: radius,
        seam_allowance_mm: seam,
      }),
    });
    if (!response.ok) throw new Error(await response.text());
    const pattern = await response.json();
    if (name === "Tote body") toteId = pattern.id;
  }
  await fetch(`${base}/api/v1/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pattern_id: toteId,
      quantity: 3,
      customer_note: "Natural tan, matching thread",
    }),
  });
  browser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
      chromium.executablePath(),
  });
  await mkdir("docs/screenshots", { recursive: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
  });
  await page.goto(base);
  await page.getByRole("button", { name: "Tote", exact: true }).click();
  await page.screenshot({
    path: "docs/screenshots/editor.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /Pattern library/ }).click();
  await page
    .getByRole("heading", { name: "Card pocket", exact: true })
    .waitFor();
  await page.screenshot({
    path: "docs/screenshots/library.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /Production orders/ }).click();
  await page
    .getByText("Natural tan, matching thread", { exact: true })
    .waitFor();
  await page.screenshot({
    path: "docs/screenshots/orders.png",
    fullPage: true,
  });
  const phone = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    deviceScaleFactor: 1,
  });
  await phone.goto(base);
  await phone.getByRole("button", { name: "Wallet", exact: true }).click();
  await phone.screenshot({
    path: "docs/screenshots/mobile.png",
    fullPage: true,
  });
  console.log(
    "Saved editor, library, orders and phone previews in docs/screenshots.",
  );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  await new Promise((resolve) => server.once("exit", resolve));
}
