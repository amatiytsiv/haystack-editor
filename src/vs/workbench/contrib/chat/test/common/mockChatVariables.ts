/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Haystack Software Inc. All rights reserved.
 *  Licensed under the PolyForm Strict License 1.0.0. See License.txt in the project root for
 *  license information.
 *--------------------------------------------------------------------------------------------*/

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See code-license.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from "vs/base/common/cancellation"
import { IDisposable } from "vs/base/common/lifecycle"
import { ChatAgentLocation } from "vs/workbench/contrib/chat/common/chatAgents"
import {
  IChatModel,
  IChatRequestVariableData,
  IChatRequestVariableEntry,
} from "vs/workbench/contrib/chat/common/chatModel"
import { IParsedChatRequest } from "vs/workbench/contrib/chat/common/chatParserTypes"
import {
  IChatRequestVariableValue,
  IChatVariableData,
  IChatVariableResolver,
  IChatVariableResolverProgress,
  IChatVariablesService,
  IDynamicVariable,
} from "vs/workbench/contrib/chat/common/chatVariables"

export class MockChatVariablesService implements IChatVariablesService {
  _serviceBrand: undefined
  registerVariable(
    data: IChatVariableData,
    resolver: IChatVariableResolver,
  ): IDisposable {
    throw new Error("Method not implemented.")
  }

  getVariable(name: string): IChatVariableData | undefined {
    throw new Error("Method not implemented.")
  }

  hasVariable(name: string): boolean {
    throw new Error("Method not implemented.")
  }

  getVariables(): Iterable<Readonly<IChatVariableData>> {
    throw new Error("Method not implemented.")
  }

  getDynamicVariables(sessionId: string): readonly IDynamicVariable[] {
    return []
  }

  async resolveVariables(
    prompt: IParsedChatRequest,
    attachedContextVariables: IChatRequestVariableEntry[] | undefined,
    model: IChatModel,
    progress: (part: IChatVariableResolverProgress) => void,
    token: CancellationToken,
  ): Promise<IChatRequestVariableData> {
    return {
      variables: [],
    }
  }

  attachContext(
    name: string,
    value: unknown,
    location: ChatAgentLocation,
  ): void {
    throw new Error("Method not implemented.")
  }

  resolveVariable(
    variableName: string,
    promptText: string,
    model: IChatModel,
    progress: (part: IChatVariableResolverProgress) => void,
    token: CancellationToken,
  ): Promise<IChatRequestVariableValue> {
    throw new Error("Method not implemented.")
  }
}
