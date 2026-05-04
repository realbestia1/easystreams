const FETCH_TIMEOUT = 30000; // 30 seconds

function createTimeoutSignal(timeoutMs) {
    const parsed = Number.parseInt(String(timeoutMs), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return { signal: undefined, cleanup: null, timed: false };
    }

    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
        return { signal: AbortSignal.timeout(parsed), cleanup: null, timed: true };
    }

    if (typeof AbortController !== "undefined" && typeof setTimeout === "function") {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, parsed);
        return {
            signal: controller.signal,
            cleanup: () => clearTimeout(timeoutId),
            timed: true
        };
    }

    return { signal: undefined, cleanup: null, timed: false };
}

async function fetchWithTimeout(url, options = {}) {
    // If global fetch doesn't exist, we can't do much in a browser/RN env
    if (typeof fetch === 'undefined') {
        throw new Error("No fetch implementation found!");
    }

    const { timeout, ...fetchOptions } = options;
    const requestTimeout = timeout || FETCH_TIMEOUT;
    const timeoutConfig = createTimeoutSignal(requestTimeout);
    const requestOptions = { ...fetchOptions };

    if (timeoutConfig.signal) {
        if (
            requestOptions.signal &&
            typeof AbortSignal !== "undefined" &&
            typeof AbortSignal.any === "function"
        ) {
            requestOptions.signal = AbortSignal.any([requestOptions.signal, timeoutConfig.signal]);
        } else if (!requestOptions.signal) {
            requestOptions.signal = timeoutConfig.signal;
        }
    }

    try {
        const response = await fetch(url, requestOptions);
        return response;
    } catch (error) {
        if (error && error.name === 'AbortError' && timeoutConfig.timed) {
            throw new Error(`Request to ${url} timed out after ${requestTimeout}ms`);
        }
        throw error;
    } finally {
        if (typeof timeoutConfig.cleanup === "function") {
            timeoutConfig.cleanup();
        }
    }
}

module.exports = { fetchWithTimeout, createTimeoutSignal };
