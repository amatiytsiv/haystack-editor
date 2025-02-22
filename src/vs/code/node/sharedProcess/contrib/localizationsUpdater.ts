/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Haystack Software Inc. All rights reserved.
 *  Licensed under the PolyForm Strict License 1.0.0. See License.txt in the project root for
 *  license information.
 *--------------------------------------------------------------------------------------------*/

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See code-license.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from "vs/base/common/lifecycle"
import { ILanguagePackService } from "vs/platform/languagePacks/common/languagePacks"
import { NativeLanguagePackService } from "vs/platform/languagePacks/node/languagePacks"

export class LocalizationsUpdater extends Disposable {
  constructor(
    @ILanguagePackService
    private readonly localizationsService: NativeLanguagePackService,
  ) {
    super()

    this.updateLocalizations()
  }

  private updateLocalizations(): void {
    this.localizationsService.update()
  }
}
