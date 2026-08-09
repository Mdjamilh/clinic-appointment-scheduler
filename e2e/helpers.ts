import { expect, type Page } from "@playwright/test";

export async function signInAs(page: Page, name: string) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
}

/** Opens the first bookable slot for a provider, paging forward a week if needed. */
export async function openFirstAvailableSlot(page: Page) {
  const slots = page.getByRole("button", { name: /^Book / });
  for (let week = 0; week < 3; week++) {
    if ((await slots.count()) > 0) break;
    await page.getByRole("link", { name: "Next" }).click();
  }
  const slot = slots.first();
  const label = (await slot.getAttribute("aria-label"))!.replace(/^Book /, "");
  await slot.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  return label;
}
