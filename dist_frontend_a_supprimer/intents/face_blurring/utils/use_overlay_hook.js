"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useOverlay = useOverlay;
const design_1 = require("@canva/design");
const platform_1 = require("@canva/platform");
const react_1 = require("react");
const initialOverlayEvent = {
    canOpen: false,
    reason: "",
};
/**
 * Returns an object which contains the following field:
 *  1. canOpen - a boolean indicate whether the overlay can be opened on the specified target.
 *  2. isOpen - a boolean indicate whether the overlay is currently open.
 *  3. open - a function to open an overlay on the specified target.
 *  4. close - a function close the currently opened overlay.
 * @param target The overlay target to register for whether we can open an overlay.
 */
function useOverlay(target) {
    const [overlay, setOverlay] = (0, react_1.useState)(initialOverlayEvent);
    const [overlayId, setOverlayId] = (0, react_1.useState)();
    const [isOpen, setIsOpen] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        return design_1.overlay.registerOnCanOpen({
            target,
            onCanOpen: setOverlay,
        });
    }, []);
    (0, react_1.useEffect)(() => {
        if (overlayId) {
            platform_1.appProcess.registerOnStateChange(overlayId, ({ state }) => setIsOpen(state === "open"));
        }
    }, [overlayId]);
    const open = async (opts = {}) => {
        if (overlay && overlay.canOpen) {
            const overlayId = await overlay.open(opts);
            setOverlayId(overlayId);
            return overlayId;
        }
        return undefined; // ← Ajout magique
    };
    const close = async (opts) => {
        if (overlayId) {
            platform_1.appProcess.requestClose(overlayId, opts);
        }
    };
    return { canOpen: overlay.canOpen, isOpen, open, close };
}
