import { useState } from 'react'
import TopBar from '../components/TopBar'
import AccountNav from '../components/auth/AccountNav'
import { useToast } from '../components/ui/ToastProvider'
import './MyAccount.css'

function MyAccount() {
    const { showToast } = useToast()
    const [isEditing, setIsEditing] = useState(false)
    const [is2FAEnabled, setIs2FAEnabled] = useState(false)
    const [notificationsEnabled, setNotificationsEnabled] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    const [formData, setFormData] = useState({
        fullName: 'Dr. Jane Smith',
        email: 'jane.smith@latrobe.edu.au',
        phone: '',
        institution: 'La Trobe University'
    })

    const handleSave = async () => {
        setIsSaving(true)
        // Simulate API call
        await new Promise(r => setTimeout(r, 800))
        setIsSaving(false)
        setIsEditing(false)
        showToast({
            type: 'success',
            message: 'Profile updated successfully!'
        })
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
                                <span>JS</span>
                            </div>
                            <div className="account-profile-details">
                                <h2 className="account-profile-name">{formData.fullName}</h2>
                                <p className="account-profile-email">{formData.email}</p>
                                <span className="account-role-badge">Teacher</span>
                            </div>
                        </div>
                        <div className="account-profile-right">
                            <div className="account-status">
                                <span className="account-status-dot active" />
                                <span className="account-status-text">Active</span>
                            </div>
                        </div>
                    </div>

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
                                        onClick={() => setIsEditing(false)}
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
                                            {is2FAEnabled
                                                ? 'Your account is protected with 2FA'
                                                : 'Add an extra layer of security to your account'}
                                        </p>
                                    </div>
                                    <label className="account-toggle">
                                        <input
                                            type="checkbox"
                                            checked={is2FAEnabled}
                                            onChange={(e) => setIs2FAEnabled(e.target.checked)}
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
                                            checked={notificationsEnabled}
                                            onChange={(e) => setNotificationsEnabled(e.target.checked)}
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
                </div>
            </main>
        </div>
    )
}

export default MyAccount
