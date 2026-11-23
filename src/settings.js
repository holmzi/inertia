"use strict";

const SCROLL_RANGES = Object.freeze({
    scroll_distance: { min: 20, max: 300, step: 5, initial: 100, unit: "px" },
    smoothness: { min: 100, max: 1000, step: 25, initial: 400, unit: "ms" },
});

const DEFAULT_SETTINGS = Object.freeze({
    scroll_distance: SCROLL_RANGES.scroll_distance.initial,
    smoothness: SCROLL_RANGES.smoothness.initial,
    enabled: true,
});

function normalize_setting(key, value) {
    if (key === "enabled") {
        return typeof value === "boolean" ? value : DEFAULT_SETTINGS.enabled;
    }

    const { min, max, step, initial } = SCROLL_RANGES[key];
    if (!Number.isFinite(value)) return initial;

    const steps = Math.round((value - min) / step);
    return Math.min(max, Math.max(min, min + steps * step));
}

function watch_settings(apply, report_error) {
    let revision = 0;

    async function read_settings() {
        const requested = ++revision;
        try {
            const values = await chrome.storage.local.get(DEFAULT_SETTINGS);
            if (requested !== revision) return;

            for (const key of Object.keys(DEFAULT_SETTINGS)) {
                values[key] = normalize_setting(key, values[key]);
            }
            apply(values);
        } catch (error) {
            if (requested === revision) report_error(error);
        }
    }

    chrome.storage.local.onChanged.addListener((changes) => {
        if (Object.keys(changes).some((key) => Object.hasOwn(DEFAULT_SETTINGS, key))) {
            read_settings();
        }
    });
    window.addEventListener("pageshow", (event) => {
        if (event.persisted) read_settings();
    });
    read_settings();
}
