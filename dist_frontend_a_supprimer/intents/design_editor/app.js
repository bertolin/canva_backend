"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.App = exports.DOCS_URL = void 0;
const app_ui_kit_1 = require("@canva/app-ui-kit");
const design_1 = require("@canva/design");
const platform_1 = require("@canva/platform");
const react_intl_1 = require("react-intl");
const styles = __importStar(require("styles/components.css"));
const app_hooks_1 = require("@canva/app-hooks");
exports.DOCS_URL = "https://www.canva.dev/docs/apps/";
const App = () => {
    const isSupported = (0, app_hooks_1.useFeatureSupport)();
    const addElement = [design_1.addElementAtPoint, design_1.addElementAtCursor].find((fn) => isSupported(fn));
    const onClick = () => {
        if (!addElement) {
            return;
        }
        addElement({
            type: "text",
            children: ["Hello world!"],
        });
    };
    const openExternalUrl = async (url) => {
        const response = await (0, platform_1.requestOpenExternalUrl)({
            url,
        });
        if (response.status === "aborted") {
            // user decided not to navigate to the link
        }
    };
    const intl = (0, react_intl_1.useIntl)();
    return (<div className={styles.scrollContainer}>
      <app_ui_kit_1.Rows spacing="2u">
        <app_ui_kit_1.Text>
          <react_intl_1.FormattedMessage defaultMessage="
              To make changes to this app, edit the <code>src/app.tsx</code> file,
              then close and reopen the app in the editor to preview the changes.
            " description="Instructions for how to make changes to the app. Do not translate <code>src/app.tsx</code>." values={{
            code: (chunks) => <code>{chunks}</code>,
        }}/>
        </app_ui_kit_1.Text>
        <app_ui_kit_1.Button variant="primary" onClick={onClick} disabled={!addElement} tooltipLabel={!addElement
            ? intl.formatMessage({
                defaultMessage: "This feature is not supported in the current page",
                description: "Tooltip label for when a feature is not supported in the current design",
            })
            : undefined} stretch>
          {intl.formatMessage({
            defaultMessage: "Do something cool",
            description: "Button text to do something cool. Creates a new text element when pressed.",
        })}
        </app_ui_kit_1.Button>
        <app_ui_kit_1.Button variant="secondary" onClick={() => openExternalUrl(exports.DOCS_URL)}>
          {intl.formatMessage({
            defaultMessage: "Open Canva Apps SDK docs",
            description: "Button text to open Canva Apps SDK docs. Opens an external URL when pressed.",
        })}
        </app_ui_kit_1.Button>
      </app_ui_kit_1.Rows>
    </div>);
};
exports.App = App;
