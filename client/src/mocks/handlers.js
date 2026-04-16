import { http, HttpResponse, delay, passthrough } from 'msw'

// Check if MSW is enabled (stored in localStorage)
function isMswEnabled() {
    // Default to true if not set
    const stored = localStorage.getItem('msw-enabled')
    const enabled = stored === null ? true : stored === 'true'
    console.log('[MSW] isMswEnabled:', enabled, '(stored:', stored, ')')
    return enabled
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
            title: 'Test Session - Starting Soon',
            description: 'This mock session starts in 5 minutes.'
        },
        {
            id: 1,
            date: '18/04/2026',
            time: '20:00 - 21:30',
            status: 'Confirmed',
            statusColor: 'confirmed',
            title: 'Year 9 Science Class',
            description: 'Introduction to telescope operation and lunar observation. Students will learn basic telescope controls and capture images of the Moon.'
        },
        {
            id: 4,
            date: '25/04/2026',
            time: '20:00 - 22:00',
            status: 'Confirmed',
            statusColor: 'confirmed',
            title: 'ANZAC Day Star Party',
            description: 'Special evening session observing southern hemisphere winter constellations.'
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

// Session storage key for persistence across reloads
const SESSION_KEY = 'horizon-session'

// Active sessions with join codes and participants (in-memory store)
// Key: bookingId, Value: { joinCode, participants[], createdAt }
const activeSessions = new Map()

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
    // POST /api/auth/login - authenticate user
    http.post(apiUrl('/api/auth/login'), async ({ request }) => {
        if (!isMswEnabled()) {
            return passthrough()
        }
        await delay(500)

        const body = await request.json()
        const { email, password } = body

        const user = mockUsers.find(u => u.email.toLowerCase() === email?.toLowerCase())

        if (!user || user.password !== password) {
            return HttpResponse.json({
                success: false,
                error: 'Invalid email or password'
            }, { status: 401 })
        }

        // Create session
        currentSession = {
            userId: user.id,
            email: user.email,
            createdAt: new Date().toISOString()
        }

        // Persist to sessionStorage
        if (typeof window !== 'undefined') {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(currentSession))
        }

        // Return user info (without password)
        const { password: _, ...userWithoutPassword } = user
        return HttpResponse.json({
            success: true,
            user: userWithoutPassword
        })
    }),

    // POST /api/auth/logout - clear session
    http.post(apiUrl('/api/auth/logout'), async ({ request }) => {
        if (!isMswEnabled()) {
            return passthrough()
        }
        await delay(200)

        currentSession = null
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem(SESSION_KEY)
        }

        return HttpResponse.json({ success: true })
    }),

    // GET /api/auth/session - check current session
    http.get(apiUrl('/api/auth/session'), async ({ request }) => {
        if (!isMswEnabled()) {
            return passthrough()
        }
        await delay(200)

        const user = getCurrentUser()

        if (!user) {
            return HttpResponse.json({
                authenticated: false
            }, { status: 401 })
        }

        const { password: _, ...userWithoutPassword } = user
        return HttpResponse.json({
            authenticated: true,
            user: userWithoutPassword
        })
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
        return HttpResponse.json(mockAccount)
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
        const targets = newBooking.targets || []
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
    // VISIBILITY ROUTES - PASSTHROUGH to real Flask backend for testing
    // (Other routes remain mocked)

    // GET /api/visibility/objects - get currently visible celestial objects
    http.get(apiUrl('/api/visibility/objects'), async ({ request }) => {
        console.log('[MSW] Passthrough /api/visibility/objects')
        return passthrough()
    }),

    // GET /api/visibility/objects/<name> - get specific object visibility
    // PASSTHROUGH to real backend for testing
    http.get(apiUrl('/api/visibility/objects/:name'), async ({ request }) => {
        console.log('[MSW] Passthrough /api/visibility/objects/:name')
        return passthrough()
    }),

    // GET /api/visibility/types - get available object types
    // PASSTHROUGH to real backend for testing
    http.get(apiUrl('/api/visibility/types'), async ({ request }) => {
        console.log('[MSW] Passthrough /api/visibility/types')
        return passthrough()
    }),

    // GET /api/visibility/constellations - get constellations with visible objects
    // PASSTHROUGH to real backend for testing
    http.get(apiUrl('/api/visibility/constellations'), async ({ request }) => {
        console.log('[MSW] Passthrough /api/visibility/constellations')
        return passthrough()
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
]
