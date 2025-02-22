/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Haystack Software Inc. All rights reserved.
 *  Licensed under the PolyForm Strict License 1.0.0. See License.txt in the project root for
 *  license information.
 *--------------------------------------------------------------------------------------------*/

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See code-license.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationTokenSource } from "vs/base/common/cancellation"
import { IntervalTimer } from "vs/base/common/async"
import { ensureNoDisposablesAreLeakedInTestSuite } from "vs/base/test/common/utils"
import { asProgressiveEdit } from "../../browser/utils"
import * as assert from "assert"

suite("AsyncEdit", () => {
  ensureNoDisposablesAreLeakedInTestSuite()

  test("asProgressiveEdit", async () => {
    const interval = new IntervalTimer()
    const edit = {
      range: {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 1,
      },
      text: "Hello, world!",
    }

    const cts = new CancellationTokenSource()
    const result = asProgressiveEdit(interval, edit, 5, cts.token)

    // Verify the range
    assert.deepStrictEqual(result.range, edit.range)

    const iter = result.newText[Symbol.asyncIterator]()

    // Verify the newText
    const a = await iter.next()
    assert.strictEqual(a.value, "Hello,")
    assert.strictEqual(a.done, false)

    // Verify the next word
    const b = await iter.next()
    assert.strictEqual(b.value, " world!")
    assert.strictEqual(b.done, false)

    const c = await iter.next()
    assert.strictEqual(c.value, undefined)
    assert.strictEqual(c.done, true)

    cts.dispose()
  })

  test("asProgressiveEdit - cancellation", async () => {
    const interval = new IntervalTimer()
    const edit = {
      range: {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 1,
      },
      text: "Hello, world!",
    }

    const cts = new CancellationTokenSource()
    const result = asProgressiveEdit(interval, edit, 5, cts.token)

    // Verify the range
    assert.deepStrictEqual(result.range, edit.range)

    const iter = result.newText[Symbol.asyncIterator]()

    // Verify the newText
    const a = await iter.next()
    assert.strictEqual(a.value, "Hello,")
    assert.strictEqual(a.done, false)

    cts.dispose(true)

    const c = await iter.next()
    assert.strictEqual(c.value, undefined)
    assert.strictEqual(c.done, true)
  })
})
