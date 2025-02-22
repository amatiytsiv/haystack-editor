/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Haystack Software Inc. All rights reserved.
 *  Licensed under the PolyForm Strict License 1.0.0. See License.txt in the project root for
 *  license information.
 *--------------------------------------------------------------------------------------------*/

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See code-license.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITerminalExternalLinkProvider } from "vs/workbench/contrib/terminal/browser/terminal"
import { ITerminalLinkProviderService } from "vs/workbench/contrib/terminalContrib/links/browser/links"
import { Emitter, Event } from "vs/base/common/event"
import { IDisposable } from "vs/base/common/lifecycle"

export class TerminalLinkProviderService
  implements ITerminalLinkProviderService
{
  declare _serviceBrand: undefined

  private _linkProviders = new Set<ITerminalExternalLinkProvider>()
  get linkProviders(): ReadonlySet<ITerminalExternalLinkProvider> {
    return this._linkProviders
  }

  private readonly _onDidAddLinkProvider =
    new Emitter<ITerminalExternalLinkProvider>()
  get onDidAddLinkProvider(): Event<ITerminalExternalLinkProvider> {
    return this._onDidAddLinkProvider.event
  }
  private readonly _onDidRemoveLinkProvider =
    new Emitter<ITerminalExternalLinkProvider>()
  get onDidRemoveLinkProvider(): Event<ITerminalExternalLinkProvider> {
    return this._onDidRemoveLinkProvider.event
  }

  registerLinkProvider(
    linkProvider: ITerminalExternalLinkProvider,
  ): IDisposable {
    const disposables: IDisposable[] = []
    this._linkProviders.add(linkProvider)
    this._onDidAddLinkProvider.fire(linkProvider)
    return {
      dispose: () => {
        for (const disposable of disposables) {
          disposable.dispose()
        }
        this._linkProviders.delete(linkProvider)
        this._onDidRemoveLinkProvider.fire(linkProvider)
      },
    }
  }
}
