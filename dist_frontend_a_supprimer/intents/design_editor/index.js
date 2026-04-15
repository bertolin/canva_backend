"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("@canva/app-ui-kit/styles.css");
const app_i18n_kit_1 = require("@canva/app-i18n-kit");
const app_ui_kit_1 = require("@canva/app-ui-kit");
const client_1 = require("react-dom/client");
const app_1 = require("./app");
async function render() {
    const root = (0, client_1.createRoot)(document.getElementById("root"));
    root.render(<app_i18n_kit_1.AppI18nProvider>
      <app_ui_kit_1.AppUiProvider>
        <app_1.App />
      </app_ui_kit_1.AppUiProvider>
    </app_i18n_kit_1.AppI18nProvider>);
}
const designEditor = { render };
exports.default = designEditor;
if (module.hot) {
    module.hot.accept("./app", render);
}
