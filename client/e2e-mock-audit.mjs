import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'

const PUBLIC_SETTINGS = {
  msw_enabled: 'true',
  mock_telescope_enabled: 'true',
  primary_stream_url: '',
  primary_stream_webrtc_url: '',
  site_camera_url: '',
  site_camera_webrtc_url: '',
}

// expected mock data that SHOULD be visible if the handler shape is right
const EXPECT = {
  '/admin': ['Pending'],
  '/admin/teachers': ['Sarah Chen'],
  '/admin/bookings': ['Year 9 Science Class'],
  '/admin/sessions': ['Session'],
  '/admin/queue': ['Star Party'],
  '/bookings': ['Year 9 Science Class'],
  '/scheduling': [],
  '/lobby/99': ['123456'],
}
const missingContent = [] // { route, marker }

const ROLES = {
  teacher: {
    userType: 'teacher', token: 'mock-token-1', refreshToken: 'mock-token-1', __rememberMe: 'true',
    user: { id: '1', email: 'teacher@latrobe.edu.au', name: 'Dr. Jane Smith', role: 'teacher', fullName: 'Dr. Jane Smith' },
  },
  admin: {
    userType: 'teacher', token: 'mock-token-3', refreshToken: 'mock-token-3', __rememberMe: 'true',
    user: { id: '3', email: 'admin@horizondata.edu.au', name: 'Horizon Admin', role: 'admin', fullName: 'Horizon Admin' },
  },
}

const WALK = [
  ['public', ['/', '/login', '/signup', '/forgot-password', '/reset-password', '/verify-email?email=a@b.com', '/pending-approval', '/join']],
  ['teacher', ['/bookings', '/bookings/new', '/scheduling', '/account', '/captures', '/lobby/99', '/bookings/1/captures']],
  ['admin', ['/admin', '/admin/teachers', '/admin/bookings', '/admin/sessions', '/admin/safety', '/admin/queue', '/admin/settings']],
]

const unmocked = []          // { route, method, url }
const consoleErrors = []     // { route, text }
const pageErrors = []        // { route, text }
let currentRoute = '(boot)'

const run = async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  // catch-all: anything reaching the real network on /api or /weather means MSW
  // did NOT handle it (registered first => lowest priority)
  await ctx.route('**/weather/**', (r) => {
    unmocked.push({ route: currentRoute, method: r.request().method(), url: r.request().url() })
    r.fulfill({ status: 501, contentType: 'application/json', body: '{"unmocked":true}' })
  })
  await ctx.route('**/api/**', (r) => {
    unmocked.push({ route: currentRoute, method: r.request().method(), url: r.request().url() })
    r.fulfill({ status: 501, contentType: 'application/json', body: '{"unmocked":true}' })
  })
  // stub the MSW gate (registered last => highest priority)
  await ctx.route('**/api/settings/public', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PUBLIC_SETTINGS) }))

  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push({ route: currentRoute, text: m.text() }) })
  page.on('pageerror', (e) => pageErrors.push({ route: currentRoute, text: String(e) }))

  // boot once to establish origin + storage
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)

  for (const [role, routes] of WALK) {
    await page.evaluate(({ role, ROLES }) => {
      localStorage.clear()
      localStorage.setItem('msw-enabled', 'true')
      localStorage.setItem('mock-telescope-enabled', 'true')
      const r = ROLES[role]
      if (r) for (const [k, v] of Object.entries(r)) {
        localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v))
      }
    }, { role, ROLES })

    for (const route of routes) {
      currentRoute = `[${role}] ${route}`
      try {
        await page.goto(BASE + route, { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(1800) // let useEffects + 3s-ish polls fire once
        const bare = route.split('?')[0]
        const markers = EXPECT[bare]
        if (markers && markers.length) {
          const body = await page.evaluate(() => document.body.innerText)
          for (const m of markers) if (!body.includes(m)) missingContent.push({ route: currentRoute, marker: m })
        }
      } catch (e) {
        pageErrors.push({ route: currentRoute, text: 'NAV: ' + String(e) })
      }
    }
  }

  // ---- student real join flow ----
  await page.evaluate(() => localStorage.clear())
  currentRoute = '[student] /join (submit 123456)'
  await page.goto(BASE + '/join', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)
  try {
    await page.fill('#displayName', 'Test Student')
    await page.fill('#sessionCode', '123456')
    await page.click('button[type=submit]')
    await page.waitForTimeout(2500)
    currentRoute = `[student] landed ${new URL(page.url()).pathname}`
    await page.waitForTimeout(1500)
  } catch (e) {
    pageErrors.push({ route: currentRoute, text: 'STUDENT FLOW: ' + String(e) })
  }

  await browser.close()

  // ---- report ----
  const uniq = (arr, key) => [...new Map(arr.map(x => [key(x), x])).values()]
  console.log('\n================ MOCK UI AUDIT ================\n')

  const um = uniq(unmocked, x => x.method + ' ' + new URL(x.url).pathname)
  console.log(`UNMOCKED API CALLS (bypassed MSW -> would hit real backend / 401): ${um.length}`)
  for (const u of um) console.log(`  ✗ ${u.method.padEnd(6)} ${new URL(u.url).pathname}   first seen on ${u.route}`)

  console.log(`\nPAGE ERRORS (uncaught): ${pageErrors.length}`)
  for (const e of pageErrors) console.log(`  ⚠ ${e.route}: ${e.text}`)

  console.log(`\nMISSING EXPECTED CONTENT (handler shape/gating wrong -> renders empty): ${missingContent.length}`)
  for (const m of missingContent) console.log(`  ✗ ${m.route}: expected to see "${m.marker}"`)

  const ce = uniq(consoleErrors, x => x.route + x.text)
  // filter noisy network-image + expected stream errors
  const filtered = ce.filter(e => !/wikipedia|favicon|Failed to load resource.*image|net::ERR.*\.(jpg|jpeg|png)/i.test(e.text))
  console.log(`\nCONSOLE ERRORS: ${filtered.length} (of ${ce.length} total; image/stream noise filtered)`)
  for (const e of filtered) console.log(`  • ${e.route}: ${e.text.slice(0, 240)}`)

  console.log('\n================ END AUDIT ================')
}

run().catch((e) => { console.error(e); process.exit(1) })
