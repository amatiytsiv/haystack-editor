"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Haystack Software Inc. All rights reserved.
 *  Licensed under the PolyForm Strict License 1.0.0. See License.txt in the project root for
 *  license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVariableNameValidator = getVariableNameValidator;
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See code-license.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const fs_1 = require("fs");
const path = require("path");
const RE_VAR_PROP = /var\(\s*(--([\w\-\.]+))/g;
let knownVariables;
function getKnownVariableNames() {
    if (!knownVariables) {
        const knownVariablesFileContent = (0, fs_1.readFileSync)(path.join(__dirname, "./vscode-known-variables.json"), "utf8").toString();
        const knownVariablesInfo = JSON.parse(knownVariablesFileContent);
        knownVariables = new Set([
            ...knownVariablesInfo.colors,
            ...knownVariablesInfo.others,
        ]);
    }
    return knownVariables;
}
const iconVariable = /^--vscode-icon-.+-(content|font-family)$/;
function getVariableNameValidator() {
    const allVariables = getKnownVariableNames();
    return (value, report) => {
        RE_VAR_PROP.lastIndex = 0; // reset lastIndex just to be sure
        let match;
        while ((match = RE_VAR_PROP.exec(value))) {
            const variableName = match[1];
            if (variableName &&
                !allVariables.has(variableName) &&
                !iconVariable.test(variableName)) {
                report(variableName);
            }
        }
    };
}
//# sourceMappingURL=validateVariableNames.js.map