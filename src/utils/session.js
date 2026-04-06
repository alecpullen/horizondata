export function generateJoinCode() {
    return String(Math.floor(Math.random() * 900000) + 100000)
}

export function split(code) {
    return code.split('')
}