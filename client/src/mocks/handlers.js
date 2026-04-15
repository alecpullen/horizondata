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

// Match any host (localhost, 127.0.0.1, etc.)
const apiUrl = (path) => {
    // Match both full URLs and relative paths
    return new RegExp(`^(http://[^/]+)?${path}(\\?.*)?$`)
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

        const booking = {
            id: bookingId,
            date: formattedDate,
            time: `${newBooking.startTime} - ${newBooking.endTime}`,
            status: 'Pending',
            statusColor: 'pending',
            title: newBooking.title,
            description: newBooking.description || `Observation session targeting ${newBooking.targetName}`,
            targetId: newBooking.targetId,
            targetName: newBooking.targetName
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
]
