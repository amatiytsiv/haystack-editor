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
import * as assert from "assert"
import { mock } from "vs/base/test/common/mock"
import { ensureNoDisposablesAreLeakedInTestSuite } from "vs/base/test/common/utils"
import { SyncDescriptor } from "vs/platform/instantiation/common/descriptors"
import { TestInstantiationService } from "vs/platform/instantiation/test/common/instantiationServiceMock"
import { NullLogService } from "vs/platform/log/common/log"
import { TestNotificationService } from "vs/platform/notification/test/common/testNotificationService"
import { Registry } from "vs/platform/registry/common/platform"
import { MainThreadTreeViews } from "vs/workbench/api/browser/mainThreadTreeViews"
import { ExtHostTreeViewsShape } from "vs/workbench/api/common/extHost.protocol"
import { CustomTreeView } from "vs/workbench/browser/parts/views/treeView"
import {
  Extensions,
  ITreeItem,
  ITreeView,
  ITreeViewDescriptor,
  IViewContainersRegistry,
  IViewDescriptorService,
  IViewsRegistry,
  TreeItemCollapsibleState,
  ViewContainer,
  ViewContainerLocation,
} from "vs/workbench/common/views"
import { IExtHostContext } from "vs/workbench/services/extensions/common/extHostCustomers"
import { ExtensionHostKind } from "vs/workbench/services/extensions/common/extensionHostKind"
import { ViewDescriptorService } from "vs/workbench/services/views/browser/viewDescriptorService"
import {
  TestViewsService,
  workbenchInstantiationService,
} from "vs/workbench/test/browser/workbenchTestServices"
import { TestExtensionService } from "vs/workbench/test/common/workbenchTestServices"

suite("MainThreadHostTreeView", function () {
  const testTreeViewId = "testTreeView"
  const customValue = "customValue"
  const ViewsRegistry = Registry.as<IViewsRegistry>(Extensions.ViewsRegistry)

  interface CustomTreeItem extends ITreeItem {
    customProp: string
  }

  class MockExtHostTreeViewsShape extends mock<ExtHostTreeViewsShape>() {
    override async $getChildren(
      treeViewId: string,
      treeItemHandle?: string,
    ): Promise<ITreeItem[]> {
      return [
        <CustomTreeItem>{
          handle: "testItem1",
          collapsibleState: TreeItemCollapsibleState.Expanded,
          customProp: customValue,
        },
      ]
    }

    override async $hasResolve(): Promise<boolean> {
      return false
    }

    override $setVisible(): void {}
  }

  let container: ViewContainer
  let mainThreadTreeViews: MainThreadTreeViews
  let extHostTreeViewsShape: MockExtHostTreeViewsShape

  teardown(() => {
    ViewsRegistry.deregisterViews(ViewsRegistry.getViews(container), container)
  })

  const disposables = ensureNoDisposablesAreLeakedInTestSuite()

  setup(async () => {
    const instantiationService: TestInstantiationService =
      workbenchInstantiationService(undefined, disposables)
    const viewDescriptorService = disposables.add(
      instantiationService.createInstance(ViewDescriptorService),
    )
    instantiationService.stub(IViewDescriptorService, viewDescriptorService)
    container = Registry.as<IViewContainersRegistry>(
      Extensions.ViewContainersRegistry,
    ).registerViewContainer(
      {
        id: "testContainer",
        title: nls.localize2("test", "test"),
        ctorDescriptor: new SyncDescriptor(<any>{}),
      },
      ViewContainerLocation.Sidebar,
    )
    const viewDescriptor: ITreeViewDescriptor = {
      id: testTreeViewId,
      ctorDescriptor: null!,
      name: nls.localize2("Test View 1", "Test View 1"),
      treeView: disposables.add(
        instantiationService.createInstance(
          CustomTreeView,
          "testTree",
          "Test Title",
          "extension.id",
        ),
      ),
    }
    ViewsRegistry.registerViews([viewDescriptor], container)

    const testExtensionService = new TestExtensionService()
    extHostTreeViewsShape = new MockExtHostTreeViewsShape()
    mainThreadTreeViews = disposables.add(
      new MainThreadTreeViews(
        new (class implements IExtHostContext {
          remoteAuthority = ""
          extensionHostKind = ExtensionHostKind.LocalProcess
          dispose() {}
          assertRegistered() {}
          set(v: any): any {
            return null
          }
          getProxy(): any {
            return extHostTreeViewsShape
          }
          drain(): any {
            return null
          }
        })(),
        new TestViewsService(),
        new TestNotificationService(),
        testExtensionService,
        new NullLogService(),
      ),
    )
    mainThreadTreeViews.$registerTreeViewDataProvider(testTreeViewId, {
      showCollapseAll: false,
      canSelectMany: false,
      dropMimeTypes: [],
      dragMimeTypes: [],
      hasHandleDrag: false,
      hasHandleDrop: false,
      manuallyManageCheckboxes: false,
    })
    await testExtensionService.whenInstalledExtensionsRegistered()
  })

  test("getChildren keeps custom properties", async () => {
    const treeView: ITreeView = (<ITreeViewDescriptor>(
      ViewsRegistry.getView(testTreeViewId)
    )).treeView
    const children = await treeView.dataProvider?.getChildren({
      handle: "root",
      collapsibleState: TreeItemCollapsibleState.Expanded,
    })
    assert(children!.length === 1, "Exactly one child should be returned")
    assert(
      (<CustomTreeItem>children![0]).customProp === customValue,
      "Tree Items should keep custom properties",
    )
  })
})
