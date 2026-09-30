const { test, expect } = require('@playwright/test')

/**
 * End-to-end checks against the generated example, served with no backend.
 *
 * The unit tests establish the loader, the toolbar mapping and the component
 * with every collaborator faked. Only a real page proves that the scripts the
 * module copied load from the site's own origin, that the payload carries
 * Drupal's configuration, and that the two meet in a toolbar.
 */

test.describe('the example application', () => {
  test('serves the page', async ({ page }) => {
    const response = await page.goto('/')
    expect(response.status()).toBe(200)
  })

  test('mounts the editor from the configured toolbar', async ({ page }) => {
    await page.goto('/')
    const toolbar = page.locator('.ck-toolbar')
    await expect(toolbar).toBeVisible()
    await expect(page.locator('textarea')).toHaveCount(0)

    // The built-in list has no image button; Drupal's basic_html does.
    await expect(
      toolbar.getByRole('button', { name: 'Upload image from computer' })
    ).toBeVisible()

    const configured = (await page.getByTestId('configured').textContent())
      .trim()
      .split(/\s+/)
    const buttons = configured.filter((item) => item !== '|').length
    expect(buttons).toBeGreaterThan(0)
    await expect(
      toolbar.locator('.ck-toolbar__items > :not(.ck-toolbar__separator)')
    ).toHaveCount(buttons)
  })

  test('what is typed comes out as stored HTML', async ({ page }) => {
    await page.goto('/')
    const editable = page.locator('.ck-editor__editable')
    await editable.click()
    await page.keyboard.press('End')
    await page.keyboard.type(' More.')
    await expect(page.getByTestId('stored')).toContainText('More.')
  })

  test('matches the committed baseline @visual', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.ck-toolbar')).toBeVisible()
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('home.png', { fullPage: true })
  })
})
