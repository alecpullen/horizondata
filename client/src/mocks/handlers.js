import { http, HttpResponse, delay, passthrough } from 'msw'

// Check if MSW is enabled (stored in localStorage)
function isMswEnabled() {
    // Default to false if not set
    const stored = localStorage.getItem('msw-enabled')
    const enabled = stored === null ? false : stored === 'true'
    console.log('[MSW] isMswEnabled:', enabled, '(stored:', stored, ')')
    return enabled
}

// Check if Mock Telescope Hardware is enabled (stored in localStorage)
function isMockTelescopeEnabled() {
    // Default to false if not set
    const stored = localStorage.getItem('mock-telescope-enabled')
    const enabled = stored === null ? false : stored === 'true'
    console.log('[MSW] isMockTelescopeEnabled:', enabled, '(stored:', stored, ')')
    return enabled
}

// In-memory store for mock settings, synced with localStorage for persistence
const mockSettings = {
    primary_stream_url: localStorage.getItem('primary-stream-url') || '',
    site_camera_url: localStorage.getItem('site-camera-url') || '',
    msw_enabled: localStorage.getItem('msw-enabled') || 'false',
    mock_telescope_enabled: localStorage.getItem('mock-telescope-enabled') || 'false',
    alpaca_base: localStorage.getItem('alpaca-base') || 'http://localhost:32323/api/v1/telescope/0',
    thingspeak_channel_id: localStorage.getItem('thingspeak-channel-id') || '270748',
    safety_max_wind_speed: localStorage.getItem('safety-max-wind-speed') || '25.0',
    safety_min_temperature: localStorage.getItem('safety-min-temperature') || '-5.0',
    safety_max_temperature: localStorage.getItem('safety-max-temperature') || '45.0',
    safety_max_humidity: localStorage.getItem('safety-max-humidity') || '95.0',
    safety_min_pressure: localStorage.getItem('safety-min-pressure') || '980.0',
    safety_max_pressure: localStorage.getItem('safety-max-pressure') || '1040.0',
    safety_max_dew_point_diff: localStorage.getItem('safety-max-dew-point-diff') || '2.0'
}

// Mock users for auth
const mockUsers = [
    {
        id: '1',
        email: 'teacher@latrobe.edu.au',
        password: 'password123',
        fullName: 'Dr. Jane Smith',
        role: 'teacher',
        phone: '+61 412 345 678',
        institution: 'La Trobe University',
        is2FAEnabled: false,
        notificationsEnabled: true
    },
    {
        id: '2',
        email: 'student@latrobe.edu.au',
        password: 'password123',
        fullName: 'Alex Johnson',
        role: 'student',
        phone: '+61 423 456 789',
        institution: 'Melbourne High School',
        is2FAEnabled: false,
        notificationsEnabled: true
    },
    {
        id: '3',
        email: 'admin@horizondata.edu.au',
        password: 'admin123',
        fullName: 'Horizon Admin',
        role: 'admin',
        phone: '',
        institution: 'La Trobe University',
        is2FAEnabled: false,
        notificationsEnabled: true
    }
]

// In-memory session store (persists during session)
let currentSession = null

// Helper to get current user from session
function getCurrentUser() {
    if (!currentSession) return null
    return mockUsers.find(u => u.id === currentSession.userId) || null
}

// Mock account data (legacy - now derived from user)
const mockAccount = {
    fullName: 'Dr. Jane Smith',
    email: 'jane.smith@latrobe.edu.au',
    phone: '+61 412 345 678',
    institution: 'La Trobe University',
    is2FAEnabled: false,
    notificationsEnabled: true
}

// Helper to format date as DD/MM/YYYY
function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
}

// Helper to format time as HH:MM
function formatTime(date) {
    return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0')
}

// Calculate a session starting in a few minutes (for testing the start workflow)
const now = new Date()
const sessionStart = new Date(now.getTime() + 5 * 60000) // 5 minutes from now
const sessionEnd = new Date(sessionStart.getTime() + 90 * 60000) // 1.5 hours later

// Mock bookings data
const mockBookings = {
    upcoming: [
        {
            id: 99,
            date: formatDate(sessionStart),
            time: `${formatTime(sessionStart)} - ${formatTime(sessionEnd)}`,
            status: 'Confirmed',
            statusColor: 'confirmed',
            headless: false,
            title: 'Test Session - Starting Soon',
            description: 'This mock session starts in 5 minutes.'
        },
        {
            id: 1,
            date: '18/04/2026',
            time: '20:00 - 21:30',
            status: 'Confirmed',
            statusColor: 'confirmed',
            headless: false,
            title: 'Year 9 Science Class',
            description: 'Introduction to telescope operation and lunar observation. Students will learn basic telescope controls and capture images of the Moon.'
        },
        {
            id: 4,
            date: '25/04/2026',
            time: '20:00 - 22:00',
            status: 'Confirmed',
            statusColor: 'confirmed',
            headless: false,
            title: 'ANZAC Day Star Party',
            description: 'Special evening session observing southern hemisphere winter constellations.'
        },
        {
            id: 7,
            date: '30/04/2026',
            time: '22:00 - 23:30',
            status: 'Confirmed',
            statusColor: 'confirmed',
            headless: true,
            title: 'Automated Deep Sky Capture',
            description: 'Headless session — telescope will automatically capture Saturn, Jupiter, and Andromeda Galaxy for student project use.'
        }
    ],
    past: [
        {
            id: 3,
            date: '08/04/2026',
            time: '21:00 - 22:30',
            status: 'Completed',
            statusColor: 'completed',
            title: 'Year 10 - Jupiter Observation',
            description: 'Planetary observation session. Students captured 12 images of Jupiter and its Galilean moons.',
            captureCount: 12
        },
        {
            id: 5,
            date: '01/04/2026',
            time: '22:00 - 23:30',
            status: 'Completed',
            statusColor: 'completed',
            title: 'Introduction to Astrophotography',
            description: 'Basics of long-exposure photography with the telescope.',
            captureCount: 8
        }
    ],
    pending: [
        {
            id: 2,
            date: '22/04/2026',
            time: '19:30 - 21:00',
            status: 'Pending',
            statusColor: 'pending',
            title: 'Evening Star Party',
            description: 'After-school astronomy club session. Deep sky objects including nebulae and star clusters.'
        }
    ]
}

// Mock space objects data
const mockSpaceObjects = [
    {
        id: 'moon',
        name: 'Moon',
        catalog: 'Earth Satellite',
        type: 'Planetary',
        constellation: '—',
        magnitude: -12.7,
        ra: '10h 30m',
        dec: '+11° 30\'',
        altitude: '45°',
        azimuth: '135°',
        bestTime: '20:00 - 02:00',
        visibleNow: true,
        popular: true,
        description: 'Earth\'s only natural satellite. Perfect for beginner observations with stunning surface details visible.',
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/FullMoon2010.jpg/600px-FullMoon2010.jpg'
    },
    {
        id: 'jupiter',
        name: 'Jupiter',
        catalog: 'Planet',
        type: 'Planetary',
        constellation: 'Aries',
        magnitude: -2.5,
        ra: '02h 15m',
        dec: '+12° 20\'',
        altitude: '60°',
        azimuth: '45°',
        bestTime: '19:00 - 04:00',
        visibleNow: true,
        popular: true,
        description: 'The largest planet in our solar system. Features cloud bands, Great Red Spot, and four Galilean moons.',
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/Jupiter_and_its_shrunken_Great_Red_Spot.jpg/600px-Jupiter_and_its_shrunken_Great_Red_Spot.jpg'
    },
    {
        id: 'saturn',
        name: 'Saturn',
        catalog: 'Planet',
        type: 'Planetary',
        constellation: 'Aquarius',
        magnitude: 0.5,
        ra: '22h 45m',
        dec: '-09° 30\'',
        altitude: '35°',
        azimuth: '120°',
        bestTime: '21:00 - 03:00',
        visibleNow: true,
        popular: true,
        description: 'Famous for its spectacular ring system. A favorite among students and observers of all levels.',
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Saturn-27-03-04.jpeg/600px-Saturn-27-03-04.jpeg'
    },
    {
        id: 'm42',
        name: 'Orion Nebula',
        catalog: 'M42 / NGC 1976',
        type: 'Nebula',
        constellation: 'Orion',
        magnitude: 4.0,
        ra: '05h 35m',
        dec: '-05° 23\'',
        altitude: '25°',
        azimuth: '75°',
        bestTime: '21:00 - 03:00',
        visibleNow: false,
        popular: true,
        description: 'The closest massive star-forming region to Earth. Visible as a fuzzy patch below Orion\'s Belt.',
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Orion_Nebula_-_Hubble_2006_mosaic_18000.jpg/600px-Orion_Nebula_-_Hubble_2006_mosaic_18000.jpg'
    },
    {
        id: 'm31',
        name: 'Andromeda Galaxy',
        catalog: 'M31 / NGC 224',
        type: 'Galaxy',
        constellation: 'Andromeda',
        magnitude: 3.4,
        ra: '00h 42m',
        dec: '+41° 16\'',
        altitude: '80°',
        azimuth: '180°',
        bestTime: '19:00 - 06:00',
        visibleNow: true,
        popular: true,
        description: 'The nearest spiral galaxy to our Milky Way. Contains over one trillion stars.',
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Andromeda_Galaxy_560mm.jpg/600px-Andromeda_Galaxy_560mm.jpg'
    },
    {
        id: 'm13',
        name: 'Hercules Cluster',
        catalog: 'M13 / NGC 6205',
        type: 'Stellar',
        constellation: 'Hercules',
        magnitude: 5.8,
        ra: '16h 41m',
        dec: '+36° 28\'',
        altitude: '70°',
        azimuth: '90°',
        bestTime: '20:00 - 04:00',
        visibleNow: false,
        popular: true,
        description: 'One of the brightest globular clusters in the northern sky. Contains hundreds of thousands of stars.',
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Globular_cluster_Messier_13.jpg/600px-Globular_cluster_Messier_13.jpg'
    },
    {
        id: 'm57',
        name: 'Ring Nebula',
        catalog: 'M57 / NGC 6720',
        type: 'Nebula',
        constellation: 'Lyra',
        magnitude: 8.8,
        ra: '18h 53m',
        dec: '+33° 02\'',
        altitude: '55°',
        azimuth: '60°',
        bestTime: '22:00 - 03:00',
        visibleNow: false,
        popular: false,
        description: 'A planetary nebula formed by a dying star. Appears as a smoke ring in the sky.',
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/M57_The_Ring_Nebula.JPG/600px-M57_The_Ring_Nebula.JPG'
    },
    {
        id: 'm27',
        name: 'Dumbbell Nebula',
        catalog: 'M27 / NGC 6853',
        type: 'Nebula',
        constellation: 'Vulpecula',
        magnitude: 7.5,
        ra: '19h 59m',
        dec: '+22° 43\'',
        altitude: '40°',
        azimuth: '100°',
        bestTime: '21:00 - 02:00',
        visibleNow: false,
        popular: false,
        description: 'The first planetary nebula ever discovered. Shaped like an apple core or dumbbell.',
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/M27_-_Dumbbell_Nebula.jpg/600px-M27_-_Dumbbell_Nebula.jpg'
    },
    {
        id: 'mars',
        name: 'Mars',
        catalog: 'Planet',
        type: 'Planetary',
        constellation: 'Gemini',
        magnitude: 1.2,
        ra: '07h 30m',
        dec: '+25° 00\'',
        altitude: '50°',
        azimuth: '110°',
        bestTime: '02:00 - 06:00',
        visibleNow: true,
        popular: false,
        description: 'The Red Planet. Surface features like polar ice caps and dust storms may be visible.',
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/OSIRIS_Mars_true_color.jpg/600px-OSIRIS_Mars_true_color.jpg'
    },
    {
        id: 'venus',
        name: 'Venus',
        catalog: 'Planet',
        type: 'Planetary',
        constellation: 'Pisces',
        magnitude: -4.0,
        ra: '01h 00m',
        dec: '+05° 00\'',
        altitude: '20°',
        azimuth: '280°',
        bestTime: '05:00 - 07:00',
        visibleNow: false,
        popular: false,
        description: 'The brightest planet. Shows phases like the Moon when viewed through telescope.',
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Venus-real_color.jpg/600px-Venus-real_color.jpg'
    },
    {
        id: 'm8',
        name: 'Lagoon Nebula',
        catalog: 'M8 / NGC 6523',
        type: 'Nebula',
        constellation: 'Sagittarius',
        magnitude: 5.0,
        ra: '18h 03m',
        dec: '-24° 23\'',
        altitude: '30°',
        azimuth: '140°',
        bestTime: '22:00 - 04:00',
        visibleNow: false,
        popular: false,
        description: 'A giant interstellar cloud with active star formation. Contains the open cluster NGC 6530.',
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/VST_image_of_the_Lagoon_Nebula.jpg/600px-VST_image_of_the_Lagoon_Nebula.jpg'
    },
    {
        id: 'm45',
        name: 'Pleiades',
        catalog: 'M45',
        type: 'Stellar',
        constellation: 'Taurus',
        magnitude: 1.6,
        ra: '03h 47m',
        dec: '+24° 07\'',
        altitude: '65°',
        azimuth: '70°',
        bestTime: '19:00 - 05:00',
        visibleNow: true,
        popular: true,
        description: 'The Seven Sisters. An open star cluster with reflection nebulosity surrounding young stars.',
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Pleiades_large.jpg/600px-Pleiades_large.jpg'
    }
]

// Admin safety override — null when no override is active
// Shape: { state: 'OPEN' | 'CLOSED', expiresAt: ISO string }
let mockSafetyOverride = null

function resolveAdminSafetyStatus() {
    // If an override exists, check if it has expired
    if (mockSafetyOverride) {
        if (new Date(mockSafetyOverride.expiresAt) <= new Date()) {
            mockSafetyOverride = null
        }
    }
    if (mockSafetyOverride) {
        return {
            status: mockSafetyOverride.state === 'OPEN' ? 'FORCE_OPEN' : 'FORCE_CLOSED',
            source: 'manual',
            override: { state: mockSafetyOverride.state, expiresAt: mockSafetyOverride.expiresAt },
        }
    }
    const hour = new Date().getHours()
    const isNight = hour >= 18 || hour < 6
    return {
        status: isNight ? 'ACTIVE' : 'CLOSED',
        source: 'automatic',
        override: null,
    }
}

// Past sessions (admin view) — static seed; terminate handler pushes into this
const mockPastSessions = [
    { bookingId: 3,  title: 'Year 10 - Jupiter Observation',    teacherName: 'James Okafor',   startedAt: '2026-04-08T21:00:00Z', endedAt: '2026-04-08T22:28:00Z', captureCount: 12, status: 'ended'     },
    { bookingId: 5,  title: 'Introduction to Astrophotography', teacherName: 'Priya Sharma',   startedAt: '2026-04-01T22:00:00Z', endedAt: '2026-04-01T23:31:00Z', captureCount: 8,  status: 'ended'     },
    { bookingId: 10, title: 'Lunar Geology Study',              teacherName: 'Maria Nguyen',   startedAt: '2026-03-05T20:00:00Z', endedAt: '2026-03-05T20:12:00Z', captureCount: 0,  status: 'terminated' },
]

// Mock admin bookings — richer than the teacher-facing mockBookings (mutable in memory)
let mockAdminBookings = [
    { id: 1,  teacherName: 'James Okafor',    title: 'Year 9 Science Class',        date: '2026-04-18', time: '20:00 – 21:30', targets: ['Moon'],                               headless: false, status: 'confirmed' },
    { id: 2,  teacherName: 'Sarah Chen',       title: 'Evening Star Party',           date: '2026-04-22', time: '19:30 – 21:00', targets: ['Saturn', 'Jupiter'],                 headless: false, status: 'pending'   },
    { id: 4,  teacherName: 'Priya Sharma',     title: 'ANZAC Day Star Party',         date: '2026-04-25', time: '20:00 – 22:00', targets: ['Omega Centauri', 'Pleiades'],        headless: false, status: 'confirmed' },
    { id: 7,  teacherName: 'James Okafor',     title: 'Automated Deep Sky Capture',   date: '2026-04-30', time: '22:00 – 23:30', targets: ['Saturn', 'Jupiter', 'Andromeda'],   headless: true,  status: 'confirmed' },
    { id: 8,  teacherName: 'Tom Adeyemi',      title: 'Introduction to Planets',      date: '2026-05-10', time: '20:00 – 21:00', targets: ['Mars'],                              headless: false, status: 'pending'   },
    { id: 9,  teacherName: 'Daniel Kowalski',  title: 'Deep Sky Survey',              date: '2026-05-15', time: '21:00 – 23:00', targets: ['Andromeda', 'Orion Nebula'],         headless: true,  status: 'pending'   },
    { id: 10, teacherName: 'Maria Nguyen',     title: 'Lunar Geology Study',          date: '2026-03-05', time: '20:00 – 21:30', targets: ['Moon'],                              headless: false, status: 'rejected'  },
]

// Observation queue — represents confirmed bookings as execution jobs (mutable)
let mockQueue = [
    { id: 201, title: 'Year 9 Science Class',        teacherName: 'James Okafor',   scheduledAt: '2026-05-13T20:00:00+10:00', targetsCompleted: 1, targetsTotal: 1, status: 'running'  },
    { id: 202, title: 'Evening Star Party',           teacherName: 'Sarah Chen',      scheduledAt: '2026-05-14T19:30:00+10:00', targetsCompleted: 0, targetsTotal: 2, status: 'pending'  },
    { id: 203, title: 'ANZAC Day Star Party',         teacherName: 'Priya Sharma',    scheduledAt: '2026-05-15T20:00:00+10:00', targetsCompleted: 0, targetsTotal: 2, status: 'pending'  },
    { id: 204, title: 'Automated Deep Sky Capture',   teacherName: 'James Okafor',   scheduledAt: '2026-05-15T22:00:00+10:00', targetsCompleted: 0, targetsTotal: 3, status: 'pending'  },
    { id: 205, title: 'Introduction to Planets',      teacherName: 'Tom Adeyemi',     scheduledAt: '2026-05-16T20:00:00+10:00', targetsCompleted: 0, targetsTotal: 1, status: 'pending'  },
    { id: 206, title: 'Intro to Astrophotography',    teacherName: 'Priya Sharma',    scheduledAt: '2026-04-01T22:00:00+10:00', targetsCompleted: 5, targetsTotal: 5, status: 'done'     },
    { id: 207, title: 'Lunar Geology Study',          teacherName: 'Maria Nguyen',    scheduledAt: '2026-03-05T20:00:00+10:00', targetsCompleted: 0, targetsTotal: 1, status: 'aborted'  },
]

// Mock teacher accounts (mutable — approve/suspend actions update this in memory)
const mockTeachers = [
    { id: 101, fullName: 'Sarah Chen',      email: 'sarah.chen@bundoora.edu.au',    institution: 'Bundoora Secondary',   registeredAt: '2026-01-12', status: 'pending'   },
    { id: 102, fullName: 'James Okafor',    email: 'j.okafor@latrobe.edu.au',       institution: 'La Trobe University',  registeredAt: '2026-02-08', status: 'approved'  },
    { id: 103, fullName: 'Maria Nguyen',    email: 'm.nguyen@rmit.edu.au',          institution: 'RMIT University',      registeredAt: '2026-03-01', status: 'suspended' },
    { id: 104, fullName: 'Tom Adeyemi',     email: 'tadeyemi@princes-hill.vic.edu', institution: "Prince's Hill SC",     registeredAt: '2026-03-14', status: 'pending'   },
    { id: 105, fullName: 'Priya Sharma',    email: 'priya.s@monash.edu.au',         institution: 'Monash University',    registeredAt: '2026-04-02', status: 'approved'  },
    { id: 106, fullName: 'Daniel Kowalski', email: 'd.kowalski@melbhs.vic.edu.au',  institution: 'Melbourne High School',registeredAt: '2026-04-20', status: 'pending'   },
]

// Session storage key for persistence across reloads
const SESSION_KEY = 'horizon-session'

// Active sessions with join codes and participants (in-memory store)
// Key: bookingId, Value: { joinCode, participants[], createdAt }
const activeSessions = new Map()

// Maps a student's session id (X-Session-ID) -> bookingId they joined, so
// GET /api/auth/student/session-info can resolve their session's status.
const studentSessions = new Map()

// Mock telescope hardware state
let mockTelescope = {
    connected: false,
    tracking: false,
    parked: true,
    slewing: false,
    ra: 0.0,
    dec: 0.0,
    az: 180.0,
    alt: 45.0
}

// Helper to generate a 6-digit join code
function generateJoinCode() {
    return Math.floor(100000 + Math.random() * 900000).toString()
}

// Helper to get or create a session for a booking
function getOrCreateSession(bookingId) {
    if (!activeSessions.has(bookingId)) {
        const joinCode = generateJoinCode()
        activeSessions.set(bookingId, {
            bookingId: bookingId,
            joinCode: joinCode,
            participants: [],
            createdAt: new Date().toISOString(),
            status: 'waiting' // waiting, active, ended
        })
    }
    return activeSessions.get(bookingId)
}

// Initialize mock sessions with sample data for UX testing
function initializeMockSessions() {
    // Mock students for testing
    const mockStudents = [
        { id: '101', name: 'Emma Wilson', joinedAt: new Date(Date.now() - 5 * 60000).toISOString() },
        { id: '102', name: 'Liam Chen', joinedAt: new Date(Date.now() - 3 * 60000).toISOString() },
        { id: '103', name: 'Sophia Patel', joinedAt: new Date(Date.now() - 2 * 60000).toISOString() },
        { id: '104', name: 'Noah Martinez', joinedAt: new Date(Date.now() - 1 * 60000).toISOString() },
    ]

    // Create a session for booking 99 (Test Session - Starting Soon) with pre-joined students
    activeSessions.set(99, {
        bookingId: 99,
        joinCode: '123456',
        participants: [...mockStudents],
        createdAt: new Date(Date.now() - 10 * 60000).toISOString(),
        status: 'waiting'
    })

    // Create a session for booking 1 (Year 9 Science Class) with a couple students
    activeSessions.set(1, {
        bookingId: 1,
        joinCode: '789012',
        participants: [
            { id: '201', name: 'Oliver Brown', joinedAt: new Date(Date.now() - 8 * 60000).toISOString() },
            { id: '202', name: 'Ava Kim', joinedAt: new Date(Date.now() - 4 * 60000).toISOString() },
        ],
        createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
        status: 'waiting'
    })
}

// Initialize mock data
initializeMockSessions()

// Initialize session from storage on load
if (typeof window !== 'undefined') {
    const stored = sessionStorage.getItem(SESSION_KEY)
    if (stored) {
        try {
            currentSession = JSON.parse(stored)
        } catch {
            currentSession = null
        }
    }
}

// Match any host (localhost, 127.0.0.1, production domains, etc.)
const apiUrl = (path) => {
    // Convert Express-style :params to wildcard segments so the RegExp
    // actually matches real URLs. MSW doesn't populate handler `params`
    // from RegExp routes, so handlers must extract values from request.url.
    const pattern = path.replace(/:[a-zA-Z_][a-zA-Z0-9_]*/g, '[^/]+')
    return new RegExp(`^(https?://[^/]+)?${pattern}(\\?.*)?$`)
}

// Extract the Nth segment of the request URL's pathname (0-based).
// e.g. /api/sessions/99/start -> segment(2) === '99'
function pathSegment(request, index) {
    const { pathname } = new URL(request.url)
    return pathname.split('/').filter(Boolean)[index]
}

export const handlers = [
    // POST /api/auth/teacher/signup - register new teacher
    http.post(apiUrl('/api/auth/teacher/signup'), async ({ request }) => {
        if (!isMswEnabled()) return passthrough()
        await delay(500)
        const { email, password, name } = await request.json()
        if (!email || !password || !name) {
            return HttpResponse.json({ error: 'validation_error', message: 'All fields required' }, { status: 400 })
        }
        if (mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase())) {
            return HttpResponse.json({ error: 'email_exists', message: 'An account with this email already exists' }, { status: 409 })
        }
        const newUser = { id: String(Date.now()), email, fullName: name, role: 'teacher', phone: '', institution: '', is2FAEnabled: false, notificationsEnabled: true }
        mockUsers.push({ ...newUser, password })
        currentSession = { userId: newUser.id, email, createdAt: new Date().toISOString() }
        if (typeof window !== 'undefined') sessionStorage.setItem(SESSION_KEY, JSON.stringify(currentSession))
        const token = `mock-token-${newUser.id}`
        return HttpResponse.json({ success: true, user: { id: newUser.id, email, name, role: 'teacher' }, token, refresh_token: token }, { status: 201 })
    }),

    // POST /api/auth/teacher/login - authenticate teacher
    http.post(apiUrl('/api/auth/teacher/login'), async ({ request }) => {
        if (!isMswEnabled()) return passthrough()
        await delay(500)
        const { email, password } = await request.json()
        const user = mockUsers.find(u => u.email.toLowerCase() === email?.toLowerCase())
        if (!user || user.password !== password) {
            return HttpResponse.json({ error: 'invalid_credentials', message: 'Invalid email or password' }, { status: 401 })
        }
        currentSession = { userId: user.id, email: user.email, createdAt: new Date().toISOString() }
        if (typeof window !== 'undefined') sessionStorage.setItem(SESSION_KEY, JSON.stringify(currentSession))
        const token = `mock-token-${user.id}`
        const { password: _, ...userWithoutPassword } = user
        return HttpResponse.json({ success: true, user: { id: user.id, email: user.email, name: user.fullName, role: user.role }, token, refresh_token: token })
    }),

    // POST /api/auth/teacher/logout - clear session
    http.post(apiUrl('/api/auth/teacher/logout'), async () => {
        if (!isMswEnabled()) return passthrough()
        await delay(200)
        currentSession = null
        if (typeof window !== 'undefined') sessionStorage.removeItem(SESSION_KEY)
        return HttpResponse.json({ success: true })
    }),

    // GET /api/auth/teacher/me - current teacher info
    http.get(apiUrl('/api/auth/teacher/me'), async () => {
        if (!isMswEnabled()) return passthrough()
        await delay(200)
        const user = getCurrentUser()
        if (!user) return HttpResponse.json({ error: 'unauthorized', message: 'Not authenticated' }, { status: 401 })
        return HttpResponse.json({ success: true, user: { id: user.id, email: user.email, name: user.fullName, role: user.role } })
    }),

    // POST /api/auth/teacher/refresh - refresh token
    http.post(apiUrl('/api/auth/teacher/refresh'), async ({ request }) => {
        if (!isMswEnabled()) return passthrough()
        await delay(200)
        const { refresh_token } = await request.json()
        if (!refresh_token) return HttpResponse.json({ error: 'invalid_request', message: 'Refresh token required' }, { status: 400 })
        const user = getCurrentUser()
        if (!user) return HttpResponse.json({ error: 'invalid_token', message: 'Invalid or expired token' }, { status: 401 })
        const token = `mock-token-${user.id}`
        return HttpResponse.json({ success: true, token, refresh_token: token })
    }),

    // POST /api/auth/teacher/reset-password - consume a reset token and set new password
    http.post(apiUrl('/api/auth/teacher/reset-password'), async ({ request }) => {
        if (!isMswEnabled()) return passthrough()
        await delay(500)
        const { token, password } = await request.json()
        if (!token || !password) {
            return HttpResponse.json({ error: 'validation_error', message: 'Token and password required' }, { status: 400 })
        }
        return HttpResponse.json({ success: true })
    }),

    // POST /api/auth/student/join - student joins session
    http.post(apiUrl('/api/auth/student/join'), async ({ request }) => {
        if (!isMswEnabled()) return passthrough()
        await delay(300)
        const { display_name, session_code } = await request.json()
        if (!display_name) return HttpResponse.json({ error: 'validation_error', message: 'Display name required' }, { status: 400 })
        if (!session_code) return HttpResponse.json({ error: 'validation_error', message: 'Session code required' }, { status: 400 })
        // Find matching session
        let matchedSession = null
        for (const [bookingId, session] of activeSessions) {
            if (session.joinCode === session_code) { matchedSession = session; break }
        }
        if (!matchedSession) return HttpResponse.json({ error: 'session_not_found', message: 'Session not found or has ended' }, { status: 404 })
        const studentSessionId = `student-${Date.now()}`
        const obsSessionId = `obs-${matchedSession.bookingId}`
        studentSessions.set(studentSessionId, matchedSession.bookingId)
        return HttpResponse.json({ success: true, session_id: studentSessionId, display_name, observation_session_id: obsSessionId }, { status: 201 })
    }),

    // POST /api/auth/student/leave - student leaves session
    http.post(apiUrl('/api/auth/student/leave'), async () => {
        if (!isMswEnabled()) return passthrough()
        await delay(200)
        return HttpResponse.json({ success: true })
    }),

    // GET /api/auth/student/me - current student info
    http.get(apiUrl('/api/auth/student/me'), async ({ request }) => {
        if (!isMswEnabled()) return passthrough()
        await delay(200)
        const sessionId = request.headers.get('X-Session-ID')
        if (!sessionId) return HttpResponse.json({ error: 'unauthorized', message: 'Not authenticated' }, { status: 401 })
        return HttpResponse.json({
            success: true,
            user: { id: sessionId, display_name: 'Mock Student', observation_session_id: 'obs-mock', user_type: 'student' },
            rate_limits: { captures_remaining: 5 }
        })
    }),

    // GET /api/auth/student/session-info - status + title for the student's
    // joined session. StudentLobby waits for status 'active' to go live;
    // StudentView ejects on 'ended'. Both read top-level `status`/`booking_title`.
    http.get(apiUrl('/api/auth/student/session-info'), async ({ request }) => {
        if (!isMswEnabled()) return passthrough()
        await delay(200)
        const sessionId = request.headers.get('X-Session-ID')
        const bookingId = sessionId ? studentSessions.get(sessionId) : null
        const session = bookingId != null ? activeSessions.get(bookingId) : null
        if (!session) {
            return HttpResponse.json({ error: 'unauthorized', message: 'No active session for this student' }, { status: 401 })
        }
        return HttpResponse.json({
            success: true,
            status: session.status,
            booking_title: `Session HD-${session.bookingId}`,
            observation_session_id: `obs-${session.bookingId}`,
        })
    }),

    // GET /api/auth/teacher/participants - list students in session
    http.get(apiUrl('/api/auth/teacher/participants'), async ({ request }) => {
        if (!isMswEnabled()) return passthrough()
        await delay(200)
        const url = new URL(request.url)
        const obsSessionId = url.searchParams.get('observation_session_id')
        if (!obsSessionId) return HttpResponse.json({ error: 'validation_error', message: 'observation_session_id required' }, { status: 400 })
        const mockParticipants = [
            { id: '101', display_name: 'Emma Wilson', joined_at: new Date(Date.now() - 5 * 60000).toISOString() },
            { id: '102', display_name: 'Liam Chen', joined_at: new Date(Date.now() - 3 * 60000).toISOString() },
        ]
        return HttpResponse.json({ success: true, participants: mockParticipants, count: mockParticipants.length })
    }),

    // POST /api/auth/teacher/kick - kick a student
    http.post(apiUrl('/api/auth/teacher/kick'), async ({ request }) => {
        if (!isMswEnabled()) return passthrough()
        await delay(200)
        const { student_session_id } = await request.json()
        if (!student_session_id) return HttpResponse.json({ error: 'validation_error', message: 'student_session_id required' }, { status: 400 })
        return HttpResponse.json({ success: true, message: 'Student kicked' })
    }),

    // GET /api/auth/rate-limit/captures - student capture rate limit
    http.get(apiUrl('/api/auth/rate-limit/captures'), async () => {
        if (!isMswEnabled()) return passthrough()
        await delay(100)
        return HttpResponse.json({ success: true, limit: 5, remaining: 5, window_seconds: 60 })
    }),

    // GET /api/account - fetch user profile
    http.get(apiUrl('/api/account'), async ({ request }) => {
        if (!isMswEnabled()) {
            return passthrough()
        }
        await delay(300)

        const user = getCurrentUser()
        if (user) {
            const { password: _, ...userWithoutPassword } = user
            return HttpResponse.json(userWithoutPassword)
        }

        // Fallback to legacy mock data if no session
        return HttpResponse.json(mockAccount)
    }),

    // PUT /api/account - update user profile
    http.put(apiUrl('/api/account'), async ({ request }) => {
        if (!isMswEnabled()) {
            return passthrough()
        }
        await delay(500)
        const updatedData = await request.json()
        Object.assign(mockAccount, updatedData)
        return HttpResponse.json({ profile: mockAccount })
    }),

    // GET /api/bookings - fetch user bookings
    http.get(apiUrl('/api/bookings'), async ({ request }) => {
        console.log('[MSW] Intercepted /api/bookings')
        if (!isMswEnabled()) {
            console.log('[MSW] Passthrough /api/bookings')
            return passthrough()
        }
        await delay(400)
        console.log('[MSW] Returning mock bookings')
        return HttpResponse.json(mockBookings)
    }),

    // POST /api/bookings - create new booking
    http.post(apiUrl('/api/bookings'), async ({ request }) => {
        if (!isMswEnabled()) {
            return passthrough()
        }
        await delay(600)
        const newBooking = await request.json()

        // Parse date/time and format for display
        const bookingId = Date.now()
        const [year, month, day] = newBooking.date.split('-')
        const formattedDate = `${day}/${month}/${year}`

        // Handle multiple targets
        const targets = newBooking.targets?.celestialObjects || newBooking.targets || []
        const targetNames = targets.map(t => t.name).join(', ')
        const targetCount = targets.length

        const booking = {
            id: bookingId,
            date: formattedDate,
            time: `${newBooking.startTime} - ${newBooking.endTime}`,
            status: 'Pending',
            statusColor: 'pending',
            title: newBooking.title,
            description: newBooking.description || `Observation session targeting ${targetNames}`,
            targetCount: targetCount,
            targets: targets,
            targetNames: targetNames
        }

        // Add to upcoming bookings
        mockBookings.pending.unshift(booking)

        return HttpResponse.json({
            success: true,
            id: bookingId,
            booking: booking
        }, { status: 201 })
    }),

    // GET /api/bookings/availability - get available time slots for a date range
    // Must be registered BEFORE /api/bookings/:id so the wildcard :id
    // handler doesn't shadow the "availability" segment.
    http.get(apiUrl('/api/bookings/availability'), async ({ request }) => {
        if (!isMswEnabled()) {
            return passthrough()
        }
        await delay(300)

        const url = new URL(request.url)
        const startDate = url.searchParams.get('startDate')
        const endDate = url.searchParams.get('endDate')

        if (!startDate || !endDate) {
            return HttpResponse.json({ error: 'Missing startDate or endDate' }, { status: 400 })
        }

        // Parse dates
        const start = new Date(startDate)
        const end = new Date(endDate)

        // Generate all 30-minute night slots (6 PM - 6 AM) for each day in range
        const availableSlots = []
        const current = new Date(start)

        // Get all existing bookings as flat list for overlap checking
        const allBookings = [
            ...mockBookings.upcoming,
            ...mockBookings.pending,
            ...mockBookings.past
        ]

        // Helper to convert "HH:MM" to minutes since midnight
        const timeToMinutes = (timeStr) => {
            const [h, m] = timeStr.split(':').map(Number)
            return h * 60 + m
        }

        // Helper to check if a slot overlaps with any existing booking
        const isSlotBooked = (dateStr, slotStart, slotEnd) => {
            // Convert slot times to minutes
            const slotStartMin = timeToMinutes(slotStart)
            const slotEndMin = timeToMinutes(slotEnd)

            return allBookings.some(booking => {
                // Parse booking date (stored as DD/MM/YYYY)
                const [day, month, year] = booking.date.split('/')
                const bookingDate = `${year}-${month}-${day}`

                if (bookingDate !== dateStr) return false

                // Parse booking time range (format: "HH:MM - HH:MM")
                const [bookingStart, bookingEnd] = booking.time.split(' - ')
                const bookingStartMin = timeToMinutes(bookingStart)
                const bookingEndMin = timeToMinutes(bookingEnd)

                // Check for overlap: slot starts before booking ends AND slot ends after booking starts
                return slotStartMin < bookingEndMin && slotEndMin > bookingStartMin
            })
        }

        // Generate night time slots for each day
        while (current <= end) {
            const dateStr = current.toISOString().split('T')[0]

            // Evening slots: 18:00 - 23:30
            for (let hour = 18; hour <= 23; hour++) {
                for (let minute = 0; minute < 60; minute += 30) {
                    const startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
                    const endHour = minute === 30 ? hour + 1 : hour
                    const endMinute = minute === 30 ? 0 : 30
                    const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`

                    if (!isSlotBooked(dateStr, startTime, endTime)) {
                        availableSlots.push({ date: dateStr, startTime, endTime })
                    }
                }
            }

            // Early morning slots: 00:00 - 05:30
            for (let hour = 0; hour <= 5; hour++) {
                for (let minute = 0; minute < 60; minute += 30) {
                    const startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
                    const endHour = minute === 30 ? hour + 1 : hour
                    const endMinute = minute === 30 ? 0 : 30
                    const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`

                    if (!isSlotBooked(dateStr, startTime, endTime)) {
                        availableSlots.push({ date: dateStr, startTime, endTime })
                    }
                }
            }

            current.setDate(current.getDate() + 1)
        }

        return HttpResponse.json({
            slots: availableSlots,
            total: availableSlots.length,
            range: { startDate, endDate }
        })
    }),

    // GET /api/bookings/:id - get a single booking
    http.get(apiUrl('/api/bookings/:id'), async ({ request }) => {
        if (!isMswEnabled()) {
            return passthrough()
        }
        await delay(300)

        const bookingId = parseInt(pathSegment(request, 2), 10)
        const allBookings = [
            ...mockBookings.upcoming,
            ...mockBookings.pending,
            ...mockBookings.past
        ]
        const booking = allBookings.find(b => b.id === bookingId)

        if (!booking) {
            return HttpResponse.json({
                success: false,
                error: 'Booking not found'
            }, { status: 404 })
        }

        return HttpResponse.json(booking)
    }),

    // GET /api/space-objects - search/filter celestial objects
    http.get(apiUrl('/api/space-objects'), async ({ request }) => {
        if (!isMswEnabled()) {
            return passthrough()
        }
        await delay(350)

        const url = new URL(request.url)
        const scope = url.searchParams.get('scope') || 'all'
        const visibleNow = url.searchParams.get('visibleNow') === 'true'
        const popular = url.searchParams.get('popular') === 'true'
        const minMag = parseFloat(url.searchParams.get('minMag')) || 0
        const maxMag = parseFloat(url.searchParams.get('maxMag')) || 15
        const search = url.searchParams.get('search')?.toLowerCase() || ''

        let filtered = [...mockSpaceObjects]

        // Filter by scope/type
        if (scope && scope !== 'all') {
            filtered = filtered.filter(obj => {
                const type = obj.type?.toLowerCase() || ''
                switch (scope) {
                    case 'deep': return type === 'nebula' || type === 'galaxy'
                    case 'planetary': return type === 'planetary'
                    case 'stellar': return type === 'stellar'
                    default: return true
                }
            })
        }

        // Filter by visibility
        if (visibleNow) {
            filtered = filtered.filter(obj => obj.visibleNow)
        }

        // Filter by popularity
        if (popular) {
            filtered = filtered.filter(obj => obj.popular)
        }

        // Filter by magnitude range
        filtered = filtered.filter(obj => {
            const mag = obj.magnitude
            return mag !== undefined && mag >= minMag && mag <= maxMag
        })

        // Filter by search query
        if (search) {
            filtered = filtered.filter(obj => {
                const nameMatch = obj.name?.toLowerCase().includes(search)
                const catalogMatch = obj.catalog?.toLowerCase().includes(search)
                const constMatch = obj.constellation?.toLowerCase().includes(search)
                return nameMatch || catalogMatch || constMatch
            })
        }

        return HttpResponse.json({
            items: filtered,
            total: filtered.length,
            filters: { scope, visibleNow, popular, minMag, maxMag, search }
        })
    }),

    // GET /api/visibility/objects - get currently visible celestial objects
    http.get(apiUrl('/api/visibility/objects'), async ({ request }) => {
        console.log('[MSW] Intercepted /api/visibility/objects')
        if (!isMswEnabled()) {
            console.log('[MSW] Passthrough /api/visibility/objects')
            return passthrough()
        }
        await delay(400)

        const url = new URL(request.url)
        const objectType = url.searchParams.get('type')
        const constellation = url.searchParams.get('constellation')
        const minElevation = parseFloat(url.searchParams.get('min_elevation')) || 20
        const limit = parseInt(url.searchParams.get('limit')) || null
        const timeParam = url.searchParams.get('time')

        // Parse requested time or use current time
        const requestedTime = timeParam ? new Date(timeParam) : new Date()
        const hour = requestedTime.getHours()

        // Calculate a progression through the night (0 = 6pm, 1 = 6am)
        // Night window is 6pm (18:00) to 6am (06:00)
        let nightProgress
        if (hour >= 18) {
            nightProgress = (hour - 18) / 12 // Evening: 18-24 -> 0.0 to 0.5
        } else if (hour <= 6) {
            nightProgress = (hour + 6) / 12 // Early morning: 0-6 -> 0.5 to 1.0
        } else {
            nightProgress = 0.5 // Daytime - assume midnight
        }

        // Mock visibility data matching server API format
        // Elevation varies based on time of night to simulate realistic positions
        let visibleObjects = [
            // Planets
            {
                name: "Jupiter",
                type: "Planet",
                baseElevation: 45,
                elevationVariation: 15,
                coordinates: { ra: 22.75, dec: -12.58, azimuth: 220.8 },
                visibility: { is_visible: true, magnitude: -2.5, rise_time: null, set_time: null },
                metadata: { constellation: "Aquarius", distance: "365-601 million km", catalog_id: null, description: "Jupiter is a planet in our solar system" }
            },
            {
                name: "Saturn",
                type: "Planet",
                baseElevation: 35,
                elevationVariation: 20,
                coordinates: { ra: 21.25, dec: -18.75, azimuth: 205.6 },
                visibility: { is_visible: true, magnitude: 0.7, rise_time: null, set_time: null },
                metadata: { constellation: "Capricornus", distance: "1.2 billion km", catalog_id: null, description: "Saturn is a planet in our solar system" }
            },
            {
                name: "Mars",
                type: "Planet",
                baseElevation: 50,
                elevationVariation: 25,
                coordinates: { ra: 14.26, dec: 19.18, azimuth: 180.5 },
                visibility: { is_visible: true, magnitude: -2.1, rise_time: null, set_time: null },
                metadata: { constellation: "Virgo", distance: "54.6-401 million km", catalog_id: null, description: "Mars is a planet in our solar system" }
            },
            {
                name: "Venus",
                type: "Planet",
                baseElevation: 20,
                elevationVariation: 15,
                coordinates: { ra: 16.37, dec: -22.31, azimuth: 195.3 },
                visibility: { is_visible: true, magnitude: -4.2, rise_time: null, set_time: null },
                metadata: { constellation: "Scorpius", distance: "38-261 million km", catalog_id: null, description: "Venus is a planet in our solar system" }
            },
            // Bright Stars
            {
                name: "Sirius",
                type: "Star",
                baseElevation: 40,
                elevationVariation: 35,
                coordinates: { ra: 6.75, dec: -16.72, azimuth: 120.3 },
                visibility: { is_visible: true, magnitude: -1.46, rise_time: null, set_time: null },
                metadata: { constellation: "Canis Major", distance: "8.6 ly", catalog_id: null, description: "Sirius is a bright star" }
            },
            {
                name: "Vega",
                type: "Star",
                baseElevation: 70,
                elevationVariation: 25,
                coordinates: { ra: 18.62, dec: 38.78, azimuth: 295.4 },
                visibility: { is_visible: true, magnitude: 0.03, rise_time: null, set_time: null },
                metadata: { constellation: "Lyra", distance: "25 ly", catalog_id: null, description: "Vega is a bright star" }
            },
            {
                name: "Betelgeuse",
                type: "Star",
                baseElevation: 55,
                elevationVariation: 20,
                coordinates: { ra: 5.92, dec: 7.41, azimuth: 85.2 },
                visibility: { is_visible: true, magnitude: 0.50, rise_time: null, set_time: null },
                metadata: { constellation: "Orion", distance: "650 ly", catalog_id: null, description: "Betelgeuse is a bright star" }
            },
            {
                name: "Rigel",
                type: "Star",
                baseElevation: 45,
                elevationVariation: 25,
                coordinates: { ra: 5.24, dec: -8.20, azimuth: 95.7 },
                visibility: { is_visible: true, magnitude: 0.13, rise_time: null, set_time: null },
                metadata: { constellation: "Orion", distance: "860 ly", catalog_id: null, description: "Rigel is a bright star" }
            },
            // Nebulae
            {
                name: "Orion Nebula",
                type: "Emission Nebula",
                baseElevation: 40,
                elevationVariation: 30,
                coordinates: { ra: 5.59, dec: -5.39, azimuth: 95.2 },
                visibility: { is_visible: true, magnitude: 4.0, rise_time: null, set_time: null },
                metadata: { constellation: "Orion", distance: "1344 ly", catalog_id: "M42", description: "Orion Nebula is a emission nebula" }
            },
            {
                name: "Ring Nebula",
                type: "Planetary Nebula",
                baseElevation: 55,
                elevationVariation: 20,
                coordinates: { ra: 18.89, dec: 33.03, azimuth: 275.4 },
                visibility: { is_visible: true, magnitude: 8.8, rise_time: null, set_time: null },
                metadata: { constellation: "Lyra", distance: "2300 ly", catalog_id: "M57", description: "Ring Nebula is a planetary nebula" }
            },
            {
                name: "Eagle Nebula",
                type: "Emission Nebula",
                baseElevation: 35,
                elevationVariation: 25,
                coordinates: { ra: 18.32, dec: -13.83, azimuth: 245.8 },
                visibility: { is_visible: true, magnitude: 6.4, rise_time: null, set_time: null },
                metadata: { constellation: "Serpens", distance: "7000 ly", catalog_id: "M16", description: "Eagle Nebula is a emission nebula" }
            },
            // Galaxies
            {
                name: "Andromeda Galaxy",
                type: "Spiral Galaxy",
                baseElevation: 55,
                elevationVariation: 25,
                coordinates: { ra: 0.71, dec: 41.27, azimuth: 35.7 },
                visibility: { is_visible: true, magnitude: 3.4, rise_time: null, set_time: null },
                metadata: { constellation: "Andromeda", distance: "2.5 Mly", catalog_id: "M31", description: "Andromeda Galaxy is a spiral galaxy" }
            },
            {
                name: "Large Magellanic Cloud",
                type: "Irregular Galaxy",
                baseElevation: 40,
                elevationVariation: 30,
                coordinates: { ra: 5.24, dec: -69.00, azimuth: 185.3 },
                visibility: { is_visible: true, magnitude: 0.9, rise_time: null, set_time: null },
                metadata: { constellation: "Dorado", distance: "160000 ly", catalog_id: "LMC", description: "Large Magellanic Cloud is a irregular galaxy" }
            },
            {
                name: "Whirlpool Galaxy",
                type: "Spiral Galaxy",
                baseElevation: 30,
                elevationVariation: 20,
                coordinates: { ra: 13.50, dec: 47.20, azimuth: 315.7 },
                visibility: { is_visible: true, magnitude: 8.4, rise_time: null, set_time: null },
                metadata: { constellation: "Canes Venatici", distance: "23 Mly", catalog_id: "M51", description: "Whirlpool Galaxy is a spiral galaxy" }
            },
            // Star Clusters
            {
                name: "Omega Centauri",
                type: "Globular Cluster",
                baseElevation: 35,
                elevationVariation: 30,
                coordinates: { ra: 13.45, dec: -47.48, azimuth: 165.4 },
                visibility: { is_visible: true, magnitude: 3.7, rise_time: null, set_time: null },
                metadata: { constellation: "Centaurus", distance: "15800 ly", catalog_id: "NGC 5139", description: "Omega Centauri is a globular cluster" }
            },
            {
                name: "The Pleiades",
                type: "Open Cluster",
                baseElevation: 65,
                elevationVariation: 20,
                coordinates: { ra: 3.79, dec: 24.12, azimuth: 70.5 },
                visibility: { is_visible: true, magnitude: 1.6, rise_time: null, set_time: null },
                metadata: { constellation: "Taurus", distance: "444 ly", catalog_id: "M45", description: "The Pleiades is a open cluster" }
            },
            {
                name: "Jewel Box Cluster",
                type: "Open Cluster",
                baseElevation: 25,
                elevationVariation: 25,
                coordinates: { ra: 12.74, dec: -59.86, azimuth: 175.3 },
                visibility: { is_visible: true, magnitude: 4.2, rise_time: null, set_time: null },
                metadata: { constellation: "Crux", distance: "6440 ly", catalog_id: "NGC 4755", description: "Jewel Box Cluster is a open cluster" }
            }
        ]

        // Calculate elevation for each object based on time of night
        // Using a sine wave pattern: starts at base - variation, peaks at transit (midpoint), ends at base - variation
        visibleObjects = visibleObjects.map(obj => {
            // Calculate elevation using sine wave: peak at middle of night (0.5)
            // Objects rise in east (lower elevation early), transit (highest), set in west (lower elevation late)
            const angle = (nightProgress - 0.5) * Math.PI // -PI/2 to PI/2
            const elevation = obj.baseElevation + Math.cos(angle) * obj.elevationVariation

            // Calculate rise/set times based on the mock progression
            const sessionDate = new Date(requestedTime)
            const riseTime = new Date(sessionDate)
            riseTime.setHours(18 + (0.5 - obj.elevationVariation/100) * 6) // Earlier for high variation
            const setTime = new Date(sessionDate)
            setTime.setHours(18 + 12 - (0.5 - obj.elevationVariation/100) * 6) // Later for high variation

            return {
                ...obj,
                coordinates: {
                    ...obj.coordinates,
                    elevation: Math.max(0, elevation) // Don't go below horizon
                },
                visibility: {
                    ...obj.visibility,
                    elevation: Math.max(0, elevation),
                    is_visible: elevation > 20,
                    rise_time: elevation > 20 ? riseTime.toISOString() : null,
                    set_time: elevation > 20 ? setTime.toISOString() : null
                }
            }
        })

        // Filter by type if specified
        if (objectType) {
            visibleObjects = visibleObjects.filter(obj =>
                obj.type.toLowerCase().includes(objectType.toLowerCase())
            )
        }

        // Filter by constellation if specified
        if (constellation) {
            visibleObjects = visibleObjects.filter(obj =>
                obj.metadata.constellation.toLowerCase() === constellation.toLowerCase()
            )
        }

        // Filter by minimum elevation
        visibleObjects = visibleObjects.filter(obj =>
            obj.coordinates.elevation >= minElevation
        )

        // Sort by elevation (highest first)
        visibleObjects.sort((a, b) => b.coordinates.elevation - a.coordinates.elevation)

        // Apply limit
        if (limit) {
            visibleObjects = visibleObjects.slice(0, limit)
        }

        return HttpResponse.json({
            timestamp: requestedTime.toISOString(),
            location: { latitude: -37.7214, longitude: 145.0489, name: "Melbourne, Australia" },
            objects: visibleObjects,
            totalCount: visibleObjects.length,
            filters: { type: objectType, constellation, min_elevation: minElevation, limit, time: timeParam }
        })
    }),

    // GET /api/visibility/objects/<name> - get specific object visibility
    http.get(apiUrl('/api/visibility/objects/:name'), async ({ request }) => {
        if (!isMswEnabled()) {
            return passthrough()
        }
        await delay(300)

        const objectName = decodeURIComponent(pathSegment(request, 3))

        // Get all visible objects
        const url = new URL(request.url)
        const baseUrl = url.origin + '/api/visibility/objects'
        const allResponse = await fetch(baseUrl)
        const allData = await allResponse.json()
        const allObjects = allData.objects || []

        // Find specific object
        const objectInfo = allObjects.find(obj =>
            obj.name.toLowerCase() === objectName.toLowerCase()
        )

        if (!objectInfo) {
            return HttpResponse.json({
                success: false,
                error: 'object_not_visible',
                message: `Object "${objectName}" is not currently visible or not found`
            }, { status: 404 })
        }

        return HttpResponse.json({
            timestamp: new Date().toISOString(),
            object: objectInfo
        })
    }),

    // GET /api/visibility/types - get available object types
    http.get(apiUrl('/api/visibility/types'), async ({ request }) => {
        if (!isMswEnabled()) {
            return passthrough()
        }
        await delay(200)

        const types = ["Planet", "Star", "Emission Nebula", "Planetary Nebula", "Dark Nebula",
                      "Spiral Galaxy", "Irregular Galaxy", "Elliptical Galaxy",
                      "Globular Cluster", "Open Cluster"]

        return HttpResponse.json({
            success: true,
            types: types,
            totalTypes: types.length
        })
    }),

    // GET /api/visibility/constellations - get constellations with visible objects
    http.get(apiUrl('/api/visibility/constellations'), async ({ request }) => {
        if (!isMswEnabled()) {
            return passthrough()
        }
        await delay(200)

        const constellations = ["Aquarius", "Andromeda", "Canes Venatici", "Canis Major",
                               "Capricornus", "Centaurus", "Crux", "Dorado", "Leo",
                               "Lyra", "Orion", "Serpens", "Scorpius", "Taurus", "Virgo"]

        return HttpResponse.json({
            success: true,
            constellations: constellations,
            totalConstellations: constellations.length
        })
    }),

    // POST /api/sessions/:id/join - student joins a session with join code
    http.post(apiUrl('/api/sessions/:id/join'), async ({ request }) => {
        if (!isMswEnabled()) {
            return passthrough()
        }
        await delay(300)

        const bookingId = parseInt(pathSegment(request, 2), 10)
        const body = await request.json()
        const { joinCode, name } = body

        const session = activeSessions.get(bookingId)

        if (!session) {
            return HttpResponse.json({
                success: false,
                error: 'Session not found'
            }, { status: 404 })
        }

        if (session.joinCode !== joinCode) {
            return HttpResponse.json({
                success: false,
                error: 'Invalid join code'
            }, { status: 403 })
        }

        // Anonymous students: no auth required. Generate a participant id
        // so reloads/rejoins each show up as a separate student in the mock.
        const participant = {
            id: `anon-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            name: name?.trim() || `Student ${session.participants.length + 1}`,
            joinedAt: new Date().toISOString()
        }
        session.participants.push(participant)

        return HttpResponse.json({
            success: true,
            message: 'Joined session successfully',
            session: {
                bookingId: session.bookingId,
                joinCode: session.joinCode,
                status: session.status
            }
        })
    }),

    // GET /api/sessions/:id/participants - list participants in a session
    http.get(apiUrl('/api/sessions/:id/participants'), async ({ request }) => {
        if (!isMswEnabled()) {
            return passthrough()
        }
        await delay(200)

        const bookingId = parseInt(pathSegment(request, 2), 10)
        console.log('[MSW] GET /api/sessions/:id/participants - bookingId:', bookingId)

        const session = activeSessions.get(bookingId)

        if (!session) {
            console.log('[MSW] No session found, returning empty participants')
            return HttpResponse.json({
                success: true,
                participants: [],
                total: 0
            })
        }

        console.log('[MSW] Returning participants:', session.participants)
        return HttpResponse.json({
            success: true,
            participants: session.participants,
            total: session.participants.length
        })
    }),

    // GET /api/sessions/:id - get session details (join code, status)
    http.get(apiUrl('/api/sessions/:id'), async ({ request }) => {
        if (!isMswEnabled()) {
            return passthrough()
        }
        await delay(200)

        const bookingId = parseInt(pathSegment(request, 2), 10)
        console.log('[MSW] GET /api/sessions/:id - bookingId:', bookingId)
        console.log('[MSW] activeSessions:', Array.from(activeSessions.entries()))

        const session = getOrCreateSession(bookingId)
        console.log('[MSW] Returning session:', session)

        return HttpResponse.json({
            success: true,
            session: {
                bookingId: session.bookingId,
                joinCode: session.joinCode,
                status: session.status,
                participantCount: session.participants.length,
                createdAt: session.createdAt
            }
        })
    }),

    // POST /api/sessions/lookup - find session by join code
    http.post(apiUrl('/api/sessions/lookup'), async ({ request }) => {
        if (!isMswEnabled()) {
            return passthrough()
        }
        await delay(200)

        const body = await request.json()
        const { joinCode } = body

        if (!joinCode) {
            return HttpResponse.json({
                success: false,
                error: 'Join code required'
            }, { status: 400 })
        }

        // Search through active sessions to find matching join code
        for (const [bookingId, session] of activeSessions) {
            if (session.joinCode === joinCode) {
                return HttpResponse.json({
                    success: true,
                    bookingId: bookingId,
                    status: session.status
                })
            }
        }

        return HttpResponse.json({
            success: false,
            error: 'Invalid join code'
        }, { status: 404 })
    }),

    // POST /api/sessions/:id/start - start the session (teacher)
    http.post(apiUrl('/api/sessions/:id/start'), async ({ request }) => {
        if (!isMswEnabled()) {
            return passthrough()
        }
        await delay(300)

        const bookingId = parseInt(pathSegment(request, 2), 10)
        const session = activeSessions.get(bookingId)

        if (!session) {
            return HttpResponse.json({
                success: false,
                error: 'Session not found'
            }, { status: 404 })
        }

        session.status = 'active'
        session.startedAt = new Date().toISOString()

        return HttpResponse.json({
            success: true,
            session: {
                bookingId: session.bookingId,
                joinCode: session.joinCode,
                status: session.status,
                startedAt: session.startedAt
            }
        })
    }),

    // ── Captures ───────────────────────────────────────────────────────────────

    http.post(apiUrl('/api/captures'), async () => {
        if (!isMswEnabled()) return passthrough()
        await delay(600)
        return HttpResponse.json({
            success: true,
            id: 'mock123abc456',
            downloadUrl: '/api/captures/mock123abc456/download',
            capturedBy: 'teacher',
        }, { status: 201 })
    }),

    http.get(apiUrl('/api/captures'), async ({ request }) => {
        if (!isMswEnabled()) return passthrough()

        const MOCK_CAPTURES = [
            {
                id: 'mock001',
                objectName: 'Saturn',
                timestamp: '2026-05-07T18:32:00.000Z',
                observationSessionId: '1',
                coordinates: { ra: 123.4, dec: 67.9, alt: 45.0, az: 180.0 },
                capturedBy: 'teacher',
                capturedByTeacherId: 'teacher-1',
                capturedByStudentSessionId: null,
            },
            {
                id: 'mock002',
                objectName: 'Jupiter',
                timestamp: '2026-05-06T20:15:00.000Z',
                observationSessionId: '2',
                coordinates: { ra: 45.2, dec: -11.3, alt: 38.0, az: 220.0 },
                capturedBy: 'student',
                capturedByTeacherId: null,
                capturedByStudentSessionId: 'anon-123',
            },
            {
                id: 'mock003',
                objectName: 'Saturn',
                timestamp: '2026-05-05T19:00:00.000Z',
                observationSessionId: '1',
                coordinates: null,
                capturedBy: 'teacher',
                capturedByTeacherId: 'teacher-1',
                capturedByStudentSessionId: null,
            },
        ]

        const url = new URL(request.url)
        const obsId = url.searchParams.get('observationSessionId')
        const items = obsId
            ? MOCK_CAPTURES.filter(c => String(c.observationSessionId) === obsId)
            : MOCK_CAPTURES

        return HttpResponse.json({ items })
    }),

    http.get(apiUrl('/api/captures/:id/download'), async () => {
        if (!isMswEnabled()) return passthrough()
        // Minimal 1×1 white PNG
        const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg=='
        const bin = atob(b64)
        const bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
        return new HttpResponse(bytes, {
            headers: {
                'Content-Type': 'image/png',
                'Content-Disposition': 'attachment; filename="mock_capture.png"',
            },
        })
    }),

    http.get(apiUrl('/api/captures/:id/metadata'), async () => {
        if (!isMswEnabled()) return passthrough()
        const json = JSON.stringify({
            id: 'mock123abc456',
            objectName: 'Saturn',
            timestamp: new Date().toISOString(),
            coordinates: { ra: 123.4, dec: 67.9, alt: 45.0, az: 180.0 },
            capturedBy: 'teacher',
        })
        return new HttpResponse(json, {
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': 'attachment; filename="mock_capture.json"',
            },
        })
    }),

    // ── Sessions ───────────────────────────────────────────────────────────────

    // POST /api/sessions/:id/end - end a session
    http.post(apiUrl('/api/sessions/:id/end'), async ({ request }) => {
        if (!isMswEnabled()) return passthrough()
        await delay(300)
        const bookingId = parseInt(pathSegment(request, 2), 10)
        const session = activeSessions.get(bookingId)
        if (!session) return HttpResponse.json({ error: 'not_found', message: 'No active session for this booking' }, { status: 404 })
        session.status = 'ended'
        session.endedAt = new Date().toISOString()
        return HttpResponse.json({ success: true })
    }),

    // ── Visibility ─────────────────────────────────────────────────────────────

    // GET /api/visibility/session - session-optimised targets for booking wizard
    http.get(apiUrl('/api/visibility/session'), async ({ request }) => {
        if (!isMswEnabled()) return passthrough()
        await delay(400)
        const url = new URL(request.url)
        const startTime = url.searchParams.get('start_time') || new Date().toISOString()
        const endTime = url.searchParams.get('end_time') || new Date().toISOString()
        return HttpResponse.json({
            success: true,
            session: {
                start_time: startTime,
                end_time: endTime,
                duration_hours: 0.5,
                moon_phase: 'waxing_crescent',
                moon_illumination: 28,
                dark_sky_quality: 'good'
            },
            targets: [
                {
                    name: 'Jupiter', type: 'Planet',
                    coordinates: { ra: 22.75, dec: -12.58, ra_hours: 22.75, dec_degrees: -12.58 },
                    elevation_max: 58.0, elevation_min: 38.0, elevation_start: 42.0, elevation_end: 55.0,
                    magnitude: -2.5, quality_grade: 'excellent', quality_score: 0.92,
                    transits_during_session: false, transit_time: null, visible_entire_session: true,
                    sets_during_session: false, best_time: '22:30', recommendation: 'Excellent — high altitude',
                    constellation: 'Aquarius', catalog_id: null
                },
                {
                    name: 'Saturn', type: 'Planet',
                    coordinates: { ra: 21.15, dec: -18.75, ra_hours: 21.15, dec_degrees: -18.75 },
                    elevation_max: 45.0, elevation_min: 28.0, elevation_start: 35.0, elevation_end: 43.0,
                    magnitude: 0.7, quality_grade: 'good', quality_score: 0.78,
                    transits_during_session: false, transit_time: null, visible_entire_session: true,
                    sets_during_session: false, best_time: '21:45', recommendation: 'Good — rings visible',
                    constellation: 'Capricornus', catalog_id: null
                },
                {
                    name: 'Mars', type: 'Planet',
                    coordinates: { ra: 14.26, dec: 19.18, ra_hours: 14.26, dec_degrees: 19.18 },
                    elevation_max: 50.0, elevation_min: 30.0, elevation_start: 45.0, elevation_end: 38.0,
                    magnitude: -2.1, quality_grade: 'good', quality_score: 0.74,
                    transits_during_session: true, transit_time: '21:15', visible_entire_session: true,
                    sets_during_session: false, best_time: '21:15', recommendation: 'Good — near transit',
                    constellation: 'Virgo', catalog_id: null
                },
                {
                    name: 'Orion Nebula', type: 'Emission Nebula',
                    coordinates: { ra: 5.59, dec: -5.39, ra_hours: 5.59, dec_degrees: -5.39 },
                    elevation_max: 42.0, elevation_min: 22.0, elevation_start: 25.0, elevation_end: 40.0,
                    magnitude: 4.0, quality_grade: 'fair', quality_score: 0.55,
                    transits_during_session: false, transit_time: null, visible_entire_session: true,
                    sets_during_session: false, best_time: '23:00', recommendation: 'Fair — rising during session',
                    constellation: 'Orion', catalog_id: 'M42'
                },
                {
                    name: 'Andromeda Galaxy', type: 'Spiral Galaxy',
                    coordinates: { ra: 0.71, dec: 41.27, ra_hours: 0.71, dec_degrees: 41.27 },
                    elevation_max: 55.0, elevation_min: 45.0, elevation_start: 50.0, elevation_end: 53.0,
                    magnitude: 3.4, quality_grade: 'excellent', quality_score: 0.88,
                    transits_during_session: false, transit_time: null, visible_entire_session: true,
                    sets_during_session: false, best_time: '22:00', recommendation: 'Excellent — high and steady',
                    constellation: 'Andromeda', catalog_id: 'M31'
                },
                {
                    name: 'The Pleiades', type: 'Open Cluster',
                    coordinates: { ra: 3.79, dec: 24.12, ra_hours: 3.79, dec_degrees: 24.12 },
                    elevation_max: 65.0, elevation_min: 50.0, elevation_start: 55.0, elevation_end: 63.0,
                    magnitude: 1.6, quality_grade: 'excellent', quality_score: 0.95,
                    transits_during_session: false, transit_time: null, visible_entire_session: true,
                    sets_during_session: false, best_time: '22:45', recommendation: 'Excellent — ideal altitude',
                    constellation: 'Taurus', catalog_id: 'M45'
                },
            ]
        })
    }),

    // ── Telescope Control ──────────────────────────────────────────────────────

    // GET /api/telescope/status
    http.get(apiUrl('/api/telescope/status'), async () => {
        if (!isMockTelescopeEnabled()) return passthrough()
        await delay(150)
        return HttpResponse.json({ ...mockTelescope })
    }),

    // POST /api/telescope/connect
    http.post(apiUrl('/api/telescope/connect'), async ({ request }) => {
        if (!isMockTelescopeEnabled()) return passthrough()
        await delay(400)
        const { connected } = await request.json()
        mockTelescope.connected = Boolean(connected)
        if (!connected) { mockTelescope.tracking = false; mockTelescope.parked = true }
        return HttpResponse.json({ ...mockTelescope })
    }),

    // POST /api/telescope/tracking
    http.post(apiUrl('/api/telescope/tracking'), async ({ request }) => {
        if (!isMockTelescopeEnabled()) return passthrough()
        await delay(300)
        if (!mockTelescope.connected) return HttpResponse.json({ error: 'not_connected', message: 'Telescope must be connected first' }, { status: 400 })
        const { on } = await request.json()
        mockTelescope.tracking = Boolean(on)
        return HttpResponse.json({ ...mockTelescope })
    }),

    // POST /api/telescope/park
    http.post(apiUrl('/api/telescope/park'), async ({ request }) => {
        if (!isMockTelescopeEnabled()) return passthrough()
        await delay(600)
        if (!mockTelescope.connected) return HttpResponse.json({ error: 'not_connected', message: 'Telescope must be connected first' }, { status: 400 })
        const { action } = await request.json()
        if (action === 'park') { mockTelescope.parked = true; mockTelescope.tracking = false }
        else if (action === 'unpark') { mockTelescope.parked = false }
        else return HttpResponse.json({ error: 'invalid_request', message: 'Action must be "park" or "unpark"' }, { status: 400 })
        return HttpResponse.json({ ...mockTelescope })
    }),

    // POST /api/telescope/abort
    http.post(apiUrl('/api/telescope/abort'), async () => {
        if (!isMockTelescopeEnabled()) return passthrough()
        await delay(200)
        mockTelescope.slewing = false
        return HttpResponse.json({ ...mockTelescope })
    }),

    // POST /api/telescope/slew/coords
    http.post(apiUrl('/api/telescope/slew/coords'), async ({ request }) => {
        if (!isMockTelescopeEnabled()) return passthrough()
        await delay(800)
        if (!mockTelescope.connected) return HttpResponse.json({ error: 'not_connected', message: 'Telescope must be connected first' }, { status: 400 })
        const { ra, dec } = await request.json()
        mockTelescope.slewing = true
        mockTelescope.ra = ra
        mockTelescope.dec = dec
        // Simulate slew completing
        await delay(1200)
        mockTelescope.slewing = false
        mockTelescope.alt = 45 + Math.random() * 20
        mockTelescope.az = Math.random() * 360
        return HttpResponse.json({ ...mockTelescope })
    }),

    // POST /api/telescope/slew/altaz
    http.post(apiUrl('/api/telescope/slew/altaz'), async ({ request }) => {
        if (!isMockTelescopeEnabled()) return passthrough()
        await delay(800)
        if (!mockTelescope.connected) return HttpResponse.json({ error: 'not_connected', message: 'Telescope must be connected first' }, { status: 400 })
        const { az, alt } = await request.json()
        mockTelescope.slewing = true
        mockTelescope.az = az
        mockTelescope.alt = alt
        await delay(1200)
        mockTelescope.slewing = false
        return HttpResponse.json({ ...mockTelescope })
    }),

    // GET /api/telescope/visible-objects
    http.get(apiUrl('/api/telescope/visible-objects'), async () => {
        if (!isMockTelescopeEnabled()) return passthrough()
        await delay(350)
        return HttpResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            location: { latitude: -37.7214, longitude: 145.0489, name: 'Melbourne, Australia' },
            objects: [
                { name: 'Jupiter', type: 'Planet', coordinates: { elevation: 58.0, azimuth: 220.8 }, visibility: { magnitude: -2.5, is_visible: true, observability_rating: 'Excellent', duration_hours: 6.0 } },
                { name: 'Saturn', type: 'Planet', coordinates: { elevation: 45.0, azimuth: 205.6 }, visibility: { magnitude: 0.7, is_visible: true, observability_rating: 'Good', duration_hours: 4.5 } },
                { name: 'Mars', type: 'Planet', coordinates: { elevation: 50.0, azimuth: 180.5 }, visibility: { magnitude: -2.1, is_visible: true, observability_rating: 'Good', duration_hours: 5.0 } },
                { name: 'Andromeda Galaxy', type: 'Spiral Galaxy', coordinates: { elevation: 55.0, azimuth: 35.7 }, visibility: { magnitude: 3.4, is_visible: true, observability_rating: 'Excellent', duration_hours: 6.5 } },
                { name: 'The Pleiades', type: 'Open Cluster', coordinates: { elevation: 65.0, azimuth: 70.5 }, visibility: { magnitude: 1.6, is_visible: true, observability_rating: 'Excellent', duration_hours: 7.0 } },
            ],
            totalCount: 5,
            safety_status: { status: 'ACTIVE', reason: 'Telescope operations available', filtered: false }
        })
    }),

    // POST /api/telescope/select - slew to named space object
    http.post(apiUrl('/api/telescope/select'), async ({ request }) => {
        if (!isMockTelescopeEnabled()) return passthrough()
        await delay(500)
        const { objectId } = await request.json()
        if (!objectId) return HttpResponse.json({ success: false, error: 'missing_field', message: 'objectId is required' }, { status: 400 })
        const names = { moon: 'Moon', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn', venus: 'Venus', vega: 'Vega', sirius: 'Sirius', m42: 'Orion Nebula (M42)', m31: 'Andromeda Galaxy (M31)', polaris: 'Polaris (North Star)' }
        const name = names[objectId]
        if (!name) return HttpResponse.json({ success: false, error: 'object_not_found', message: `Space object '${objectId}' does not exist` }, { status: 404 })
        mockTelescope.slewing = true
        return HttpResponse.json({
            success: true,
            message: `Telescope moving to ${name}`,
            objectId, objectName: name,
            targetCoordinates: { rightAscension: '22h 45m', declination: '-12° 35\'', altitude: 45.0, azimuth: 220.8 },
            estimatedTime: 5, status: 'slewing'
        })
    }),

    // ── Safety ─────────────────────────────────────────────────────────────────

    // GET /api/safety/status
    http.get(apiUrl('/api/safety/status'), async () => {
        if (!isMockTelescopeEnabled()) return passthrough()
        await delay(200)
        const { status } = resolveAdminSafetyStatus()
        const hour = new Date().getHours()
        const isNight = hour >= 18 || hour < 6
        const effectiveActive = status === 'ACTIVE' || status === 'FORCE_OPEN'
        return HttpResponse.json({
            status: effectiveActive ? 'ACTIVE' : 'CLOSED',
            reason: mockSafetyOverride
                ? `Manual override: force ${mockSafetyOverride.state.toLowerCase()}`
                : isNight ? 'Within viewing window' : 'Outside nighttime viewing window',
            next_available: effectiveActive ? null : 'Tonight at 18:00',
            current_time: new Date().toISOString(),
            viewing_window: { start: '18:00', end: '06:00', is_active: effectiveActive }
        })
    }),

    // GET /api/safety/comprehensive
    http.get(apiUrl('/api/safety/comprehensive'), async () => {
        if (!isMockTelescopeEnabled()) return passthrough()
        await delay(250)
        const hour = new Date().getHours()
        const isNight = hour >= 18 || hour < 6
        const status = isNight ? 'ACTIVE' : 'CLOSED'
        return HttpResponse.json({
            overall: { status, reason: isNight ? 'All systems nominal' : 'Outside viewing window' },
            time_safety: { safe: isNight, current_time: new Date().toISOString(), in_viewing_window: isNight },
            weather_safety: {
                safe: true,
                conditions: {
                    temperature: 18.5,
                    humidity: 45,
                    pressure: 1013,
                    dew_point: 7.2,
                    wind_speed: 12.4,
                    rain_detected: false,
                    light_level: isNight ? 0.003 : 52.1,
                },
                thresholds_met: true,
            },
            last_updated: new Date().toISOString()
        })
    }),

    // GET /api/admin/safety/status — richer status for admin widget (source + override)
    http.get(apiUrl('/api/admin/safety/status'), async () => {
        if (!isMockTelescopeEnabled()) return passthrough()
        await delay(150)
        return HttpResponse.json(resolveAdminSafetyStatus())
    }),

    // POST /api/admin/safety/override — body: { state: 'OPEN'|'CLOSED', durationMins: number }
    http.post(apiUrl('/api/admin/safety/override'), async ({ request }) => {
        if (!isMockTelescopeEnabled()) return passthrough()
        await delay(180)
        const { state, durationMins } = await request.json()
        if (!['OPEN', 'CLOSED'].includes(state) || !durationMins || durationMins <= 0) {
            return HttpResponse.json({ error: 'invalid_params' }, { status: 400 })
        }
        const expiresAt = new Date(Date.now() + durationMins * 60 * 1000).toISOString()
        mockSafetyOverride = { state, expiresAt }
        return HttpResponse.json(resolveAdminSafetyStatus())
    }),

    // DELETE /api/admin/safety/override — clear the current override
    http.delete(apiUrl('/api/admin/safety/override'), async () => {
        if (!isMockTelescopeEnabled()) return passthrough()
        await delay(150)
        mockSafetyOverride = null
        return HttpResponse.json(resolveAdminSafetyStatus())
    }),

    // GET /api/admin/queue — observation job queue
    http.get(apiUrl('/api/admin/queue'), async () => {
        if (!isMockTelescopeEnabled()) return passthrough()
        await delay(180)
        return HttpResponse.json(mockQueue)
    }),

    // POST /api/admin/queue/:id/abort — abort a pending or running job
    http.post(apiUrl('/api/admin/queue/:id/abort'), async ({ request }) => {
        if (!isMockTelescopeEnabled()) return passthrough()
        await delay(200)
        const id = parseInt(pathSegment(request, 3), 10)
        const job = mockQueue.find(q => q.id === id)
        if (!job) return HttpResponse.json({ error: 'not_found' }, { status: 404 })
        if (!['pending', 'running'].includes(job.status)) {
            return HttpResponse.json({ error: 'invalid_state' }, { status: 409 })
        }
        job.status = 'aborted'
        return HttpResponse.json({ id: job.id, status: job.status })
    }),

    // GET /api/admin/sessions/active — live list of active sessions (polled)
    http.get(apiUrl('/api/admin/sessions/active'), async () => {
        if (!isMswEnabled()) return passthrough()
        await delay(150)
        const result = []
        for (const [bookingId, session] of activeSessions) {
            if (session.status === 'ended') continue
            const booking = mockAdminBookings.find(b => b.id === bookingId) ?? {}
            result.push({
                bookingId,
                title:        booking.title      ?? `Session #${bookingId}`,
                teacherName:  booking.teacherName ?? 'Unknown',
                startedAt:    session.createdAt,
                studentCount: session.participants.length,
                joinCode:     session.joinCode,
                status:       session.status,
            })
        }
        return HttpResponse.json(result)
    }),

    // POST /api/admin/sessions/:id/terminate
    http.post(apiUrl('/api/admin/sessions/:id/terminate'), async ({ params }) => {
        if (!isMswEnabled()) return passthrough()
        await delay(200)
        const bookingId = parseInt(params.id, 10)
        const session = activeSessions.get(bookingId)
        if (!session) return HttpResponse.json({ error: 'not_found' }, { status: 404 })
        const booking = mockAdminBookings.find(b => b.id === bookingId) ?? {}
        mockPastSessions.unshift({
            bookingId,
            title:        booking.title      ?? `Session #${bookingId}`,
            teacherName:  booking.teacherName ?? 'Unknown',
            startedAt:    session.createdAt,
            endedAt:      new Date().toISOString(),
            captureCount: 0,
            status:       'terminated',
        })
        activeSessions.delete(bookingId)
        return HttpResponse.json({ success: true })
    }),

    // GET /api/admin/sessions/past
    http.get(apiUrl('/api/admin/sessions/past'), async () => {
        if (!isMswEnabled()) return passthrough()
        await delay(200)
        return HttpResponse.json(mockPastSessions)
    }),

    // GET /api/admin/stats — aggregate numbers for the admin dashboard
    http.get(apiUrl('/api/admin/stats'), async () => {
        if (!isMswEnabled()) return passthrough()
        await delay(180)
        const MS_PER_DAY = 86400000

        // Pending accounts detail — oldest pending teacher
        const pendingTeachers = mockTeachers
            .filter(t => t.status === 'pending')
            .sort((a, b) => a.registeredAt.localeCompare(b.registeredAt))
        const oldestTeacher = pendingTeachers[0] ?? null

        // Pending bookings detail — earliest pending booking by date
        const pendingBookings = mockAdminBookings
            .filter(b => b.status === 'pending')
            .sort((a, b) => a.date.localeCompare(b.date))
        const nextBooking = pendingBookings[0] ?? null

        // Active sessions detail — total students + one sample session
        let totalStudents = 0
        let sampleSession = null
        for (const [bookingId, session] of activeSessions) {
            if (session.status === 'ended') continue
            totalStudents += session.participants.length
            if (!sampleSession) {
                const booking = mockAdminBookings.find(b => b.id === bookingId)
                if (booking) sampleSession = { title: booking.title, teacher: booking.teacherName }
            }
        }

        return HttpResponse.json({
            pending_accounts: pendingTeachers.length,
            pending_accounts_detail: oldestTeacher ? {
                oldest_name:        oldestTeacher.fullName,
                oldest_institution: oldestTeacher.institution,
                oldest_days:        Math.floor((Date.now() - new Date(oldestTeacher.registeredAt)) / MS_PER_DAY),
            } : null,

            pending_bookings: pendingBookings.length,
            pending_bookings_detail: nextBooking ? {
                next_title:   nextBooking.title,
                next_date:    nextBooking.date,
                next_teacher: nextBooking.teacherName,
            } : null,

            active_sessions: [...activeSessions.values()].filter(s => s.status !== 'ended').length,
            active_sessions_detail: {
                total_students: totalStudents,
                sample_title:   sampleSession?.title   ?? null,
                sample_teacher: sampleSession?.teacher ?? null,
            },
        })
    }),

    // GET /api/admin/bookings
    http.get(apiUrl('/api/admin/bookings'), async ({ request }) => {
        if (!isMswEnabled()) return passthrough()
        await delay(220)
        const status = new URL(request.url).searchParams.get('status')
        const results = status ? mockAdminBookings.filter(b => b.status === status) : mockAdminBookings
        return HttpResponse.json(results)
    }),

    // POST /api/admin/bookings/:id/confirm
    http.post(apiUrl('/api/admin/bookings/:id/confirm'), async ({ params }) => {
        if (!isMswEnabled()) return passthrough()
        await delay(150)
        const b = mockAdminBookings.find(b => b.id === parseInt(params.id, 10))
        if (!b) return HttpResponse.json({ error: 'not_found' }, { status: 404 })
        b.status = 'confirmed'
        return HttpResponse.json({ id: b.id, status: b.status })
    }),

    // POST /api/admin/bookings/:id/reject  — body: { reason }
    http.post(apiUrl('/api/admin/bookings/:id/reject'), async ({ params, request }) => {
        if (!isMswEnabled()) return passthrough()
        await delay(150)
        const b = mockAdminBookings.find(b => b.id === parseInt(params.id, 10))
        if (!b) return HttpResponse.json({ error: 'not_found' }, { status: 404 })
        const body = await request.json().catch(() => ({}))
        b.status = 'rejected'
        b.rejectReason = body.reason ?? ''
        return HttpResponse.json({ id: b.id, status: b.status })
    }),

    // POST /api/admin/bookings/:id/cancel
    http.post(apiUrl('/api/admin/bookings/:id/cancel'), async ({ params }) => {
        if (!isMswEnabled()) return passthrough()
        await delay(150)
        const b = mockAdminBookings.find(b => b.id === parseInt(params.id, 10))
        if (!b) return HttpResponse.json({ error: 'not_found' }, { status: 404 })
        b.status = 'cancelled'
        return HttpResponse.json({ id: b.id, status: b.status })
    }),

    // GET /api/admin/teachers — list all teacher accounts
    http.get(apiUrl('/api/admin/teachers'), async ({ request }) => {
        if (!isMswEnabled()) return passthrough()
        await delay(220)
        const url = new URL(request.url)
        const statusFilter = url.searchParams.get('status')
        const results = statusFilter
            ? mockTeachers.filter(t => t.status === statusFilter)
            : mockTeachers
        return HttpResponse.json(results)
    }),

    // POST /api/admin/teachers/:id/approve
    http.post(apiUrl('/api/admin/teachers/:id/approve'), async ({ params }) => {
        if (!isMswEnabled()) return passthrough()
        await delay(150)
        const teacher = mockTeachers.find(t => t.id === parseInt(params.id, 10))
        if (!teacher) return HttpResponse.json({ error: 'not_found' }, { status: 404 })
        teacher.status = 'approved'
        return HttpResponse.json({ id: teacher.id, status: teacher.status })
    }),

    // POST /api/admin/teachers/:id/suspend
    http.post(apiUrl('/api/admin/teachers/:id/suspend'), async ({ params }) => {
        if (!isMswEnabled()) return passthrough()
        await delay(150)
        const teacher = mockTeachers.find(t => t.id === parseInt(params.id, 10))
        if (!teacher) return HttpResponse.json({ error: 'not_found' }, { status: 404 })
        teacher.status = 'suspended'
        return HttpResponse.json({ id: teacher.id, status: teacher.status })
    }),

    // GET /api/settings — Retrieve mock settings
    http.get(apiUrl('/api/settings'), async () => {
        if (!isMswEnabled() && !isMockTelescopeEnabled()) return passthrough()
        await delay(100)
        return HttpResponse.json(mockSettings)
    }),

    // PUT /api/settings — Update mock settings
    http.put(apiUrl('/api/settings'), async ({ request }) => {
        if (!isMswEnabled() && !isMockTelescopeEnabled()) return passthrough()
        await delay(150)
        const data = await request.json()
        Object.assign(mockSettings, data)
        // Sync to localStorage
        for (const [key, val] of Object.entries(data)) {
            localStorage.setItem(key.replace(/_/g, '-'), val)
        }
        return HttpResponse.json(mockSettings)
    }),
]
