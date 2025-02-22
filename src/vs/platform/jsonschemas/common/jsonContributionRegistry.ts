/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Haystack Software Inc. All rights reserved.
 *  Licensed under the PolyForm Strict License 1.0.0. See License.txt in the project root for
 *  license information.
 *--------------------------------------------------------------------------------------------*/

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See code-license.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from "vs/base/common/event"
import { IJSONSchema } from "vs/base/common/jsonSchema"
import * as platform from "vs/platform/registry/common/platform"

export const Extensions = {
  JSONContribution: "base.contributions.json",
}

export interface ISchemaContributions {
  schemas: { [id: string]: IJSONSchema }
}

export interface IJSONContributionRegistry {
  readonly onDidChangeSchema: Event<string>

  /**
   * Register a schema to the registry.
   */
  registerSchema(uri: string, unresolvedSchemaContent: IJSONSchema): void

  /**
   * Notifies all listeners that the content of the given schema has changed.
   * @param uri The id of the schema
   */
  notifySchemaChanged(uri: string): void

  /**
   * Get all schemas
   */
  getSchemaContributions(): ISchemaContributions
}

function normalizeId(id: string) {
  if (id.length > 0 && id.charAt(id.length - 1) === "#") {
    return id.substring(0, id.length - 1)
  }
  return id
}

class JSONContributionRegistry implements IJSONContributionRegistry {
  private schemasById: { [id: string]: IJSONSchema }

  private readonly _onDidChangeSchema = new Emitter<string>()
  readonly onDidChangeSchema: Event<string> = this._onDidChangeSchema.event

  constructor() {
    this.schemasById = {}
  }

  public registerSchema(
    uri: string,
    unresolvedSchemaContent: IJSONSchema,
  ): void {
    this.schemasById[normalizeId(uri)] = unresolvedSchemaContent
    this._onDidChangeSchema.fire(uri)
  }

  public notifySchemaChanged(uri: string): void {
    this._onDidChangeSchema.fire(uri)
  }

  public getSchemaContributions(): ISchemaContributions {
    return {
      schemas: this.schemasById,
    }
  }
}

const jsonContributionRegistry = new JSONContributionRegistry()
platform.Registry.add(Extensions.JSONContribution, jsonContributionRegistry)
