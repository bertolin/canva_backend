"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useSelection = useSelection;
var design_1 = require("@canva/design");
var react_1 = require("react");
/**
 * Returns a selection event, representing a user selection of the specified content type. The
 * event contains methods to read a snapshot of the selected content, and optionally mutate it.
 * This is a reactive value. Calling this multiple times will return different instances
 * representing the same selection.
 * @param scope The type of content to listen for selection changes on
 */
function useSelection(scope) {
    var _a = (0, react_1.useState)({
        scope: scope,
        count: 0,
        read: function () {
            return Promise.resolve({
                contents: Object.freeze([]),
                save: function () {
                    return Promise.resolve();
                },
            });
        },
    }), selection = _a[0], setSelection = _a[1];
    (0, react_1.useEffect)(function () {
        var disposer = design_1.selection.registerOnChange({
            scope: scope,
            onChange: setSelection,
        });
        return disposer;
    }, [scope]);
    return selection;
}
