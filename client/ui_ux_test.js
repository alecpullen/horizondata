import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const SCREENSHOTS_DIR = '/Users/alecpullen/.gemini/antigravity/browser_recordings';
const BASE_URL = 'https://horizondata.vercel.app';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function runTest() {
  console.log('Starting UI/UX E2E Tests against live deployment...');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  // Log client-side console logs
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error' || text.toLowerCase().includes('error') || text.toLowerCase().includes('fail')) {
      console.log(`[BROWSER LOG ERROR] ${text}`);
    } else {
      console.log(`[BROWSER LOG] ${text}`);
    }
  });

  // Log client-side uncaught exceptions
  page.on('pageerror', err => {
    console.error(`[BROWSER UNCAUGHT EXCEPTION] ${err.stack || err.message}`);
  });

  // Log failed network requests
  page.on('requestfailed', req => {
    console.error(`[NETWORK REQUEST FAILED] ${req.method()} ${req.url()} - ${req.failure()?.errorText || 'Unknown'}`);
  });

  // Log non-2xx/3xx HTTP responses
  page.on('response', res => {
    const status = res.status();
    if (status >= 400) {
      console.error(`[HTTP ERROR ${status}] ${res.request().method()} ${res.url()}`);
    }
  });

  try {
    // 0. Public/Landing Page View
    console.log('\n--- 1. Testing Landing/Public View ---');
    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(3000); // Wait for content
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01_landing_page.png') });
    console.log('Landing page loaded and screenshot saved.');

    // 1. Teacher Login
    console.log('\n--- 2. Testing Teacher Login ---');
    await page.goto(`${BASE_URL}/login`);
    await page.waitForSelector('#email');
    
    // Disable MSW mocking just in case
    await page.evaluate(() => {
      localStorage.setItem('msw-enabled', 'false');
      localStorage.setItem('mock-telescope-enabled', 'false');
    });

    await page.fill('#email', 'teacher@latrobe.edu.au');
    await page.fill('#password', 'password123');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02_teacher_login_filled.png') });
    
    await Promise.all([
      page.click('.auth-submit'),
      page.waitForURL(url => url.pathname.includes('/bookings'))
    ]);
    console.log('Successfully logged in as Teacher!');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03_teacher_bookings.png') });

    // 2. Teacher Views Walkthrough
    console.log('\n--- 3. Walking through Teacher views ---');
    
    console.log('Navigating to New Booking page...');
    await page.goto(`${BASE_URL}/bookings/new`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04_teacher_new_booking.png') });

    console.log('Navigating to Scheduling page...');
    await page.goto(`${BASE_URL}/scheduling`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05_teacher_scheduling.png') });

    console.log('Navigating to Account page...');
    await page.goto(`${BASE_URL}/account`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06_teacher_account.png') });

    console.log('Navigating to Captures page...');
    await page.goto(`${BASE_URL}/captures`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07_teacher_captures.png') });

    console.log('Navigating to Live Control page...');
    await page.goto(`${BASE_URL}/live/teacher`);
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '08_teacher_live.png') });

    // Logout teacher
    console.log('Logging out Teacher...');
    await page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      localStorage.removeItem('userType');
    });

    // 3. Admin Login
    console.log('\n--- 4. Testing Admin Login ---');
    await page.goto(`${BASE_URL}/login`);
    await page.waitForSelector('#email');
    await page.fill('#email', 'admin@test.edu.au');
    await page.fill('#password', 'password123');
    
    await Promise.all([
      page.click('.auth-submit'),
      page.waitForURL(url => url.pathname.includes('/admin'))
    ]);
    console.log('Successfully logged in as Admin!');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '09_admin_dashboard.png') });

    // 4. Admin Views Walkthrough
    console.log('\n--- 5. Walking through Admin views ---');

    console.log('Navigating to Admin Teachers...');
    await page.goto(`${BASE_URL}/admin/teachers`);
    await page.waitForTimeout(6000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '10_admin_teachers.png') });

    console.log('Navigating to Admin Bookings...');
    await page.goto(`${BASE_URL}/admin/bookings`);
    await page.waitForTimeout(6000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '11_admin_bookings.png') });

    console.log('Navigating to Admin Sessions...');
    await page.goto(`${BASE_URL}/admin/sessions`);
    await page.waitForTimeout(6000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '12_admin_sessions.png') });

    console.log('Navigating to Admin Safety...');
    await page.goto(`${BASE_URL}/admin/safety`);
    await page.waitForTimeout(6000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '13_admin_safety.png') });

    console.log('Navigating to Admin Queue...');
    await page.goto(`${BASE_URL}/admin/queue`);
    await page.waitForTimeout(6000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '14_admin_queue.png') });

    console.log('Navigating to Admin Settings...');
    await page.goto(`${BASE_URL}/admin/settings`);
    await page.waitForTimeout(6000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '15_admin_settings.png') });

    // Logout admin
    console.log('Logging out Admin...');
    await page.evaluate(() => {
      localStorage.clear();
    });

    // 5. Student Views
    console.log('\n--- 6. Testing Student views ---');
    console.log('Navigating to Student Join page...');
    await page.goto(`${BASE_URL}/join`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '16_student_join.png') });

    console.log('Navigating to Live Student page...');
    await page.goto(`${BASE_URL}/live/student`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '17_student_live.png') });

    console.log('\nE2E testing process completed!');

  } catch (error) {
    console.error('Test run failed with error:', error);
  } finally {
    await browser.close();
  }
}

runTest();
