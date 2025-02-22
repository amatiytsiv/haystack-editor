/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Haystack Software Inc. All rights reserved.
 *  Licensed under the PolyForm Strict License 1.0.0. See License.txt in the project root for
 *  license information.
 *--------------------------------------------------------------------------------------------*/

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See code-license.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { onUnexpectedError } from "vs/base/common/errors"
import { URI, UriComponents } from "vs/base/common/uri"
import { IDisposable } from "vs/base/common/lifecycle"
import { Disposable } from "vs/workbench/api/common/extHostTypes"
import type * as vscode from "vscode"
import {
  MainContext,
  ExtHostDocumentContentProvidersShape,
  MainThreadDocumentContentProvidersShape,
  IMainContext,
} from "./extHost.protocol"
import { ExtHostDocumentsAndEditors } from "./extHostDocumentsAndEditors"
import { Schemas } from "vs/base/common/network"
import { ILogService } from "vs/platform/log/common/log"
import { CancellationToken } from "vs/base/common/cancellation"
import { splitLines } from "vs/base/common/strings"

export class ExtHostDocumentContentProvider
  implements ExtHostDocumentContentProvidersShape
{
  private static _handlePool = 0

  private readonly _documentContentProviders = new Map<
    number,
    vscode.TextDocumentContentProvider
  >()
  private readonly _proxy: MainThreadDocumentContentProvidersShape

  constructor(
    mainContext: IMainContext,
    private readonly _documentsAndEditors: ExtHostDocumentsAndEditors,
    private readonly _logService: ILogService,
  ) {
    this._proxy = mainContext.getProxy(
      MainContext.MainThreadDocumentContentProviders,
    )
  }

  registerTextDocumentContentProvider(
    scheme: string,
    provider: vscode.TextDocumentContentProvider,
  ): vscode.Disposable {
    // todo@remote
    // check with scheme from fs-providers!
    if (Object.keys(Schemas).indexOf(scheme) >= 0) {
      throw new Error(`scheme '${scheme}' already registered`)
    }

    const handle = ExtHostDocumentContentProvider._handlePool++

    this._documentContentProviders.set(handle, provider)
    this._proxy.$registerTextContentProvider(handle, scheme)

    let subscription: IDisposable | undefined
    if (typeof provider.onDidChange === "function") {
      let lastEvent: Promise<void> | undefined

      subscription = provider.onDidChange(async (uri) => {
        if (uri.scheme !== scheme) {
          this._logService.warn(
            `Provider for scheme '${scheme}' is firing event for schema '${uri.scheme}' which will be IGNORED`,
          )
          return
        }
        if (!this._documentsAndEditors.getDocument(uri)) {
          // ignore event if document isn't open
          return
        }

        if (lastEvent) {
          await lastEvent
        }

        const thisEvent = this.$provideTextDocumentContent(handle, uri)
          .then(async (value) => {
            if (!value && typeof value !== "string") {
              return
            }

            const document = this._documentsAndEditors.getDocument(uri)
            if (!document) {
              // disposed in the meantime
              return
            }

            // create lines and compare
            const lines = splitLines(value)

            // broadcast event when content changed
            if (!document.equalLines(lines)) {
              return this._proxy.$onVirtualDocumentChange(uri, value)
            }
          })
          .catch(onUnexpectedError)
          .finally(() => {
            if (lastEvent === thisEvent) {
              lastEvent = undefined
            }
          })

        lastEvent = thisEvent
      })
    }
    return new Disposable(() => {
      if (this._documentContentProviders.delete(handle)) {
        this._proxy.$unregisterTextContentProvider(handle)
      }
      if (subscription) {
        subscription.dispose()
        subscription = undefined
      }
    })
  }

  $provideTextDocumentContent(
    handle: number,
    uri: UriComponents,
  ): Promise<string | null | undefined> {
    const provider = this._documentContentProviders.get(handle)
    if (!provider) {
      return Promise.reject(new Error(`unsupported uri-scheme: ${uri.scheme}`))
    }
    return Promise.resolve(
      provider.provideTextDocumentContent(
        URI.revive(uri),
        CancellationToken.None,
      ),
    )
  }
}
