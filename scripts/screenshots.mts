/**
 * Captures README screenshots from a running app.
 * Usage: npm start (with PGLITE_IN_MEMORY=1), then `npx tsx scripts/screenshots.mts`.
 */
import { chromium, type Page } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = "docs/screenshots";

async function signIn(page: Page, name: string) {
  await page.goto(`${BASE}/sign-in`);
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
}

const browser = await chromium.launch();
for (const theme of ["light", "dark"] as const) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme });
  const page = await context.newPage();
  const shot = (name: string, fullPage = false) => page.screenshot({ path: `${OUT}/${name}-${theme}.png`, fullPage });

  await page.goto(BASE);
  await shot("home", true);

  await page.goto(`${BASE}/providers`);
  await shot("providers");

  await signIn(page, "Ava Thompson");
  await page.goto(`${BASE}/providers/maya-patel`);
  const slots = page.getByRole("button", { name: /^Book / });
  if ((await slots.count()) === 0) await page.getByRole("link", { name: "Next" }).click();
  await shot("schedule", true);
  await slots.first().click();
  await page.getByLabel("Reason for visit").fill("Follow-up on blood pressure medication");
  await shot("booking-dialog");
  await page.keyboard.press("Escape");

  await page.goto(`${BASE}/appointments`);
  await page.getByRole("tab", { name: /Upcoming/ }).waitFor();
  await shot("appointments", true);

  await signIn(page, "Jordan Lee");
  await page.goto(`${BASE}/admin`);
  await page.getByRole("heading", { name: "Upcoming appointments" }).waitFor();
  await shot("admin", true);

  await context.close();
}

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await mobile.newPage();
await page.goto(`${BASE}/providers/maya-patel`);
await page.screenshot({ path: `${OUT}/schedule-mobile.png` });
await mobile.close();

await browser.close();
console.log("Screenshots saved to", OUT);
