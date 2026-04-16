// Email validation
export const validateEmail = (email) => {
    if (!email || email.trim() === '') {
        return { isValid: false, error: 'Email is required' }
    }

    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!regex.test(email)) {
        return { isValid: false, error: 'Please enter a valid email address' }
    }

    return { isValid: true, error: '' }
}

// Password validation with detailed requirements
export const validatePassword = (password) => {
    if (!password) {
        return {
            isValid: false,
            strength: 0,
            errors: {
                minLength: true,
                upper: true,
                lower: true,
                number: true,
                special: true
            }
        }
    }

    const minLength = 8
    const hasUpper = /[A-Z]/.test(password)
    const hasLower = /[a-z]/.test(password)
    const hasNumber = /\d/.test(password)
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password)

    const meetsMinLength = password.length >= minLength

    // Calculate strength (0-4)
    let strength = 0
    if (meetsMinLength) strength++
    if (hasUpper && hasLower) strength++
    if (hasNumber) strength++
    if (hasSpecial) strength++

    // Valid if meets all basic requirements
    const isValid = meetsMinLength && hasUpper && hasLower && hasNumber

    return {
        isValid,
        strength,
        errors: {
            minLength: !meetsMinLength,
            upper: !hasUpper,
            lower: !hasLower,
            number: !hasNumber,
            special: !hasSpecial
        }
    }
}

// Check if two passwords match
export const doPasswordsMatch = (password, confirmPassword) => {
    if (!confirmPassword) {
        return { isValid: false, error: 'Please confirm your password' }
    }

    if (password !== confirmPassword) {
        return { isValid: false, error: 'Passwords do not match' }
    }

    return { isValid: true, error: '' }
}

// Required field validation
export const validateRequired = (value, fieldName = 'This field') => {
    if (!value || value.trim() === '') {
        return { isValid: false, error: `${fieldName} is required` }
    }
    return { isValid: true, error: '' }
}

// Error types for auth forms
export const AUTH_ERROR_TYPES = {
    INVALID_CREDENTIALS: 'Invalid email or password',
    NETWORK_ERROR: 'Connection failed. Please check your internet and try again.',
    ACCOUNT_LOCKED: 'Account temporarily locked. Try again in 15 minutes.',
    EMAIL_NOT_VERIFIED: 'Please verify your email before logging in.',
    RATE_LIMITED: 'Too many attempts. Please wait before trying again.',
    UNKNOWN: 'An unexpected error occurred. Please try again.'
}

// Get error message from error type
export const getAuthErrorMessage = (errorType) => {
    return AUTH_ERROR_TYPES[errorType] || AUTH_ERROR_TYPES.UNKNOWN
}
