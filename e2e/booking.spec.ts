import { expect, test } from "@playwright/test";

import { openFirstAvailableSlot, signInAs } from "./helpers";

test.describe.configure({ mode: "serial" });

test("visitors can browse providers and filter by specialty", async ({ page }) => {
  await page.goto("/providers");
  await expect(page.getByRole("heading", { name: "Find care" })).toBeVisible();
  await expect(page.getByText("6 providers")).toBeVisible();

  await page.getByRole("searchbox", { name: "Search providers" }).fill("cardio");
  await expect(page.getByText("1 provider", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Dr\. James Okafor/ })).toBeVisible();
});

test("picking a slot while signed out asks the visitor to sign in first", async ({ page }) => {
  await page.goto("/providers/maya-patel");
  const slots = page.getByRole("button", { name: /^Book / });
  if ((await slots.count()) === 0) await page.getByRole("link", { name: "Next" }).click();
  await slots.first().click();
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fproviders%2Fmaya-patel/);
});

test("a patient can book, reschedule and cancel a visit", async ({ page }) => {
  await signInAs(page, "Ava Thompson");
  await page.goto("/providers/daniel-kim");

  // Book
  await openFirstAvailableSlot(page);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Book appointment" })).toBeDisabled();
  await dialog.getByLabel("Reason for visit").fill("Itchy rash on forearm");
  await dialog.getByRole("button", { name: "Book appointment" }).click();

  await expect(page).toHaveURL(/\/appointments$/);
  await expect(page.getByText("Appointment booked")).toBeVisible();
  const card = page.getByRole("article").filter({ hasText: "Itchy rash on forearm" });
  await expect(card).toBeVisible();

  // Reschedule to another slot with the same provider
  await card.getByRole("link", { name: "Reschedule" }).click();
  await expect(page.getByText("You're rescheduling your visit")).toBeVisible();
  await openFirstAvailableSlot(page);
  await page.getByRole("dialog").getByRole("button", { name: "Reschedule" }).click();
  await expect(page.getByText("Appointment rescheduled")).toBeVisible();
  await expect(page.getByRole("article").filter({ hasText: "Itchy rash on forearm" })).toHaveCount(1);

  // Cancel
  await page
    .getByRole("article")
    .filter({ hasText: "Itchy rash on forearm" })
    .getByRole("button", { name: "Cancel" })
    .click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel appointment" }).click();
  await expect(page.getByText("Appointment cancelled.")).toBeVisible();

  await page.getByRole("tab", { name: /Cancelled/ }).click();
  await expect(page.getByRole("article").filter({ hasText: "Itchy rash on forearm" }).first()).toBeVisible();
});

test("only admins can open the clinic dashboard", async ({ page }) => {
  await signInAs(page, "Noah Williams");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/$/);

  await signInAs(page, "Jordan Lee");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Clinic dashboard" })).toBeVisible();
  await expect(page.getByText("Booked today")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Upcoming appointments" })).toBeVisible();
});
