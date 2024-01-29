// @ts-check
const { test, expect } = require('@playwright/test')

test('has title', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('PlanningSup')
})

test('check page', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('text=IUT de Vannes | BUT INFO | 1ère année | GR 1A | GR 1A1')).toBeVisible()
})

test('change edt', async ({ page }) => {
  await page.goto('/')
  await page.click('#change-planning-button')
  await expect(page.locator('.selected_planning')).toHaveText('IUT de Vannes')
})
