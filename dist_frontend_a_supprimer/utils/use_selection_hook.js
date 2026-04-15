"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useSelection = useSelection;
const design_1 = require("@canva/design");
const react_1 = require("react");
/**
 * Returns a selection event, representing a user selection of the specified content type. The
 * event contains methods to read a snapshot of the selected content, and optionally mutate it.
 * This is a reactive value. Calling this multiple times will return different instances
 * representing the same selection.
 * @param scope The type of content to listen for selection changes on
 */
function useSelection(scope) {
    const [selection, setSelection] = (0, react_1.useState)({
        scope,
        count: 0,
        read() {
            return Promise.resolve({
                contents: Object.freeze([]),
                save() {
                    return Promise.resolve();
                },
            });
        },
    });
    (0, react_1.useEffect)(() => {
        const disposer = design_1.selection.registerOnChange({
            scope,
            onChange: setSelection,
        });
        return disposer;
    }, [scope]);
    return selection;
}
