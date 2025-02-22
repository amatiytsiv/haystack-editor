/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Haystack Software Inc. All rights reserved.
 *  Licensed under the PolyForm Strict License 1.0.0. See License.txt in the project root for
 *  license information.
 *--------------------------------------------------------------------------------------------*/

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See code-license.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { tmpdir } from "os"
import { join } from "vs/base/common/path"
import { checksum } from "vs/base/node/crypto"
import { Promises } from "vs/base/node/pfs"
import { ensureNoDisposablesAreLeakedInTestSuite } from "vs/base/test/common/utils"
import { flakySuite, getRandomTestPath } from "vs/base/test/node/testUtils"

flakySuite("Crypto", () => {
  let testDir: string

  ensureNoDisposablesAreLeakedInTestSuite()

  setup(function () {
    testDir = getRandomTestPath(tmpdir(), "vsctests", "crypto")

    return Promises.mkdir(testDir, { recursive: true })
  })

  teardown(function () {
    return Promises.rm(testDir)
  })

  test("checksum", async () => {
    const testFile = join(testDir, "checksum.txt")
    await Promises.writeFile(testFile, "Hello World")

    await checksum(
      testFile,
      "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e",
    )
  })
})
