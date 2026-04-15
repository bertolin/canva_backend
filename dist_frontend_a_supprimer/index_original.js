"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const design_1 = require("@canva/intents/design");
const design_editor_1 = __importDefault(require("./intents/design_editor"));
(0, design_1.prepareDesignEditor)(design_editor_1.default);
