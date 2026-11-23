"use strict";

const PRECISE_GESTURE_GAP_MS = 180;
const WHEEL_DELTA_PER_NOTCH = 120;

class WheelInput {
    #last_precise = -Infinity;

    read(event) {
        const mode = event.deltaMode;
        const { deltaX: x, deltaY: y } = event;
        if (!x && !y) return null;
        if ((x && y) || event.momentum) {
            this.#last_precise = event.timeStamp;
            return null;
        }

        const axis = x || event.shiftKey ? HORIZONTAL : VERTICAL;
        const delta = x || y;
        if (mode === WheelEvent.DOM_DELTA_PAGE) {
            return { axis, steps: delta, pages: true };
        }

        const legacy = Math.abs((x ? event.wheelDeltaX : event.wheelDeltaY) || 0);
        const notches = count_wheel_notches(legacy);
        if (mode === WheelEvent.DOM_DELTA_LINE) {
            const steps = notches || Math.abs(delta) / 3;
            return { axis, steps: Math.sign(delta) * steps, pages: false };
        }

        const pixels = Math.abs(delta);
        let steps = notches;
        if (!legacy) {
            if (pixels % 100 === 0) steps = pixels / 100;
            else if (pixels % 120 === 0) steps = pixels / 120;
        }

        if (!steps) this.#last_precise = event.timeStamp;
        if (!steps || event.timeStamp - this.#last_precise < PRECISE_GESTURE_GAP_MS) return null;
        return { axis, steps: Math.sign(delta) * steps, pages: false };
    }
}

function count_wheel_notches(delta) {
    if (!delta) return 0;
    if (delta % WHEEL_DELTA_PER_NOTCH === 0) return delta / WHEEL_DELTA_PER_NOTCH;

    const unit = WHEEL_DELTA_PER_NOTCH / window.devicePixelRatio;
    const count = Math.round(delta / unit);
    return Math.abs(delta - count * unit) < 1 ? count : 0;
}
