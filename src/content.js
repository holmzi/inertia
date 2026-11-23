"use strict";

(() => {
    const NATIVE_FIELDS = [
        "[role=spinbutton], [role=combobox], [role=listbox], [role=slider]",
        "textarea, select, input, object, embed, video, audio, canvas",
    ].join(", ");
    const KEY_CONTROLS = [
        "[role=application], [role=textbox], [role=checkbox], [role=radio], [role=switch]",
        "[role=tablist], [role=menubar], [role=menu], [role=grid], [role=tree]",
        "button, summary, [role=button]",
        NATIVE_FIELDS,
    ].join(", ");
    const KEY_COMMANDS = new Map([
        ["ArrowRight", [HORIZONTAL, 1, "arrow"]],
        ["ArrowLeft", [HORIZONTAL, -1, "arrow"]],
        ["ArrowDown", [VERTICAL, 1, "arrow"]],
        ["ArrowUp", [VERTICAL, -1, "arrow"]],
        ["PageDown", [VERTICAL, 1, "page"]],
        ["PageUp", [VERTICAL, -1, "page"]],
        ["Home", [VERTICAL, -1, "edge"]],
        ["End", [VERTICAL, 1, "edge"]],
        [" ", [VERTICAL, 1, "page"]],
    ]);
    const ARROW_DISTANCE = 50;
    const PAGE_FRACTION = 0.9;

    const animation = new ScrollAnimation();
    const wheel = new WheelInput();
    let last_pressed = null;
    let listeners = null;
    let settings;

    function stop_motion() {
        animation.stop();
    }

    function detach() {
        listeners?.abort();
        listeners = null;
        last_pressed = null;
        stop_motion();
    }

    function can_handle(event) {
        if (!chrome.runtime?.id) {
            detach();
            return false;
        }
        return event.cancelable && !event.defaultPrevented
            && !document.pointerLockElement && document.designMode !== "on";
    }

    function uses_control(path, selector) {
        return path.some((node) => node instanceof Element
            && (node.isContentEditable || node.matches(selector)));
    }

    function handle_wheel(event) {
        if (!event.isTrusted) return;
        if (!can_handle(event) || event.ctrlKey || event.altKey || event.metaKey) {
            animation.stop();
            return;
        }
        const path = event.composedPath();
        if (uses_control(path, NATIVE_FIELDS)) {
            animation.stop();
            return;
        }
        const input = wheel.read(event);
        if (!input) {
            animation.stop();
            return;
        }
        const { axis, steps, pages } = input;
        const target = find_scroll_target(path, axis, Math.sign(steps));
        if (!target) {
            animation.stop();
            return;
        }

        const distance = pages ? target[axis.viewport] : settings.scroll_distance;
        event.preventDefault();
        animation.scroll(target, axis, steps * distance, settings.smoothness, true);
    }

    function handle_key(event) {
        if (!event.isTrusted) return;
        if (event.key === "Escape" || event.key === "Tab") animation.stop();
        if (!can_handle(event) || event.isComposing || event.altKey || event.ctrlKey
            || event.metaKey || (event.shiftKey && event.key !== " ")) return;

        const command = KEY_COMMANDS.get(event.key);
        if (!command) return;
        let path = event.composedPath();
        if (uses_control(path, KEY_CONTROLS)) return;
        if ((event.target === document.body || event.target === document.documentElement)
            && last_pressed?.isConnected) {
            path = scroll_path(last_pressed);
        }
        const [axis, sign, unit] = command;
        const direction = event.shiftKey ? -sign : sign;
        const target = find_scroll_target(path, axis, direction);
        if (!target) {
            animation.stop();
            return;
        }

        event.preventDefault();
        let distance = direction * ARROW_DISTANCE;
        if (unit === "page") {
            distance = direction * PAGE_FRACTION * target[axis.viewport];
        } else if (unit === "edge") {
            if (event.repeat) return;
            const { min, max } = scroll_bounds(target, axis);
            const edge = direction < 0 ? min - 1 : max + 1;
            distance = edge - target[axis.offset];
            animation.stop();
        }
        animation.scroll(target, axis, distance, settings.smoothness);
    }

    function handle_press(event) {
        if (!event.isTrusted) return;
        stop_motion();
        last_pressed = event.composedPath().find((node) => node instanceof Element) ?? null;
    }

    function apply_settings(values) {
        settings = values;
        if (!settings.enabled) {
            detach();
            return;
        }
        if (listeners) return;

        listeners = new AbortController();
        const { signal } = listeners;
        window.addEventListener("pointerdown", handle_press, { passive: false, signal });
        window.addEventListener("wheel", handle_wheel, { passive: false, signal });
        window.addEventListener("pagehide", stop_motion, { signal });
        window.addEventListener("keydown", handle_key, { signal });
        window.addEventListener("blur", stop_motion, { signal });
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) stop_motion();
        }, { signal });
    }

    watch_settings(apply_settings, (error) => {
        detach();
        console.warn("Inertia could not read the scroll settings.", error);
    });
})();
