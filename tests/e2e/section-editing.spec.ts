import { expect, test } from "@playwright/test";
import { openCollection } from "./helpers";

test("quick Enter creates a section and selecting it never asks to delete", async ({ page }) => {
  await page.goto("/");
  await openCollection(page);

  await page.getByRole("button", { name: "分项", exact: true }).click();
  const sectionInput = page.getByRole("textbox", { name: "新分项名称" });
  await sectionInput.fill("AI");
  await sectionInput.press("Enter");

  const aiSection = page.getByRole("button", { name: "AI", exact: true });
  await expect(aiSection).toBeVisible();

  let dialogCount = 0;
  page.on("dialog", (dialog) => {
    dialogCount += 1;
    void dialog.dismiss();
  });
  await aiSection.click();

  await expect(aiSection).toBeVisible();
  expect(dialogCount).toBe(0);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
});
