/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Haystack Software Inc. All rights reserved.
 *  Licensed under the PolyForm Strict License 1.0.0. See License.txt in the project root for
 *  license information.
 *--------------------------------------------------------------------------------------------*/

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See code-license.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionHostKind } from "vs/workbench/services/extensions/common/extensionHostKind"

export class LocalProcessRunningLocation {
  public readonly kind = ExtensionHostKind.LocalProcess
  constructor(public readonly affinity: number) {}
  public equals(other: ExtensionRunningLocation) {
    return this.kind === other.kind && this.affinity === other.affinity
  }
  public asString(): string {
    if (this.affinity === 0) {
      return "LocalProcess"
    }
    return `LocalProcess${this.affinity}`
  }
}

export class LocalWebWorkerRunningLocation {
  public readonly kind = ExtensionHostKind.LocalWebWorker
  constructor(public readonly affinity: number) {}
  public equals(other: ExtensionRunningLocation) {
    return this.kind === other.kind && this.affinity === other.affinity
  }
  public asString(): string {
    if (this.affinity === 0) {
      return "LocalWebWorker"
    }
    return `LocalWebWorker${this.affinity}`
  }
}

export class RemoteRunningLocation {
  public readonly kind = ExtensionHostKind.Remote
  public readonly affinity = 0
  public equals(other: ExtensionRunningLocation) {
    return this.kind === other.kind
  }
  public asString(): string {
    return "Remote"
  }
}

export type ExtensionRunningLocation =
  | LocalProcessRunningLocation
  | LocalWebWorkerRunningLocation
  | RemoteRunningLocation
