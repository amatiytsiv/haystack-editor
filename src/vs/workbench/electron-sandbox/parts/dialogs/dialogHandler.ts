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
import { isLinuxSnap } from "vs/base/common/platform"
import { IClipboardService } from "vs/platform/clipboard/common/clipboardService"
import {
  AbstractDialogHandler,
  IConfirmation,
  IConfirmationResult,
  IPrompt,
  IAsyncPromptResult,
} from "vs/platform/dialogs/common/dialogs"
import { ILogService } from "vs/platform/log/common/log"
import { INativeHostService } from "vs/platform/native/common/native"
import { IProductService } from "vs/platform/product/common/productService"
import { process } from "vs/base/parts/sandbox/electron-sandbox/globals"
import { getActiveWindow } from "vs/base/browser/dom"

export class NativeDialogHandler extends AbstractDialogHandler {
  constructor(
    @ILogService private readonly logService: ILogService,
    @INativeHostService private readonly nativeHostService: INativeHostService,
    @IProductService private readonly productService: IProductService,
    @IClipboardService private readonly clipboardService: IClipboardService,
  ) {
    super()
  }

  async prompt<T>(prompt: IPrompt<T>): Promise<IAsyncPromptResult<T>> {
    this.logService.trace("DialogService#prompt", prompt.message)

    const buttons = this.getPromptButtons(prompt)

    const { response, checkboxChecked } =
      await this.nativeHostService.showMessageBox({
        type: this.getDialogType(prompt.type),
        title: prompt.title,
        message: prompt.message,
        detail: prompt.detail,
        buttons,
        cancelId: prompt.cancelButton ? buttons.length - 1 : -1 /* Disabled */,
        checkboxLabel: prompt.checkbox?.label,
        checkboxChecked: prompt.checkbox?.checked,
        targetWindowId: getActiveWindow().vscodeWindowId,
      })

    return this.getPromptResult(prompt, response, checkboxChecked)
  }

  async confirm(confirmation: IConfirmation): Promise<IConfirmationResult> {
    this.logService.trace("DialogService#confirm", confirmation.message)

    const buttons = this.getConfirmationButtons(confirmation)

    const { response, checkboxChecked } =
      await this.nativeHostService.showMessageBox({
        type: this.getDialogType(confirmation.type) ?? "question",
        title: confirmation.title,
        message: confirmation.message,
        detail: confirmation.detail,
        buttons,
        cancelId: buttons.length - 1,
        checkboxLabel: confirmation.checkbox?.label,
        checkboxChecked: confirmation.checkbox?.checked,
        targetWindowId: getActiveWindow().vscodeWindowId,
      })

    return { confirmed: response === 0, checkboxChecked }
  }

  input(): never {
    throw new Error("Unsupported") // we have no native API for password dialogs in Electron
  }

  async about(): Promise<void> {
    let version = this.productService.version
    if (this.productService.target) {
      version = `${version} (${this.productService.target} setup)`
    } else if (this.productService.darwinUniversalAssetId) {
      version = `${version} (Universal)`
    }
    const haystackVersion = this.productService.haystackVersion

    const osProps = await this.nativeHostService.getOSProperties()

    const detailString = (useAgo: boolean): string => {
      return localize(
        {
          key: "aboutDetail",
          comment: [
            "Electron, Chromium, Node.js and V8 are product names that need no translation",
          ],
        },
        "Haystack Version: {0}\nVS Code Version: {1}\nChromium: {2}\nOS: {3 }",
        haystackVersion,
        version,
        process.versions["chrome"],
        `${osProps.type} ${osProps.arch} ${osProps.release}${
          isLinuxSnap ? " snap" : ""
        }`,
      )
    }

    const detail = detailString(true)
    const detailToCopy = detailString(false)

    const { response } = await this.nativeHostService.showMessageBox({
      type: "info",
      message: this.productService.nameLong,
      detail: `\n${detail}`,
      buttons: [
        localize({ key: "copy", comment: ["&& denotes a mnemonic"] }, "&&Copy"),
        localize("okButton", "OK"),
      ],
      targetWindowId: getActiveWindow().vscodeWindowId,
    })

    if (response === 0) {
      this.clipboardService.writeText(detailToCopy)
    }
  }
}
