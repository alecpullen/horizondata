import api from '../lib/api'

export async function downloadFile(url, fallbackName) {
    const res = await api.get(url, { responseType: 'blob' })
    const href = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = href
    a.download = fallbackName
    a.click()
    URL.revokeObjectURL(href)
}
