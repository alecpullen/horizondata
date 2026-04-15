import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthShell from '../components/auth/AuthShell'
import { useToast } from '../components/ui/ToastProvider'
import { validateEmail, validatePassword, doPasswordsMatch, validateRequired } from '../utils/validation'
import './Register.css'

function Register() {
    const { showToast } = useToast()
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'student',
        agreeToTerms: false
    })

    const [touched, setTouched] = useState({})
    const [errors, setErrors] = useState({})
    const [isLoading, setIsLoading] = useState(false)

    const validateField = (name, value) => {
        switch (name) {
            case 'fullName':
                return validateRequired(value, 'Full name')
            case 'email':
                return validateEmail(value)
            case 'password':
                return { isValid: validatePassword(value).isValid, error: '' }
            case 'confirmPassword':
                return doPasswordsMatch(formData.password, value)
            case 'agreeToTerms':
                return value
                    ? { isValid: true, error: '' }
                    : { isValid: false, error: 'You must agree to the terms' }
            default:
                return { isValid: true, error: '' }
        }
    }

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target
        const newValue = type === 'checkbox' ? checked : value

        setFormData(prev => ({ ...prev, [name]: newValue }))

        if (touched[name]) {
            const validation = validateField(name, newValue)
            setErrors(prev => ({ ...prev, [name]: validation.error }))
        }
    }

    const handleBlur = (e) => {
        const { name, value } = e.target
        setTouched(prev => ({ ...prev, [name]: true }))
        const validation = validateField(name, value)
        setErrors(prev => ({ ...prev, [name]: validation.error }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        // Validate all fields
        const newErrors = {}
        let isValid = true

        Object.keys(formData).forEach(key => {
            const validation = validateField(key, formData[key])
            if (!validation.isValid) {
                newErrors[key] = validation.error
                isValid = false
            }
        })

        setErrors(newErrors)
        setTouched({
            fullName: true,
            email: true,
            password: true,
            confirmPassword: true,
            agreeToTerms: true
        })

        if (!isValid) return

        setIsLoading(true)

        // Simulate API call
        await new Promise(r => setTimeout(r, 1000))

        if (formData.role === 'teacher') {
            showToast({ type: 'success', message: 'Registration submitted for approval!' })
            window.location.href = '/pending-approval'
        } else {
            showToast({ type: 'success', message: 'Registration successful! Please verify your email.' })
            window.location.href = '/verify-email?email=' + encodeURIComponent(formData.email)
        }
    }

    const passwordValidation = validatePassword(formData.password)

    const footer = (
        <>
            Already have an account?{' '}
            <Link to="/login" className="auth-link">Sign in</Link>
        </>
    )

    return (
        <AuthShell
            title="Create account"
            subtitle="Join to access remote telescope sessions"
            footer={footer}
        >
            <form className="register-form" onSubmit={handleSubmit}>
                {/* Full Name */}
                <div className="register-field">
                    <label className="register-label" htmlFor="fullName">Full Name</label>
                    <input
                        id="fullName"
                        name="fullName"
                        type="text"
                        className={`register-input ${errors.fullName && touched.fullName ? 'register-input--error' : ''}`}
                        placeholder="Your full name"
                        value={formData.fullName}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        disabled={isLoading}
                    />
                    {errors.fullName && touched.fullName && (
                        <span className="register-field__error">{errors.fullName}</span>
                    )}
                </div>

                {/* Email */}
                <div className="register-field">
                    <label className="register-label" htmlFor="email">Email</label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        className={`register-input ${errors.email && touched.email ? 'register-input--error' : ''}`}
                        placeholder="you@school.edu"
                        value={formData.email}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        disabled={isLoading}
                    />
                    {errors.email && touched.email && (
                        <span className="register-field__error">{errors.email}</span>
                    )}
                </div>

                {/* Password */}
                <div className="register-field">
                    <label className="register-label" htmlFor="password">Password</label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        className={`register-input ${errors.password && touched.password ? 'register-input--error' : ''}`}
                        placeholder="Create a strong password"
                        value={formData.password}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        disabled={isLoading}
                    />

                    {/* Password strength meter */}
                    <div className="password-strength">
                        <div className="password-strength__bars">
                            {[1, 2, 3, 4].map((level) => (
                                <div
                                    key={level}
                                    className={`password-strength__bar ${
                                        passwordValidation.strength >= level ? `password-strength__bar--${passwordValidation.strength}` : ''
                                    }`}
                                />
                            ))}
                        </div>
                        <span className="password-strength__label">
                            {passwordValidation.strength === 0 && 'Weak'}
                            {passwordValidation.strength === 1 && 'Fair'}
                            {passwordValidation.strength === 2 && 'Good'}
                            {passwordValidation.strength === 3 && 'Strong'}
                            {passwordValidation.strength === 4 && 'Very Strong'}
                        </span>
                    </div>

                    {/* Password requirements checklist */}
                    <div className="password-requirements">
                        <div className={`password-requirement ${!passwordValidation.errors.minLength ? 'password-requirement--met' : ''}`}>
                            <span className="password-requirement__icon">
                                {!passwordValidation.errors.minLength ? '✓' : '○'}
                            </span>
                            At least 8 characters
                        </div>
                        <div className={`password-requirement ${!passwordValidation.errors.upper && !passwordValidation.errors.lower ? 'password-requirement--met' : ''}`}>
                            <span className="password-requirement__icon">
                                {!passwordValidation.errors.upper && !passwordValidation.errors.lower ? '✓' : '○'}
                            </span>
                            Upper & lowercase letters
                        </div>
                        <div className={`password-requirement ${!passwordValidation.errors.number ? 'password-requirement--met' : ''}`}>
                            <span className="password-requirement__icon">
                                {!passwordValidation.errors.number ? '✓' : '○'}
                            </span>
                            At least one number
                        </div>
                    </div>
                </div>

                {/* Confirm Password */}
                <div className="register-field">
                    <label className="register-label" htmlFor="confirmPassword">Confirm Password</label>
                    <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        className={`register-input ${errors.confirmPassword && touched.confirmPassword ? 'register-input--error' : ''}`}
                        placeholder="Confirm your password"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        disabled={isLoading}
                    />
                    {errors.confirmPassword && touched.confirmPassword && (
                        <span className="register-field__error">{errors.confirmPassword}</span>
                    )}
                </div>

                {/* Role Selection */}
                <div className="register-field">
                    <label className="register-label">I am a</label>
                    <div className="register-role-group">
                        <label className={`register-role ${formData.role === 'student' ? 'register-role--selected' : ''}`}>
                            <input
                                type="radio"
                                name="role"
                                value="student"
                                checked={formData.role === 'student'}
                                onChange={handleChange}
                                disabled={isLoading}
                            />
                            <span className="register-role__icon">🎓</span>
                            <span className="register-role__label">Student</span>
                        </label>
                        <label className={`register-role ${formData.role === 'teacher' ? 'register-role--selected' : ''}`}>
                            <input
                                type="radio"
                                name="role"
                                value="teacher"
                                checked={formData.role === 'teacher'}
                                onChange={handleChange}
                                disabled={isLoading}
                            />
                            <span className="register-role__icon">👨‍🏫</span>
                            <span className="register-role__label">Teacher</span>
                        </label>
                    </div>
                    {formData.role === 'teacher' && (
                        <p className="register-role__note">
                            Teacher accounts require administrator approval before activation.
                        </p>
                    )}
                </div>

                {/* Terms Checkbox */}
                <div className="register-field">
                    <label className={`register-checkbox ${errors.agreeToTerms && touched.agreeToTerms ? 'register-checkbox--error' : ''}`}>
                        <input
                            type="checkbox"
                            name="agreeToTerms"
                            checked={formData.agreeToTerms}
                            onChange={handleChange}
                            disabled={isLoading}
                        />
                        <span className="register-checkmark" />
                        I agree to the{' '}
                        <Link to="/terms" className="auth-link">Terms of Service</Link>
                        {' '}and{' '}
                        <Link to="/privacy" className="auth-link">Privacy Policy</Link>
                    </label>
                    {errors.agreeToTerms && touched.agreeToTerms && (
                        <span className="register-field__error">{errors.agreeToTerms}</span>
                    )}
                </div>

                {/* Submit Button */}
                <button type="submit" className="register-submit" disabled={isLoading}>
                    {isLoading ? (
                        <span className="register-submit__loading">
                            <span className="register-spinner" />
                            Creating account...
                        </span>
                    ) : (
                        'Create account'
                    )}
                </button>
            </form>
        </AuthShell>
    )
}

export default Register
