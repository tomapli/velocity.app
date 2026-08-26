import { chromium } from "@playwright/test";

const browser = await chromium.launch();
for (const scheme of ["light", "dark"]) {
  const context = await browser.newContext({
    colorScheme: scheme,
    viewport: { width: 1440, height: 1100 },
  });
  const page = await context.newPage();
  await page.goto("http://localhost:3000/auth/dev-insights-preview", { waitUntil: "networkidle" });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `/tmp/insights2-${scheme}-full.png`, fullPage: true });
  await context.close();
}
const context = await browser.newContext({ colorScheme: "light", viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();
await page.goto("http://localhost:3000/auth/dev-insights-preview", { waitUntil: "networkidle" });
await page.getByRole("radio", { name: "15d" }).click();
await page.waitForTimeout(1600);
await page.screenshot({ path: "/tmp/insights2-light-15d.png", fullPage: true });
await context.close();
await browser.close();
