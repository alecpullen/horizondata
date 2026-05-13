/**
 * Session API client for managing sessions and student joining.
 * @module api/sessions
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

/**
 * Create a new session (teacher).
 * @param {Object} data - Session creation data
 * @param {string} data.teacherId - Teacher identifier
 * @param {string} data.objectName - Target celestial object
 * @param {string} data.telescope - Telescope location/name
 * @param {string} [data.bookingId] - Optional booking reference
 * @returns {Promise<Object>} Created session with join code
 */
export async function createSession(data) {
    const res = await fetch(`${API_URL}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || `Failed to create session: ${res.status}`);
    }

    return res.json();
}

/**
 * Get session details by ID.
 * @param {string} sessionId - The session UUID
 * @returns {Promise<Object>} Session details including student roster
 */
export async function getSession(sessionId) {
    const res = await fetch(`${API_URL}/api/sessions/${sessionId}`);

    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || `Failed to get session: ${res.status}`);
    }

    return res.json();
}

/**
 * Validate a join code (lightweight check).
 * @param {string} joinCode - The 6-digit join code
 * @returns {Promise<Object>} Validation result { valid, status?, sessionId?, reason? }
 */
export async function validateJoinCode(joinCode) {
    const res = await fetch(`${API_URL}/api/sessions/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joinCode })
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || `Validation failed: ${res.status}`);
    }
    return res.json();
}

/**
 * Join a session as a student.
 * @param {string} joinCode - The 6-digit join code
 * @param {string} studentName - The student's name
 * @returns {Promise<Object>} Join result with session and student IDs
 */
export async function joinSession(joinCode, studentName) {
    const res = await fetch(`${API_URL}/api/sessions/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joinCode, studentName })
    });

    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || `Failed to join session: ${res.status}`);
    }

    return res.json();
}

/**
 * Get student roster for a session (lightweight polling).
 * @param {string} sessionId - The session UUID
 * @returns {Promise<Object>} Student roster { students, count }
 */
export async function getRoster(sessionId) {
    const res = await fetch(`${API_URL}/api/sessions/${sessionId}/roster`);

    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || `Failed to get roster: ${res.status}`);
    }

    return res.json();
}

/**
 * Start a session (teacher).
 * @param {string} sessionId - The session UUID
 * @returns {Promise<Object>} Updated session
 */
export async function startSession(sessionId) {
    const res = await fetch(`${API_URL}/api/sessions/${sessionId}/start`, {
        method: 'POST'
    });

    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || `Failed to start session: ${res.status}`);
    }

    return res.json();
}

/**
 * End a session (teacher).
 * @param {string} sessionId - The session UUID
 * @returns {Promise<Object>} Updated session
 */
export async function endSession(sessionId) {
    const res = await fetch(`${API_URL}/api/sessions/${sessionId}/end`, {
        method: 'POST'
    });

    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || `Failed to end session: ${res.status}`);
    }

    return res.json();
}

/**
 * Leave a session gracefully (student).
 * @param {string} sessionId - The session UUID
 * @param {string} studentId - The student's ID
 * @returns {Promise<Object>} Leave result
 */
export async function leaveSession(sessionId, studentId) {
    const res = await fetch(`${API_URL}/api/sessions/${sessionId}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId })
    });

    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || `Failed to leave session: ${res.status}`);
    }

    return res.json();
}
