/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Haystack Software Inc. All rights reserved.
 *  Licensed under the PolyForm Strict License 1.0.0. See License.txt in the project root for
 *  license information.
 *--------------------------------------------------------------------------------------------*/

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See code-license.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Position } from "vs/editor/common/core/position"
import {
  ITestCodeEditor,
  TestCodeEditorInstantiationOptions,
  withTestCodeEditor,
} from "vs/editor/test/browser/testCodeEditor"

export function deserializePipePositions(text: string): [string, Position[]] {
  let resultText = ""
  let lineNumber = 1
  let charIndex = 0
  const positions: Position[] = []
  for (let i = 0, len = text.length; i < len; i++) {
    const chr = text.charAt(i)
    if (chr === "\n") {
      resultText += chr
      lineNumber++
      charIndex = 0
      continue
    }
    if (chr === "|") {
      positions.push(new Position(lineNumber, charIndex + 1))
    } else {
      resultText += chr
      charIndex++
    }
  }
  return [resultText, positions]
}

export function serializePipePositions(
  text: string,
  positions: Position[],
): string {
  positions.sort(Position.compare)
  let resultText = ""
  let lineNumber = 1
  let charIndex = 0
  for (let i = 0, len = text.length; i < len; i++) {
    const chr = text.charAt(i)
    if (
      positions.length > 0 &&
      positions[0].lineNumber === lineNumber &&
      positions[0].column === charIndex + 1
    ) {
      resultText += "|"
      positions.shift()
    }
    resultText += chr
    if (chr === "\n") {
      lineNumber++
      charIndex = 0
    } else {
      charIndex++
    }
  }
  if (
    positions.length > 0 &&
    positions[0].lineNumber === lineNumber &&
    positions[0].column === charIndex + 1
  ) {
    resultText += "|"
    positions.shift()
  }
  if (positions.length > 0) {
    throw new Error(`Unexpected left over positions!!!`)
  }
  return resultText
}

export function testRepeatedActionAndExtractPositions(
  text: string,
  initialPosition: Position,
  action: (editor: ITestCodeEditor) => void,
  record: (editor: ITestCodeEditor) => Position,
  stopCondition: (editor: ITestCodeEditor) => boolean,
  options: TestCodeEditorInstantiationOptions = {},
): Position[] {
  const actualStops: Position[] = []
  withTestCodeEditor(text, options, (editor) => {
    editor.setPosition(initialPosition)
    while (true) {
      action(editor)
      actualStops.push(record(editor))
      if (stopCondition(editor)) {
        break
      }

      if (actualStops.length > 1000) {
        throw new Error(
          `Endless loop detected involving position ${editor.getPosition()}!`,
        )
      }
    }
  })
  return actualStops
}
