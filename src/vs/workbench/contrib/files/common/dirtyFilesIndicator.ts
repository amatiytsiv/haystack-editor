/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Haystack Software Inc. All rights reserved.
 *  Licensed under the PolyForm Strict License 1.0.0. See License.txt in the project root for
 *  license information.
 *--------------------------------------------------------------------------------------------*/

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See code-license.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from "vs/nls"
import { IWorkbenchContribution } from "vs/workbench/common/contributions"
import { VIEWLET_ID } from "vs/workbench/contrib/files/common/files"
import { Disposable, MutableDisposable } from "vs/base/common/lifecycle"
import {
  IActivityService,
  NumberBadge,
} from "vs/workbench/services/activity/common/activity"
import { IWorkingCopyService } from "vs/workbench/services/workingCopy/common/workingCopyService"
import {
  IWorkingCopy,
  WorkingCopyCapabilities,
} from "vs/workbench/services/workingCopy/common/workingCopy"
import { IFilesConfigurationService } from "vs/workbench/services/filesConfiguration/common/filesConfigurationService"

export class DirtyFilesIndicator
  extends Disposable
  implements IWorkbenchContribution
{
  static readonly ID = "workbench.contrib.dirtyFilesIndicator"

  private readonly badgeHandle = this._register(new MutableDisposable())

  private lastKnownDirtyCount = 0

  constructor(
    @IActivityService private readonly activityService: IActivityService,
    @IWorkingCopyService
    private readonly workingCopyService: IWorkingCopyService,
    @IFilesConfigurationService
    private readonly filesConfigurationService: IFilesConfigurationService,
  ) {
    super()

    this.updateActivityBadge()

    this.registerListeners()
  }

  private registerListeners(): void {
    // Working copy dirty indicator
    this._register(
      this.workingCopyService.onDidChangeDirty((workingCopy) =>
        this.onWorkingCopyDidChangeDirty(workingCopy),
      ),
    )
  }

  private onWorkingCopyDidChangeDirty(workingCopy: IWorkingCopy): void {
    const gotDirty = workingCopy.isDirty()
    if (
      gotDirty &&
      !(workingCopy.capabilities & WorkingCopyCapabilities.Untitled) &&
      this.filesConfigurationService.hasShortAutoSaveDelay(workingCopy.resource)
    ) {
      return // do not indicate dirty of working copies that are auto saved after short delay
    }

    if (gotDirty || this.lastKnownDirtyCount > 0) {
      this.updateActivityBadge()
    }
  }

  private updateActivityBadge(): void {
    const dirtyCount = (this.lastKnownDirtyCount =
      this.workingCopyService.dirtyCount)

    // Indicate dirty count in badge if any
    if (dirtyCount > 0) {
      this.badgeHandle.value = this.activityService.showViewContainerActivity(
        VIEWLET_ID,
        {
          badge: new NumberBadge(dirtyCount, (num) =>
            num === 1
              ? nls.localize("dirtyFile", "1 unsaved file")
              : nls.localize("dirtyFiles", "{0} unsaved files", dirtyCount),
          ),
        },
      )
    } else {
      this.badgeHandle.clear()
    }
  }
}
