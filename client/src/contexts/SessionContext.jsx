/**
 * React Context for managing session state.
 * Provides session data, student info, and actions for joining/creating/ending sessions.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as sessionApi from '../api/sessions';

// Storage keys for session recovery
const STORAGE_KEYS = {
    sessionId: 'sessionId',
    studentId: 'studentId',
    studentName: 'studentName',
    isTeacher: 'isTeacher'
};

const SessionContext = createContext(null);

/**
 * Provider component for session state management.
 */
export function SessionProvider({ children }) {
    const [session, setSession] = useState(null);
    const [student, setStudent] = useState(null);
    const [isTeacher, setIsTeacher] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    /**
     * Check for stored session on mount and try to recover.
     */
    useEffect(() => {
        async function recoverSession() {
            const storedSessionId = localStorage.getItem(STORAGE_KEYS.sessionId);
            const storedStudentId = localStorage.getItem(STORAGE_KEYS.studentId);
            const storedStudentName = localStorage.getItem(STORAGE_KEYS.studentName);
            const storedIsTeacher = localStorage.getItem(STORAGE_KEYS.isTeacher);

            if (storedSessionId) {
                try {
                    const response = await sessionApi.getSession(storedSessionId);
                    if (response.success) {
                        setSession(response.session);

                        if (storedIsTeacher === 'true') {
                            setIsTeacher(true);
                        } else if (storedStudentId && storedStudentName) {
                            // Verify student is still in session
                            const studentInRoster = response.session.students?.find(
                                s => s.id === storedStudentId
                            );
                            if (studentInRoster) {
                                setStudent(studentInRoster);
                            } else {
                                // Student was removed or session reset
                                clearSessionStorage();
                            }
                        }
                    } else {
                        clearSessionStorage();
                    }
                } catch (err) {
                    console.error('Failed to recover session:', err);
                    clearSessionStorage();
                }
            }

            setIsLoading(false);
        }

        recoverSession();
    }, []);

    /**
     * Clear session-related localStorage.
     */
    const clearSessionStorage = () => {
        Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
    };

    /**
     * Store session info in localStorage.
     */
    const storeSessionInfo = useCallback((sessionId, studentId = null, studentName = null, teacher = false) => {
        localStorage.setItem(STORAGE_KEYS.sessionId, sessionId);
        localStorage.setItem(STORAGE_KEYS.isTeacher, teacher ? 'true' : 'false');
        if (studentId) {
            localStorage.setItem(STORAGE_KEYS.studentId, studentId);
        }
        if (studentName) {
            localStorage.setItem(STORAGE_KEYS.studentName, studentName);
        }
    }, []);

    /**
     * Create a new session (teacher).
     */
    const createSession = useCallback(async (data) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await sessionApi.createSession(data);

            if (response.success) {
                setSession(response.session);
                setIsTeacher(true);
                storeSessionInfo(response.session.id, null, null, true);
                return { success: true, session: response.session };
            } else {
                setError(response.message || 'Failed to create session');
                return { success: false, message: response.message };
            }
        } catch (err) {
            const message = err.message || 'Network error';
            setError(message);
            return { success: false, message };
        } finally {
            setIsLoading(false);
        }
    }, [storeSessionInfo]);

    /**
     * Join a session as a student.
     */
    const joinSession = useCallback(async (joinCode, studentName) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await sessionApi.joinSession(joinCode, studentName);

            if (response.success) {
                setSession(response.session);
                setStudent(response.student);
                setIsTeacher(false);
                storeSessionInfo(response.sessionId, response.studentId, studentName, false);
                return {
                    success: true,
                    session: response.session,
                    student: response.student
                };
            } else {
                setError(response.message || 'Failed to join session');
                return { success: false, message: response.message };
            }
        } catch (err) {
            const message = err.message || 'Network error';
            setError(message);
            return { success: false, message };
        } finally {
            setIsLoading(false);
        }
    }, [storeSessionInfo]);

    /**
     * Start the session (teacher only).
     */
    const startSession = useCallback(async () => {
        if (!session || !isTeacher) return { success: false, message: 'Not authorized' };

        setIsLoading(true);
        setError(null);

        try {
            const response = await sessionApi.startSession(session.id);

            if (response.success) {
                setSession(response.session);
                return { success: true, session: response.session };
            } else {
                setError(response.message || 'Failed to start session');
                return { success: false, message: response.message };
            }
        } catch (err) {
            const message = err.message || 'Network error';
            setError(message);
            return { success: false, message };
        } finally {
            setIsLoading(false);
        }
    }, [session, isTeacher]);

    /**
     * End the session (teacher only).
     */
    const endSession = useCallback(async () => {
        if (!session || !isTeacher) return { success: false, message: 'Not authorized' };

        setIsLoading(true);
        setError(null);

        try {
            const response = await sessionApi.endSession(session.id);

            if (response.success) {
                setSession(response.session);
                clearSessionStorage();
                return { success: true, session: response.session };
            } else {
                setError(response.message || 'Failed to end session');
                return { success: false, message: response.message };
            }
        } catch (err) {
            const message = err.message || 'Network error';
            setError(message);
            return { success: false, message };
        } finally {
            setIsLoading(false);
        }
    }, [session, isTeacher]);

    /**
     * Leave the session gracefully (student only).
     */
    const leaveSession = useCallback(async () => {
        if (!session || !student) return { success: false, message: 'Not in session' };

        setIsLoading(true);
        setError(null);

        try {
            const response = await sessionApi.leaveSession(session.id, student.id);

            if (response.success) {
                setSession(null);
                setStudent(null);
                setIsTeacher(false);
                clearSessionStorage();
                return { success: true };
            } else {
                setError(response.message || 'Failed to leave session');
                return { success: false, message: response.message };
            }
        } catch (err) {
            const message = err.message || 'Network error';
            setError(message);
            return { success: false, message };
        } finally {
            setIsLoading(false);
        }
    }, [session, student]);

    /**
     * Refresh session data from the server.
     */
    const refreshSession = useCallback(async () => {
        if (!session) return null;

        try {
            const response = await sessionApi.getSession(session.id);

            if (response.success) {
                setSession(response.session);

                // Update student info if we're a student
                if (student && response.session.students) {
                    const updatedStudent = response.session.students.find(
                        s => s.id === student.id
                    );
                    if (updatedStudent) {
                        setStudent(updatedStudent);
                    }
                }

                return response.session;
            } else {
                // Session no longer exists
                setSession(null);
                setStudent(null);
                clearSessionStorage();
                return null;
            }
        } catch (err) {
            console.error('Failed to refresh session:', err);
            return null;
        }
    }, [session, student]);

    /**
     * Clear the current error.
     */
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    /**
     * Clear the entire session (logout/reset).
     */
    const clearSession = useCallback(() => {
        setSession(null);
        setStudent(null);
        setIsTeacher(false);
        setError(null);
        clearSessionStorage();
    }, []);

    const value = {
        // State
        session,
        student,
        isTeacher,
        isLoading,
        error,

        // Actions
        createSession,
        joinSession,
        startSession,
        endSession,
        leaveSession,
        refreshSession,
        clearError,
        clearSession
    };

    return (
        <SessionContext.Provider value={value}>
            {children}
        </SessionContext.Provider>
    );
}

/**
 * Hook to access the session context.
 * @returns {Object} Session context value
 */
export function useSession() {
    const context = useContext(SessionContext);
    if (!context) {
        throw new Error('useSession must be used within a SessionProvider');
    }
    return context;
}
