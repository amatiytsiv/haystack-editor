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
import { IJSONSchema } from "vs/base/common/jsonSchema"

export function applyDeprecatedVariableMessage(schema: IJSONSchema) {
  schema.pattern = schema.pattern || "^(?!.*\\$\\{(env|config|command)\\.)"
  schema.patternErrorMessage =
    schema.patternErrorMessage ||
    nls.localize(
      "deprecatedVariables",
      "'env.', 'config.' and 'command.' are deprecated, use 'env:', 'config:' and 'command:' instead.",
    )
}
