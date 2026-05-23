import { useEffect, useState } from 'react'
import api from '../../lib/api'
import { useToast } from '../../components/ui/ToastProvider'
import './AdminSettings.css'

function AdminSettings() {
    const [settings, setSettings] = useState({
        primary_stream_url: '',
        site_camera_url: '',
        msw_enabled: false
    })
    const [initialMsw, setInitialMsw] = useState(false)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const { showToast } = useToast()

    useEffect(() => {
        let cancelled = false
        api.get('/api/settings')
            .then(res => {
                if (!cancelled) {
                    const mswVal = res.data.msw_enabled === 'true'
                    setSettings({
                        primary_stream_url: res.data.primary_stream_url || '',
                        site_camera_url: res.data.site_camera_url || '',
                        msw_enabled: mswVal
                    })
                    setInitialMsw(mswVal)
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

    const handleToggleChange = (e) => {
        const { name, checked } = e.target
        setSettings(prev => ({
            ...prev,
            [name]: checked
        }))
    }

    const handleSave = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            await api.put('/api/settings', {
                primary_stream_url: settings.primary_stream_url,
                site_camera_url: settings.site_camera_url,
                msw_enabled: settings.msw_enabled ? 'true' : 'false'
            })
            
            // Sync with local storage
            localStorage.setItem('msw-enabled', settings.msw_enabled.toString())
            
            showToast({ type: 'success', message: 'Settings saved successfully.' })

            // If Mock API mode changed, reload window to mount/unmount the MSW worker
            if (settings.msw_enabled !== initialMsw) {
                setTimeout(() => {
                    window.location.reload()
                }, 800)
            } else {
                setInitialMsw(settings.msw_enabled)
            }
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

                <section className="settings-section">
                    <h3 className="settings-section-title">Developer Mode</h3>
                    <p className="settings-section-desc">
                        Enable Mock API mode to simulate hardware control and captures in client pages without connecting to a live telescope.
                    </p>

                    <div className="form-group-toggle">
                        <label className="settings-toggle-label" htmlFor="msw_enabled">
                            <span>Enable Mock API</span>
                            <div className="msw-toggle">
                                <input
                                    type="checkbox"
                                    id="msw_enabled"
                                    name="msw_enabled"
                                    checked={settings.msw_enabled}
                                    onChange={handleToggleChange}
                                />
                                <span className="msw-toggle-slider" />
                            </div>
                        </label>
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
