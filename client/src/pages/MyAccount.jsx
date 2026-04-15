import { useState, useEffect } from 'react'
import TopBar from '../components/TopBar'
import AccountNav from '../components/auth/AccountNav'
import { useToast } from '../components/ui/ToastProvider'
import './MyAccount.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

function MyAccount() {
    const { showToast } = useToast()
    const [isEditing, setIsEditing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)

    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        phone: '',
        institution: '',
        is2FAEnabled: false,
        notificationsEnabled: true
    })

    const [originalData, setOriginalData] = useState(null)

    // Fetch account data on mount
    useEffect(() => {
        async function fetchAccount() {
            try {
                setIsLoading(true)
                const response = await fetch(`${API_BASE}/api/account`, {
                    headers: {
                        'Accept': 'application/json',
                    },
                    credentials: 'include',
                })

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
                }

                const data = await response.json()
                setFormData({
                    fullName: data.fullName || '',
                    email: data.email || '',
                    phone: data.phone || '',
                    institution: data.institution || '',
                    is2FAEnabled: data.is2FAEnabled || false,
                    notificationsEnabled: data.notificationsEnabled !== false
                })
                setOriginalData(data)
            } catch (err) {
                setError(err.message)
                showToast({
                    type: 'error',
                    message: 'Failed to load account information'
                })
            } finally {
                setIsLoading(false)
            }
        }

        fetchAccount()
    }, [showToast])

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const response = await fetch(`${API_BASE}/api/account`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    fullName: formData.fullName,
                    email: formData.email,
                    phone: formData.phone,
                    institution: formData.institution,
                    is2FAEnabled: formData.is2FAEnabled,
                    notificationsEnabled: formData.notificationsEnabled
                })
            })

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }

            const data = await response.json()
            setOriginalData(data)
            setIsEditing(false)
            showToast({
                type: 'success',
                message: 'Profile updated successfully!'
            })
        } catch (err) {
            showToast({
                type: 'error',
                message: `Failed to save changes: ${err.message}`
            })
        } finally {
            setIsSaving(false)
        }
    }

    const handleCancel = () => {
        if (originalData) {
            setFormData({
                fullName: originalData.fullName || '',
                email: originalData.email || '',
                phone: originalData.phone || '',
                institution: originalData.institution || '',
                is2FAEnabled: originalData.is2FAEnabled || false,
                notificationsEnabled: originalData.notificationsEnabled !== false
            })
        }
        setIsEditing(false)
    }

    const handleChangePassword = () => {
        showToast({
            type: 'info',
            message: 'Password change feature coming soon'
        })
    }

    return (
        <div className="page-shell">
            <TopBar activePath="/account" />
            <AccountNav activePath="/account" />

            <main className="account-page">
                <div className="account-container">
                    <h1 className="account-title">My Account</h1>

                    {/* Profile Card */}
                    <div className="account-profile-card">
                        <div className="account-profile-left">
                            <div className="account-avatar">
                                <span>
                                    {formData.fullName
                                        .split(' ')
                                        .map(n => n[0])
                                        .join('')
                                        .toUpperCase()
                                        .slice(0, 2)}
                                </span>
                            </div>
                            <div className="account-profile-details">
                                <h2 className="account-profile-name">{formData.fullName}</h2>
                                <p className="account-profile-email">{formData.email}</p>
                            </div>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="account-loading">
                            <div className="account-loading__spinner" />
                            <p>Loading account information...</p>
                        </div>
                    ) : error ? (
                        <div className="account-error">
                            <div className="account-error__icon">
                                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                            </div>
                            <h3 className="account-error__title">Failed to load account</h3>
                            <p className="account-error__text">{error}</p>
                        </div>
                    ) : (
                    <div className="account-content">
                        {/* Personal Information */}
                        <section className="account-section">
                            <div className="account-section-header">
                                <h3 className="account-section-title">Personal Information</h3>
                                {!isEditing && (
                                    <button
                                        className="account-edit-btn"
                                        onClick={() => setIsEditing(true)}
                                    >
                                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                        </svg>
                                        Edit
                                    </button>
                                )}
                            </div>

                            <div className="account-form">
                                <div className="account-form-row">
                                    <div className="account-form-field">
                                        <label className="account-form-label">Full Name</label>
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                className="account-form-input"
                                                value={formData.fullName}
                                                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                            />
                                        ) : (
                                            <div className="account-form-value">{formData.fullName}</div>
                                        )}
                                    </div>
                                    <div className="account-form-field">
                                        <label className="account-form-label">Email Address</label>
                                        {isEditing ? (
                                            <input
                                                type="email"
                                                className="account-form-input"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            />
                                        ) : (
                                            <div className="account-form-value">{formData.email}</div>
                                        )}
                                    </div>
                                </div>

                                <div className="account-form-row">
                                    <div className="account-form-field">
                                        <label className="account-form-label">
                                            Phone Number
                                            <span className="account-form-optional">(optional)</span>
                                        </label>
                                        {isEditing ? (
                                            <input
                                                type="tel"
                                                className="account-form-input"
                                                placeholder="+61 4XX XXX XXX"
                                                value={formData.phone}
                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            />
                                        ) : (
                                            <div className="account-form-value">
                                                {formData.phone || <span className="account-form-placeholder">Not provided</span>}
                                            </div>
                                        )}
                                    </div>
                                    <div className="account-form-field">
                                        <label className="account-form-label">Institution / School</label>
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                className="account-form-input"
                                                value={formData.institution}
                                                onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                                            />
                                        ) : (
                                            <div className="account-form-value">{formData.institution}</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {isEditing && (
                                <div className="account-form-actions">
                                    <button
                                        className="account-btn account-btn--primary"
                                        onClick={handleSave}
                                        disabled={isSaving}
                                    >
                                        {isSaving ? (
                                            <>
                                                <span className="account-btn-spinner" />
                                                Saving...
                                            </>
                                        ) : (
                                            'Save Changes'
                                        )}
                                    </button>
                                    <button
                                        className="account-btn account-btn--secondary"
                                        onClick={handleCancel}
                                        disabled={isSaving}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </section>

                        {/* Security */}
                        <section className="account-section">
                            <h3 className="account-section-title">Security</h3>

                            <div className="account-settings-list">
                                <div className="account-setting-item">
                                    <div className="account-setting-info">
                                        <h4 className="account-setting-title">Password</h4>
                                        <p className="account-setting-desc">Last changed 3 months ago</p>
                                    </div>
                                    <button
                                        className="account-btn account-btn--secondary"
                                        onClick={handleChangePassword}
                                    >
                                        Change Password
                                    </button>
                                </div>

                                <div className="account-setting-item">
                                    <div className="account-setting-info">
                                        <h4 className="account-setting-title">Two-Factor Authentication</h4>
                                        <p className="account-setting-desc">
                                            {formData.is2FAEnabled
                                                ? 'Your account is protected with 2FA'
                                                : 'Add an extra layer of security to your account'}
                                        </p>
                                    </div>
                                    <label className="account-toggle">
                                        <input
                                            type="checkbox"
                                            checked={formData.is2FAEnabled}
                                            onChange={(e) => setFormData({ ...formData, is2FAEnabled: e.target.checked })}
                                            disabled={!isEditing}
                                        />
                                        <span className="account-toggle-slider" />
                                    </label>
                                </div>
                            </div>
                        </section>

                        {/* Preferences */}
                        <section className="account-section">
                            <h3 className="account-section-title">Preferences</h3>

                            <div className="account-settings-list">
                                <div className="account-setting-item">
                                    <div className="account-setting-info">
                                        <h4 className="account-setting-title">Email Notifications</h4>
                                        <p className="account-setting-desc">
                                            Receive booking reminders, session updates, and system announcements
                                        </p>
                                    </div>
                                    <label className="account-toggle">
                                        <input
                                            type="checkbox"
                                            checked={formData.notificationsEnabled}
                                            onChange={(e) => setFormData({ ...formData, notificationsEnabled: e.target.checked })}
                                            disabled={!isEditing}
                                        />
                                        <span className="account-toggle-slider" />
                                    </label>
                                </div>
                            </div>
                        </section>

                        {/* Danger Zone */}
                        <section className="account-section account-section--danger">
                            <h3 className="account-section-title account-section-title--danger">Danger Zone</h3>
                            <div className="account-danger-content">
                                <div className="account-danger-info">
                                    <h4 className="account-danger-title">Delete Account</h4>
                                    <p className="account-danger-desc">
                                        Permanently delete your account and all associated data. This action cannot be undone.
                                    </p>
                                </div>
                                <button className="account-btn account-btn--danger">
                                    Delete Account
                                </button>
                            </div>
                        </section>
                    </div>
                    )}
                </div>
            </main>
        </div>
    )
}

export default MyAccount
