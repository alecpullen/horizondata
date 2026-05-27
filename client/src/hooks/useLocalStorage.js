import { useState, useEffect, useCallback } from 'react'

export function useLocalStorage(key, initialValue) {
    // Get initial value from localStorage or use initialValue
    const [value, setValue] = useState(() => {
        try {
            const saved = localStorage.getItem(key)
            return saved ? JSON.parse(saved) : initialValue
        } catch (error) {
            console.warn(`Error reading localStorage key "${key}":`, error)
            return initialValue
        }
    })

    // Update localStorage when value changes
    useEffect(() => {
        try {
            if (value === null || value === undefined) {
                localStorage.removeItem(key)
            } else {
                localStorage.setItem(key, JSON.stringify(value))
            }
        } catch (error) {
            console.warn(`Error setting localStorage key "${key}":`, error)
        }
    }, [key, value])

    // Remove item from localStorage
    const removeValue = useCallback(() => {
        setValue(null)
        localStorage.removeItem(key)
    }, [key])

    return [value, setValue, removeValue]
}
