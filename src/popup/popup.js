"use strict";

const scroll_distance = document.querySelector("#distance");
const smoothness = document.querySelector("#smoothness");
const controls = document.querySelector("#settings");
const error_text = document.querySelector("#error");
const enabled = document.querySelector("#enabled");
const ranges = { scroll_distance, smoothness };
let saved_settings;

function show_error(message) {
    error_text.textContent = message;
    error_text.hidden = !message;
}

function render_value(key) {
    const input = ranges[key];
    const { min, max, unit } = SCROLL_RANGES[key];
    const percent = 100 * (input.valueAsNumber - min) / (max - min);
    const text = input.value + " " + unit;
    document.getElementById(input.id + "-value").value = text;
    input.setAttribute("aria-valuetext", text);
    input.style.setProperty("--fill", percent + "%");
}

function render_settings(settings) {
    saved_settings = settings;
    enabled.checked = settings.enabled;
    enabled.disabled = false;
    controls.disabled = !settings.enabled;
    for (const [key, input] of Object.entries(ranges)) {
        if (input.matches(":active") && !controls.disabled) continue;
        input.value = settings[key];
        render_value(key);
    }
}

async function save_setting(key, value) {
    try {
        await chrome.storage.local.set({ [key]: value });
        show_error("");
    } catch (error) {
        render_settings(saved_settings);
        show_error("Could not save the setting. " + error.message);
    }
}

for (const [key, input] of Object.entries(ranges)) {
    const { min, max, step } = SCROLL_RANGES[key];
    input.min = min;
    input.max = max;
    input.step = step;
    input.addEventListener("input", () => render_value(key));
    input.addEventListener("change", () => save_setting(key, input.valueAsNumber));
}

enabled.addEventListener("change", () => {
    controls.disabled = !enabled.checked;
    save_setting("enabled", enabled.checked);
});

watch_settings(render_settings, (error) => {
    show_error("Could not read the settings. " + error.message);
});
