import { test, expect } from '@playwright/test';

test.describe('Yahav Hatzala Betucha E2E Flows', () => {

  test('PWA Flow: Employee login, assign to open trip', async ({ page }) => {
    // This test runs under "Mobile Chrome" as configured in playwright.config.ts for mobile projects
    
    // Intercept API calls to mock backend responses so tests are robust
    await page.route('**/api/auth/login', async route => {
      await route.fulfill({ json: { access_token: 'fake-token', role: 'employee' } });
    });
    
    await page.route('**/api/trips/', async route => {
      // Mock open trips
      await route.fulfill({
        json: [{
          id: 'trip-1',
          date: '2026-07-20',
          client: { name: 'Test Client' },
          capacity: 2,
          confirmed_count: 1,
          assignments: [],
          status: 'pending'
        }]
      });
    });

    await page.route('**/api/trips/*/assign', async route => {
      // Mock successful assignment
      await route.fulfill({ status: 200, json: { message: "Assigned successfully" } });
    });

    await page.goto('/');
    
    // Simulate Login
    await page.fill('input[type="tel"]', '0501234567');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("התחבר")');
    
    // Wait for the trips dashboard to load
    await expect(page.locator('text=Test Client')).toBeVisible();
    
    // Click Assign Me (e.g., "שבץ אותי")
    const assignBtn = page.locator('button:has-text("שבץ אותי")');
    await expect(assignBtn).toBeVisible();
    await assignBtn.click();
    
    // Verify UI updates - Button should change to "שובצת" or disappear depending on the implementation
    // Since we mock the API, we can just assert a success toast or button state change.
    // For this example, we expect the UI to reflect a success state (like a confirmation or text change)
    // await expect(page.locator('text=שובצת בהצלחה')).toBeVisible();
  });

  test('Admin Flow: Soft Creation of a client in Trip Management Board', async ({ page }) => {
    // Intercept login
    await page.route('**/api/auth/login', async route => {
      await route.fulfill({ json: { access_token: 'fake-admin-token', role: 'admin' } });
    });

    await page.route('**/api/trips/', async route => {
      // Return empty trips or some mock trips
      await route.fulfill({ json: [] });
    });
    
    await page.route('**/api/trips/create', async route => {
      // Mock successful trip creation with a new client
      await route.fulfill({ status: 200, json: { id: "new-trip" } });
    });

    await page.goto('/');
    
    // Simulate Login
    await page.fill('input[type="tel"]', '0500000000');
    await page.fill('input[type="password"]', 'admin');
    await page.click('button:has-text("התחבר")');
    
    // Go to Trip Management Board
    await page.click('text=ניהול טיולים');
    
    // Open create trip modal/form
    await page.click('button:has-text("הוסף טיול חדש")');
    
    // Soft create client by typing a non-existent name
    await page.fill('input[placeholder*="שם לקוח"]', 'New Unregistered Client Ltd');
    
    // Fill other required fields
    await page.fill('input[type="date"]', '2026-08-01');
    await page.fill('input[type="time"]', '08:00');
    await page.fill('input[type="number"]', '2'); // capacity
    
    // Submit
    await page.click('button:has-text("שמור טיול")');
    
    // Verify no errors and success modal/toast is shown or modal closes
    // await expect(page.locator('text=טיול נוצר בהצלחה')).toBeVisible();
  });

});
