/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Haystack Software Inc. All rights reserved.
 *  Licensed under the PolyForm Strict License 1.0.0. See License.txt in the project root for
 *  license information.
 *--------------------------------------------------------------------------------------------*/

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See code-license.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode"
import { TypeScriptServiceConfiguration } from "../configuration/configuration"
import { API } from "./api"

export const enum TypeScriptVersionSource {
  Bundled = "bundled",
  TsNightlyExtension = "ts-nightly-extension",
  NodeModules = "node-modules",
  UserSetting = "user-setting",
  WorkspaceSetting = "workspace-setting",
}

export class TypeScriptVersion {
  constructor(
    public readonly source: TypeScriptVersionSource,
    public readonly path: string,
    public readonly apiVersion: API | undefined,
    private readonly _pathLabel?: string,
  ) {}

  public get tsServerPath(): string {
    return this.path
  }

  public get pathLabel(): string {
    return this._pathLabel ?? this.path
  }

  public get isValid(): boolean {
    return this.apiVersion !== undefined
  }

  public eq(other: TypeScriptVersion): boolean {
    if (this.path !== other.path) {
      return false
    }

    if (this.apiVersion === other.apiVersion) {
      return true
    }
    if (!this.apiVersion || !other.apiVersion) {
      return false
    }
    return this.apiVersion.eq(other.apiVersion)
  }

  public get displayName(): string {
    const version = this.apiVersion
    return version
      ? version.displayName
      : vscode.l10n.t("Could not load the TypeScript version at this path")
  }
}

export interface ITypeScriptVersionProvider {
  updateConfiguration(configuration: TypeScriptServiceConfiguration): void

  readonly defaultVersion: TypeScriptVersion
  readonly globalVersion: TypeScriptVersion | undefined
  readonly localVersion: TypeScriptVersion | undefined
  readonly localVersions: readonly TypeScriptVersion[]
  readonly bundledVersion: TypeScriptVersion
}
