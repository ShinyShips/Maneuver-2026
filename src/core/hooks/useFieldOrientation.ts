import { useCallback, useEffect, useState } from 'react';

const FIELD_ROTATION_STORAGE_KEY = 'fieldRotation';
const LEGACY_FIELD_ORIENTATION_STORAGE_KEY = 'fieldOrientation';
const FIELD_ORIENTATION_EVENT = 'maneuver:field-orientation-changed';

export interface FieldOrientationState {
    isFieldRotated: boolean;
    toggleFieldOrientation: () => void;
}

function normalizeLegacyValue(value: string | null): boolean | null {
    if (value === 'rotated') return true;
    if (value === 'normal') return false;
    return null;
}

export function getStoredFieldOrientation(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    const savedRotation = window.localStorage.getItem(FIELD_ROTATION_STORAGE_KEY);
    if (savedRotation === 'true') return true;
    if (savedRotation === 'false') return false;

    const legacyValue = normalizeLegacyValue(window.localStorage.getItem(LEGACY_FIELD_ORIENTATION_STORAGE_KEY));
    if (legacyValue === null) {
        return false;
    }

    window.localStorage.setItem(FIELD_ROTATION_STORAGE_KEY, String(legacyValue));
    return legacyValue;
}

export function setStoredFieldOrientation(isRotated: boolean): void {
    if (typeof window === 'undefined') {
        return;
    }

    window.localStorage.setItem(FIELD_ROTATION_STORAGE_KEY, String(isRotated));
    window.localStorage.setItem(LEGACY_FIELD_ORIENTATION_STORAGE_KEY, isRotated ? 'rotated' : 'normal');
    window.dispatchEvent(new CustomEvent<boolean>(FIELD_ORIENTATION_EVENT, { detail: isRotated }));
}

export function useFieldOrientation(): FieldOrientationState {
    const [isFieldRotated, setIsFieldRotated] = useState(getStoredFieldOrientation);

    useEffect(() => {
        const syncOrientation = () => {
            setIsFieldRotated(getStoredFieldOrientation());
        };

        const handleStorage = (event: StorageEvent) => {
            if (!event.key || event.key === FIELD_ROTATION_STORAGE_KEY || event.key === LEGACY_FIELD_ORIENTATION_STORAGE_KEY) {
                syncOrientation();
            }
        };

        window.addEventListener('storage', handleStorage);
        window.addEventListener(FIELD_ORIENTATION_EVENT, syncOrientation);

        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener(FIELD_ORIENTATION_EVENT, syncOrientation);
        };
    }, []);

    const toggleFieldOrientation = useCallback(() => {
        setStoredFieldOrientation(!getStoredFieldOrientation());
    }, []);

    return { isFieldRotated, toggleFieldOrientation };
}