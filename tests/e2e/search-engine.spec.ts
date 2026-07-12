import { expect, test } from "@playwright/test";

test("a freshly selected search engine still handles a quick Enter", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Enter");

  const searchInput = page.getByRole("textbox", { name: "搜索网站" });
  const engineSelect = page.getByRole("combobox", { name: "选择搜索引擎" });

  await engineSelect.selectOption("baidu");
  await searchInput.fill("x");
  await page.waitForTimeout(200);

  await expect(page.getByRole("listbox", { name: "搜索结果" })).toBeVisible();

  const popupPromise = page.waitForEvent("popup");
  await searchInput.press("Enter");
  const popup = await popupPromise;

  expect(popup.url()).toBe("https://www.baidu.com/s?wd=x");
  await popup.close();
});
