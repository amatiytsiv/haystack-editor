/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Haystack Software Inc. All rights reserved.
 *  Licensed under the PolyForm Strict License 1.0.0. See License.txt in the project root for
 *  license information.
 *--------------------------------------------------------------------------------------------*/

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See code-license.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from "assert"
import { ensureNoDisposablesAreLeakedInTestSuite } from "vs/base/test/common/utils"
import product from "vs/platform/product/common/product"
import { IProductService } from "vs/platform/product/common/productService"
import {
  RemoteAuthorityResolverError,
  RemoteAuthorityResolverErrorCode,
} from "vs/platform/remote/common/remoteAuthorityResolver"
import { RemoteAuthorityResolverService } from "vs/platform/remote/electron-sandbox/remoteAuthorityResolverService"

suite("RemoteAuthorityResolverService", () => {
  ensureNoDisposablesAreLeakedInTestSuite()

  test("issue #147318: RemoteAuthorityResolverError keeps the same type", async () => {
    const productService: IProductService = {
      _serviceBrand: undefined,
      ...product,
    }
    const service = new RemoteAuthorityResolverService(
      productService,
      undefined as any,
    )
    const result = service.resolveAuthority("test+x")
    service._setResolvedAuthorityError(
      "test+x",
      new RemoteAuthorityResolverError(
        "something",
        RemoteAuthorityResolverErrorCode.TemporarilyNotAvailable,
      ),
    )
    try {
      await result
      assert.fail()
    } catch (err) {
      assert.strictEqual(
        RemoteAuthorityResolverError.isTemporarilyNotAvailable(err),
        true,
      )
    }
    service.dispose()
  })
})
