/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Haystack Software Inc. All rights reserved.
 *  Licensed under the PolyForm Strict License 1.0.0. See License.txt in the project root for
 *  license information.
 *--------------------------------------------------------------------------------------------*/

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See code-license.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const enum CommentCommandId {
  Add = "workbench.action.addComment",
  NextThread = "editor.action.nextCommentThreadAction",
  PreviousThread = "editor.action.previousCommentThreadAction",
  NextRange = "editor.action.nextCommentingRange",
  PreviousRange = "editor.action.previousCommentingRange",
  ToggleCommenting = "workbench.action.toggleCommenting",
  Submit = "editor.action.submitComment",
  Hide = "workbench.action.hideComment",
  CollapseAll = "workbench.action.collapseAllComments",
  ExpandAll = "workbench.action.expandAllComments",
  ExpandUnresolved = "workbench.action.expandUnresolvedComments",
}
