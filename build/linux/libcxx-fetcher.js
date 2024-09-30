"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Haystack Software Inc. All rights reserved.
 *  Licensed under the Functional Source License. See License.txt in the project root for
 *  license information.
 *--------------------------------------------------------------------------------------------*/
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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadLibcxxHeaders = downloadLibcxxHeaders;
exports.downloadLibcxxObjects = downloadLibcxxObjects;
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See code-license.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Can be removed once https://github.com/electron/electron-rebuild/pull/703 is available.
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const debug_1 = __importDefault(require("debug"));
const extract_zip_1 = __importDefault(require("extract-zip"));
const get_1 = require("@electron/get");
const root = path.dirname(path.dirname(__dirname));
const d = (0, debug_1.default)("libcxx-fetcher");
async function downloadLibcxxHeaders(outDir, electronVersion, lib_name) {
    if (await fs.existsSync(path.resolve(outDir, "include"))) {
        return;
    }
    if (!(await fs.existsSync(outDir))) {
        await fs.mkdirSync(outDir, { recursive: true });
    }
    d(`downloading ${lib_name}_headers`);
    const headers = await (0, get_1.downloadArtifact)({
        version: electronVersion,
        isGeneric: true,
        artifactName: `${lib_name}_headers.zip`,
    });
    d(`unpacking ${lib_name}_headers from ${headers}`);
    await (0, extract_zip_1.default)(headers, { dir: outDir });
}
async function downloadLibcxxObjects(outDir, electronVersion, targetArch = "x64") {
    if (await fs.existsSync(path.resolve(outDir, "libc++.a"))) {
        return;
    }
    if (!(await fs.existsSync(outDir))) {
        await fs.mkdirSync(outDir, { recursive: true });
    }
    d(`downloading libcxx-objects-linux-${targetArch}`);
    const objects = await (0, get_1.downloadArtifact)({
        version: electronVersion,
        platform: "linux",
        artifactName: "libcxx-objects",
        arch: targetArch,
    });
    d(`unpacking libcxx-objects from ${objects}`);
    await (0, extract_zip_1.default)(objects, { dir: outDir });
}
async function main() {
    const libcxxObjectsDirPath = process.env["VSCODE_LIBCXX_OBJECTS_DIR"];
    const libcxxHeadersDownloadDir = process.env["VSCODE_LIBCXX_HEADERS_DIR"];
    const libcxxabiHeadersDownloadDir = process.env["VSCODE_LIBCXXABI_HEADERS_DIR"];
    const arch = process.env["VSCODE_ARCH"];
    const packageJSON = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    const electronVersion = packageJSON.devDependencies.electron;
    if (!libcxxObjectsDirPath ||
        !libcxxHeadersDownloadDir ||
        !libcxxabiHeadersDownloadDir) {
        throw new Error("Required build env not set");
    }
    await downloadLibcxxObjects(libcxxObjectsDirPath, electronVersion, arch);
    await downloadLibcxxHeaders(libcxxHeadersDownloadDir, electronVersion, "libcxx");
    await downloadLibcxxHeaders(libcxxabiHeadersDownloadDir, electronVersion, "libcxxabi");
}
if (require.main === module) {
    main().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
//# sourceMappingURL=libcxx-fetcher.js.map