/**
 * QR Code component for session joining.
 * Generates a QR code that links to the join page with the code pre-filled.
 */
import { QRCodeSVG } from 'qrcode.react'

/**
 * QR Code component props.
 * @typedef {Object} QRCodeProps
 * @property {string} joinCode - The 6-digit join code
 * @property {number} [size=180] - Size of the QR code in pixels
 * @property {string} [className] - Additional CSS class
 */

/**
 * QR Code component for session joining.
 * @param {QRCodeProps} props
 */
function QRCode({ joinCode, size = 180, className = '' }) {
    // Generate the join URL
    const joinUrl = `${window.location.origin}/join?code=${joinCode}`

    return (
        <QRCodeSVG
            value={joinUrl}
            size={size}
            level="M" // Error correction level: L, M, Q, H
            includeMargin={true}
            className={className}
            bgColor="var(--elev)"
            fgColor="var(--t1)"
        />
    )
}

export default QRCode
