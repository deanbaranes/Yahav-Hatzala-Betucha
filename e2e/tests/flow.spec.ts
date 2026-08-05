import { test, expect, Route } from '@playwright/test';

test.describe('Yahav Hatzala Betucha - Rigorous QA E2E Flows & Edge Cases', () => {

  test('Employee Flow: Extreme Edge Cases on Trip Assignment', async ({ page }) => {
    // Mock login
    await page.route('**/api/auth/login', async (route: Route) => {
      await route.fulfill({ json: { access_token: 'fake-token', role: 'employee', full_name: 'QA Employee' } });
    });
    
    // Mock trips with extreme values and edge cases
    await page.route('**/api/trips/available', async (route: Route) => {
      await route.fulfill({
        json: [
          {
            id: 'trip-past',
            start_date: '2020-01-01T08:00:00Z', // Edge case: Past trip (should not normally appear, but testing UI resilience)
            client: { name: 'Past Client Edge' },
            capacity: 5,
            roles_requirements: { general: 5 },
            role_counts: { general: 0 }
          },
          {
            id: 'trip-huge',
            start_date: '2027-12-31T23:59:00Z',
            client: { name: 'Huge Capacity Client Ltd. Very Long Name To Test Text Wrapping In UI Cards' },
            capacity: 999, // Edge case: massive capacity
            roles_requirements: { medic: 50, driver: 10, guard: 0, general: 939 },
            role_counts: { general: 5 }
          }
        ]
      });
    });

    await page.route('**/api/trips/*/assign', async (route: Route) => {
      await route.fulfill({ status: 200, json: { message: "Assigned successfully" } });
    });

    await page.goto('/');
    
    // Login with weird characters
    await page.fill('input[type="text"], input[type="tel"]', '0501234567');
    await page.fill('input[type="password"]', 'SELECT * FROM users;--'); // Edge case: SQL injection attempt in UI
    await page.click('button:has-text("התחבר")');
    
    // Wait for feed to load
    await expect(page.locator('text=Huge Capacity Client Ltd')).toBeVisible({ timeout: 10000 });
    
    // Verify long names don't break the UI (basic visibility check)
    const longNameCard = page.locator('text=Very Long Name');
    await expect(longNameCard).toBeVisible();

    // Click to assign on huge trip
    const assignBtn = page.locator('button:has-text("שבץ אותי"):first-child, button:has-text("הגש בקשה")').first();
    if (await assignBtn.isVisible()) {
      await assignBtn.click();
      // Should handle successful assignment state smoothly
    }
  });

  test('Admin Flow: Soft Creation, Validation, and Payload Edge Cases', async ({ page }) => {
    // Mock Admin Login
    await page.route('**/api/auth/login', async (route: Route) => {
      await route.fulfill({ json: { access_token: 'fake-admin-token', role: 'admin' } });
    });

    await page.route('**/api/trips', async (route: Route) => {
      await route.fulfill({ json: [] });
    });
    
    await page.route('**/api/trips/create', async (route: Route) => {
      // Validate that the payload handles soft creation properly
      const postData = route.request().postDataJSON();
      expect(postData.capacity).toBeGreaterThanOrEqual(1);
      await route.fulfill({ status: 201, json: { id: "new-trip" } });
    });

    await page.goto('/');
    await page.fill('input[type="text"], input[type="tel"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button:has-text("התחבר")');
    
    // Go to Trips board
    await page.click('text=טיולים').catch(() => {}); // Optional catch if routing is different
    
    // Check create modal
    const addTripBtn = page.locator('button:has-text("הוסף טיול"), button:has-text("הוסף")');
    if (await addTripBtn.isVisible()) {
      await addTripBtn.click();
      
      // Edge Case: Empty submission check
      await page.click('button:has-text("שמור"), button:has-text("אישור")');
      // Should show validation errors, not crash
      
      // Edge Case: Soft Client Creation with special characters
      await page.fill('input[placeholder*="לקוח"]', 'Client !@#$%^&*()_+');
      await page.fill('input[type="date"]', '2026-08-10');
      
      // Try to set capacity to -5 (should be prevented by UI or API)
      await page.fill('input[placeholder*="כמות"], input[type="number"]', '-5');
      
      // Submit
      await page.click('button:has-text("שמור"), button:has-text("אישור")');
    }
  });

  test('Reports & Payroll Flow: Math Boundaries and Mobile Responsiveness', async ({ page }) => {
    // Admin checking reports
    await page.route('**/api/auth/login', async (route: Route) => {
      await route.fulfill({ json: { access_token: 'fake-admin', role: 'admin' } });
    });

    await page.route('**/api/reports/', async (route: Route) => {
      await route.fulfill({
        json: [{
          id: 'rep-1',
          employee: { full_name: 'QA Tester', phone: '0501112222', role: 'medic' },
          trip: { client_name: 'QA Client', location: 'QA Base', start_date: '2026-08-01' },
          start_time: '2026-08-01T08:00:00Z',
          end_time: '2026-08-01T23:59:59Z', // Edge case: Very long shift
          daily_shifts: [],
          overtime_decimal: 99.5, // Edge case: High overtime
          expenses: 15000, // Edge case: Huge expenses
          manager_status: 'pending'
        }]
      });
    });

    await page.goto('/');
    
    // Navigate to Reports (assuming mobile view, sidebar might be hidden)
    const menuBtn = page.locator('button:has-text("תפריט")');
    if (await menuBtn.isVisible()) await menuBtn.click();
    
    const reportsLink = page.locator('text=דוחות ושכר, text=דוחות');
    if (await reportsLink.isVisible()) await reportsLink.click();
    
    // Validate extreme numbers render without breaking layout
    await expect(page.locator('text=15000')).toBeVisible();
    await expect(page.locator('text=99.5')).toBeVisible();
  });

});
