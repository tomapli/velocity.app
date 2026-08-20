import { expect, test } from "@playwright/test";

test("public login page serves and renders", async ({ page }) => {
  const response = await page.goto("/auth/login");
  expect(response?.status()).toBeLessThan(400);
  await expect(page.locator("body")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
});

test("sign-up redirects to the Google login page", async ({ page }) => {
  await page.goto("/auth/sign-up");
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
});

test("unauthorized page explains the allowlist", async ({ page }) => {
  const response = await page.goto("/auth/unauthorized");
  expect(response?.status()).toBeLessThan(400);
  await expect(
    page.getByRole("heading", { name: "You need to be added" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to sign in" }),
  ).toBeVisible();
});
