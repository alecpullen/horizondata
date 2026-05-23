import { useEffect, useState } from 'react'
import api from '../../lib/api'
import { useToast } from '../../components/ui/ToastProvider'
import './AdminSettings.css'

function AdminSettings() {
    const [settings, setSettings] = useState({
        primary_stream_url: '',
        site_camera_url: ''
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const { showToast } = useToast()

    useEffect(() => {
        let cancelled = false
        api.get('/api/settings')
            .then(res => {
                if (!cancelled) {
                    setSettings({
                        primary_stream_url: res.data.primary_stream_url || '',
                        site_camera_url: res.data.site_camera_url || ''
                    })
                    setLoading(false)
                }
            })
            .catch(err => {
                if (!cancelled) {
                    showToast({ type: 'error', message: 'Failed to load settings.' })
                    setLoading(false)
                }
            })
        return () => { cancelled = true }
    }, [showToast])

    const handleChange = (e) => {
        const { name, value } = e.target
        setSettings(prev => ({
            ...prev,
            [name]: value
        }))
    }

    const handleSave = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            await api.put('/api/settings', settings)
            showToast({ type: 'success', message: 'Settings saved successfully.' })
        } catch (err) {
            showToast({ type: 'error', message: 'Failed to save settings.' })
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div className="admin-settings-loading">Loading settings...</div>

    return (
        <div className="admin-settings">
            <div className="admin-settings-header">
                <h2 className="admin-settings-title">System Settings</h2>
                <p className="admin-settings-desc">Configure dynamic system behaviors including live video streams.</p>
            </div>

            <form className="admin-settings-form" onSubmit={handleSave}>
                <section className="settings-section">
                    <h3 className="settings-section-title">Video Streams</h3>
                    <p className="settings-section-desc">
                        These URLs are provided directly to the Student and Teacher views. 
                        They must be accessible by the client browser (e.g., HLS .m3u8 URLs or HTTP-FLV).
                        Leave blank to disable the stream.
                    </p>

                    <div className="form-group">
                        <label htmlFor="primary_stream_url">Primary Telescope Stream URL</label>
                        <input
                            type="url"
                            id="primary_stream_url"
                            name="primary_stream_url"
                            className="settings-input"
                            value={settings.primary_stream_url}
                            onChange={handleChange}
                            placeholder="e.g. http://localhost:8888/telescope-camera/stream.m3u8"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="site_camera_url">Site Camera Stream URL</label>
                        <input
                            type="url"
                            id="site_camera_url"
                            name="site_camera_url"
                            className="settings-input"
                            value={settings.site_camera_url}
                            onChange={handleChange}
                            placeholder="e.g. http://localhost:8888/allsky/stream.m3u8"
                        />
                    </div>
                </section>

                <div className="settings-actions">
                    <button type="submit" className="settings-save-btn" disabled={saving}>
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </form>
        </div>
    )
}

export default AdminSettings
