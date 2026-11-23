"use strict";

const ACCELERATION_WINDOW_MS = 50;
const MAX_ACCELERATION = 3;
const PULSE_SCALE = 8;
const PULSE_END = pulse_distance(PULSE_SCALE);

function pulse_distance(time) {
    if (time < 1) return time + Math.expm1(-time);
    return 1 - (Math.E - 1) * Math.exp(-time);
}

function pulse_progress(fraction) {
    if (fraction <= 0) return 0;
    if (fraction >= 1) return 1;
    return pulse_distance(fraction * PULSE_SCALE) / PULSE_END;
}

class ScrollAnimation {
    #last_wheel = -Infinity;
    #commands = [];
    #direction = 0;
    #fraction = 0;
    #target = null;
    #frame = null;
    #axis = null;

    scroll(target, axis, distance, duration, wheel = false) {
        const direction = Math.sign(distance);
        if (!direction) return;
        if (target !== this.#target || axis !== this.#axis || direction !== this.#direction) {
            this.stop();
        }

        const now = performance.now();
        const elapsed = now - this.#last_wheel;
        if (wheel && elapsed < ACCELERATION_WINDOW_MS) {
            const factor = (1 + ACCELERATION_WINDOW_MS / Math.max(1, elapsed)) / 2;
            distance *= Math.min(MAX_ACCELERATION, factor);
        }

        this.#last_wheel = wheel ? now : -Infinity;
        this.#direction = direction;
        this.#target = target;
        this.#axis = axis;
        this.#commands.push({ start: now, duration, distance, progress: 0 });
        if (this.#frame === null) this.#frame = requestAnimationFrame(this.#advance);
    }

    stop() {
        if (this.#frame !== null) cancelAnimationFrame(this.#frame);
        this.#last_wheel = -Infinity;
        this.#commands.length = 0;
        this.#fraction = 0;
        this.#target = null;
        this.#frame = null;
    }

    #advance = (time) => {
        if (!this.#target.isConnected) {
            this.stop();
            return;
        }

        let distance = this.#fraction;
        for (const command of this.#commands) {
            const progress = pulse_progress((time - command.start) / command.duration);
            distance += (progress - command.progress) * command.distance;
            command.progress = progress;
        }
        this.#commands = this.#commands.filter((command) => command.progress < 1);

        this.#fraction = scroll_by(this.#target, this.#axis, distance);

        if (this.#commands.length) {
            this.#frame = requestAnimationFrame(this.#advance);
        } else {
            this.stop();
        }
    };
}
