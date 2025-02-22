/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Haystack Software Inc. All rights reserved.
 *  Licensed under the PolyForm Strict License 1.0.0. See License.txt in the project root for
 *  license information.
 *--------------------------------------------------------------------------------------------*/

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See code-license.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { KeyCode, KeyMod } from "vs/base/common/keyCodes"
import { ServicesAccessor } from "vs/editor/browser/editorExtensions"
import { localize2 } from "vs/nls"
import { Action2, registerAction2 } from "vs/platform/actions/common/actions"
import { KeybindingWeight } from "vs/platform/keybinding/common/keybindingsRegistry"
import { CHAT_CATEGORY } from "vs/workbench/contrib/chat/browser/actions/chatActions"
import { IChatWidgetService } from "vs/workbench/contrib/chat/browser/chat"
import {
  CONTEXT_IN_CHAT_SESSION,
  CONTEXT_CHAT_ENABLED,
} from "vs/workbench/contrib/chat/common/chatContextKeys"
import {
  IChatResponseViewModel,
  isResponseVM,
} from "vs/workbench/contrib/chat/common/chatViewModel"

export function registerChatFileTreeActions() {
  registerAction2(
    class NextFileTreeAction extends Action2 {
      constructor() {
        super({
          id: "workbench.action.chat.nextFileTree",
          title: localize2("interactive.nextFileTree.label", "Next File Tree"),
          keybinding: {
            primary: KeyMod.CtrlCmd | KeyCode.F9,
            weight: KeybindingWeight.WorkbenchContrib,
            when: CONTEXT_IN_CHAT_SESSION,
          },
          precondition: CONTEXT_CHAT_ENABLED,
          f1: true,
          category: CHAT_CATEGORY,
        })
      }

      run(accessor: ServicesAccessor, ...args: any[]) {
        navigateTrees(accessor, false)
      }
    },
  )

  registerAction2(
    class PreviousFileTreeAction extends Action2 {
      constructor() {
        super({
          id: "workbench.action.chat.previousFileTree",
          title: localize2(
            "interactive.previousFileTree.label",
            "Previous File Tree",
          ),
          keybinding: {
            primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.F9,
            weight: KeybindingWeight.WorkbenchContrib,
            when: CONTEXT_IN_CHAT_SESSION,
          },
          precondition: CONTEXT_CHAT_ENABLED,
          f1: true,
          category: CHAT_CATEGORY,
        })
      }

      run(accessor: ServicesAccessor, ...args: any[]) {
        navigateTrees(accessor, true)
      }
    },
  )
}

function navigateTrees(accessor: ServicesAccessor, reverse: boolean) {
  const chatWidgetService = accessor.get(IChatWidgetService)
  const widget = chatWidgetService.lastFocusedWidget
  if (!widget) {
    return
  }

  const focused = !widget.inputEditor.hasWidgetFocus() && widget.getFocus()
  const focusedResponse = isResponseVM(focused) ? focused : undefined

  const currentResponse =
    focusedResponse ??
    widget.viewModel
      ?.getItems()
      .reverse()
      .find((item): item is IChatResponseViewModel => isResponseVM(item))
  if (!currentResponse) {
    return
  }

  widget.reveal(currentResponse)
  const responseFileTrees = widget.getFileTreeInfosForResponse(currentResponse)
  const lastFocusedFileTree =
    widget.getLastFocusedFileTreeForResponse(currentResponse)
  const focusIdx = lastFocusedFileTree
    ? (lastFocusedFileTree.treeIndex +
        (reverse ? -1 : 1) +
        responseFileTrees.length) %
      responseFileTrees.length
    : reverse
      ? responseFileTrees.length - 1
      : 0

  responseFileTrees[focusIdx]?.focus()
}
