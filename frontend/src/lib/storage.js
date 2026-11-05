// localStorage can throw when it's blocked or full, and the app must keep working when it does.

export function readJson(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
    } catch {
        return fallback;
    }
}

export function writeJson(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // The data simply won't survive a reload.
    }
}

export function removeKey(key) {
    try {
        localStorage.removeItem(key);
    } catch {
        // Nothing to remove if storage is blocked.
    }
}
