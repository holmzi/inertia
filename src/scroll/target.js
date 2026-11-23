"use strict";

const HORIZONTAL = Object.freeze({
    overscroll: "overscrollBehaviorX",
    viewport: "clientWidth",
    content: "scrollWidth",
    overflow: "overflowX",
    offset: "scrollLeft",
    coordinate: "left",
});

const VERTICAL = Object.freeze({
    overscroll: "overscrollBehaviorY",
    viewport: "clientHeight",
    content: "scrollHeight",
    overflow: "overflowY",
    offset: "scrollTop",
    coordinate: "top",
});

function scroll_path(element) {
    const path = [];
    while (element instanceof Element) {
        path.push(element);
        element = element.assignedSlot ?? element.parentElement ?? element.getRootNode().host;
    }
    return path;
}

function scroll_bounds(element, axis, style = getComputedStyle(element)) {
    const extent = Math.max(0, element[axis.content] - element[axis.viewport]);
    const flex = style.display === "flex" || style.display === "inline-flex";
    let reversed = axis === HORIZONTAL && style.direction === "rtl";
    if (flex) {
        const reverse_flow = axis === HORIZONTAL ? "row-reverse" : "column-reverse";
        if (style.flexDirection === reverse_flow) reversed = !reversed;
    }

    return reversed ? { min: -extent, max: 0 } : { min: 0, max: extent };
}

function find_scroll_target(path, axis, direction) {
    const root = document.scrollingElement;
    if (!root) return null;

    const html_style = getComputedStyle(document.documentElement);
    const body_overflow = root === document.documentElement && document.body
        && html_style.overflowX === "visible" && html_style.overflowY === "visible";
    for (const element of path) {
        if (!(element instanceof Element)) continue;
        if (body_overflow && element === document.body) continue;

        const style = element === document.documentElement ? html_style : getComputedStyle(element);
        const is_viewport = element === root;
        const overflow = is_viewport && body_overflow
            ? getComputedStyle(document.body)[axis.overflow] : style[axis.overflow];
        const can_scroll = is_viewport ? overflow !== "hidden" && overflow !== "clip"
            : overflow === "auto" || overflow === "scroll" || overflow === "overlay";
        if (can_scroll && element[axis.viewport] > 0) {
            const { min, max } = scroll_bounds(element, axis, style);
            const position = element[axis.offset];
            const has_room = direction === 0 || (direction < 0
                ? position > min + 0.5 : position < max - 0.5);

            if (max > min && has_room) {
                if (style.scrollSnapType !== "none" || style.writingMode !== "horizontal-tb") {
                    return null;
                }
                return element;
            }
            if (style[axis.overscroll] !== "auto") return null;
        }

        if (is_viewport || element.matches(":modal") || element === document.fullscreenElement) {
            return null;
        }
    }
    return null;
}

function scroll_by(element, axis, distance) {
    if (!distance) return 0;
    const start = element[axis.offset];
    element.scrollBy({ [axis.coordinate]: distance, behavior: "instant" });
    const remainder = distance - (element[axis.offset] - start);
    return Math.abs(remainder) < Math.max(1, 1 / window.devicePixelRatio) ? remainder : 0;
}
