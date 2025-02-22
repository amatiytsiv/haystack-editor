/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Haystack Software Inc. All rights reserved.
 *  Licensed under the PolyForm Strict License 1.0.0. See License.txt in the project root for
 *  license information.
 *--------------------------------------------------------------------------------------------*/

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See code-license.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from "vs/nls"
import { registerColor } from "vs/platform/theme/common/colorRegistry"

export const multiDiffEditorHeaderBackground = registerColor(
  "multiDiffEditor.headerBackground",
  {
    dark: "#262626",
    light: "tab.inactiveBackground",
    hcDark: "tab.inactiveBackground",
    hcLight: "tab.inactiveBackground",
  },
  localize(
    "multiDiffEditor.headerBackground",
    "The background color of the diff editor's header",
  ),
)

export const multiDiffEditorBackground = registerColor(
  "multiDiffEditor.background",
  {
    dark: "editorBackground",
    light: "editorBackground",
    hcDark: "editorBackground",
    hcLight: "editorBackground",
  },
  localize(
    "multiDiffEditor.background",
    "The background color of the multi file diff editor",
  ),
)

export const multiDiffEditorBorder = registerColor(
  "multiDiffEditor.border",
  {
    dark: "sideBarSectionHeader.border",
    light: "#cccccc",
    hcDark: "sideBarSectionHeader.border",
    hcLight: "#cccccc",
  },
  localize(
    "multiDiffEditor.border",
    "The border color of the multi file diff editor",
  ),
)
