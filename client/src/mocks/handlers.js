import { http, HttpResponse, delay, passthrough } from 'msw'

// Check if MSW is enabled (stored in localStorage)
function isMswEnabled() {
    // Default to true if not set
    const stored = localStorage.getItem('msw-enabled')
    return stored === null ? true : stored === 'true'
}

// Mock account data
const mockAccount = {
    fullName: 'Dr. Jane Smith',
    email: 'jane.smith@latrobe.edu.au',
    phone: '+61 412 345 678',
    institution: 'La Trobe University',
    is2FAEnabled: false,
    notificationsEnabled: true
}

// Mock bookings data
const mockBookings = {
    upcoming: [
        {
            id: 1,
            date: '18/04/2026',
            time: '09:00 - 10:30',
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
            time: '10:00 - 11:30',
            status: 'Completed',
            statusColor: 'completed',
            title: 'Year 10 - Jupiter Observation',
            description: 'Planetary observation session. Students captured 12 images of Jupiter and its Galilean moons.',
            captureCount: 12
        },
        {
            id: 5,
            date: '01/04/2026',
            time: '14:00 - 15:30',
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

// Match any host (localhost, 127.0.0.1, etc.)
const apiUrl = (path) => {
    // Match both full URLs and relative paths
    return new RegExp(`^(http://[^/]+)?${path}$`)
}

export const handlers = [
    // GET /api/account - fetch user profile
    http.get(apiUrl('/api/account'), async ({ request }) => {
        if (!isMswEnabled()) {
            return passthrough()
        }
        await delay(300)
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
        if (!isMswEnabled()) {
            return passthrough()
        }
        await delay(400)
        return HttpResponse.json(mockBookings)
    }),
]
