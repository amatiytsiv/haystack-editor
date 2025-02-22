/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Haystack Software Inc. All rights reserved.
 *  Licensed under the PolyForm Strict License 1.0.0. See License.txt in the project root for
 *  license information.
 *--------------------------------------------------------------------------------------------*/

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See code-license.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { alert } from "vs/base/browser/ui/aria/aria"
import { createCancelablePromise, raceCancellation } from "vs/base/common/async"
import {
  CancellationToken,
  CancellationTokenSource,
} from "vs/base/common/cancellation"
import { KeyChord, KeyCode, KeyMod } from "vs/base/common/keyCodes"
import { assertType } from "vs/base/common/types"
import { URI } from "vs/base/common/uri"
import {
  CodeEditorStateFlag,
  EditorStateCancellationTokenSource,
} from "vs/editor/contrib/editorState/browser/editorState"
import {
  IActiveCodeEditor,
  ICodeEditor,
  isCodeEditor,
} from "vs/editor/browser/editorBrowser"
import {
  EditorAction2,
  ServicesAccessor,
} from "vs/editor/browser/editorExtensions"
import { ICodeEditorService } from "vs/editor/browser/services/codeEditorService"
import { EmbeddedCodeEditorWidget } from "vs/editor/browser/widget/codeEditor/embeddedCodeEditorWidget"
import {
  EditorOption,
  GoToLocationValues,
} from "vs/editor/common/config/editorOptions"
import * as corePosition from "vs/editor/common/core/position"
import { IRange, Range } from "vs/editor/common/core/range"
import { ScrollType } from "vs/editor/common/editorCommon"
import { EditorContextKeys } from "vs/editor/common/editorContextKeys"
import { ITextModel } from "vs/editor/common/model"
import {
  DocumentSymbol,
  Location,
  LocationLink,
  SymbolKind,
  isLocationLink,
} from "vs/editor/common/languages"
import { ReferencesController } from "vs/editor/contrib/gotoSymbol/browser/peek/referencesController"
import { ReferencesModel } from "vs/editor/contrib/gotoSymbol/browser/referencesModel"
import { ISymbolNavigationService } from "vs/editor/contrib/gotoSymbol/browser/symbolNavigation"
import { MessageController } from "vs/editor/contrib/message/browser/messageController"
import { PeekContext } from "vs/editor/contrib/peekView/browser/peekView"
import * as nls from "vs/nls"
import {
  IAction2F1RequiredOptions,
  IAction2Options,
  ISubmenuItem,
  MenuId,
  MenuRegistry,
  registerAction2,
} from "vs/platform/actions/common/actions"
import {
  CommandsRegistry,
  ICommandService,
} from "vs/platform/commands/common/commands"
import { ContextKeyExpr } from "vs/platform/contextkey/common/contextkey"
import { IInstantiationService } from "vs/platform/instantiation/common/instantiation"
import { KeybindingWeight } from "vs/platform/keybinding/common/keybindingsRegistry"
import { INotificationService } from "vs/platform/notification/common/notification"
import { IEditorProgressService } from "vs/platform/progress/common/progress"
import {
  getDeclarationsAtPosition,
  getDefinitionsAtPosition,
  getImplementationsAtPosition,
  getReferencesAtPosition,
  getTypeDefinitionsAtPosition,
} from "./goToSymbol"
import { IWordAtPosition } from "vs/editor/common/core/wordHelper"
import { ILanguageFeaturesService } from "vs/editor/common/services/languageFeatures"
import { Iterable } from "vs/base/common/iterator"
import { IsWebContext } from "vs/platform/contextkey/common/contextkeys"
import { IHaystackService } from "vs/workbench/services/haystack/common/haystackService"
import { ILanguageService } from "vs/editor/common/languages/language"
import { IModelService } from "vs/editor/common/services/model"
import { ITextFileService } from "vs/workbench/services/textfile/common/textfiles"
import { WorkspaceStoreWrapper } from "vs/workbench/browser/haystack-frontend/workspace/workspace_store_wrapper"
import { isValidSymbol } from "vs/base/haystack/is_valid_symbol"
import { isContainerSymbol } from "vs/base/haystack/is_container_symbol"

MenuRegistry.appendMenuItem(MenuId.EditorContext, {
  submenu: MenuId.EditorContextPeek,
  title: nls.localize("peek.submenu", "Peek"),
  group: "navigation",
  order: 100,
} satisfies ISubmenuItem)

export interface SymbolNavigationActionConfig {
  openToSide: boolean
  openInPeek: boolean
  muteMessage: boolean
  openNewEditor: boolean
}

export class SymbolNavigationAnchor {
  static is(thing: any): thing is SymbolNavigationAnchor {
    if (!thing || typeof thing !== "object") {
      return false
    }
    if (thing instanceof SymbolNavigationAnchor) {
      return true
    }
    if (
      corePosition.Position.isIPosition(
        (<SymbolNavigationAnchor>thing).position,
      ) &&
      (<SymbolNavigationAnchor>thing).model
    ) {
      return true
    }
    return false
  }

  constructor(
    readonly model: ITextModel,
    readonly position: corePosition.Position,
  ) {}
}

export abstract class SymbolNavigationAction extends EditorAction2 {
  private static _allSymbolNavigationCommands = new Map<
    string,
    SymbolNavigationAction
  >()
  private static _activeAlternativeCommands = new Set<string>()

  static all(): IterableIterator<SymbolNavigationAction> {
    return SymbolNavigationAction._allSymbolNavigationCommands.values()
  }

  private static _patchConfig(
    opts: IAction2Options & IAction2F1RequiredOptions,
  ): IAction2Options {
    const result = { ...opts, f1: true }
    // patch context menu when clause
    if (result.menu) {
      for (const item of Iterable.wrap(result.menu)) {
        if (
          item.id === MenuId.EditorContext ||
          item.id === MenuId.EditorContextPeek
        ) {
          item.when = ContextKeyExpr.and(opts.precondition, item.when)
        }
      }
    }
    return <typeof opts>result
  }

  readonly configuration: SymbolNavigationActionConfig

  constructor(
    configuration: SymbolNavigationActionConfig,
    opts: IAction2Options & IAction2F1RequiredOptions,
  ) {
    super(SymbolNavigationAction._patchConfig(opts))
    this.configuration = configuration
    SymbolNavigationAction._allSymbolNavigationCommands.set(opts.id, this)
  }

  override runEditorCommand(
    accessor: ServicesAccessor,
    editor: ICodeEditor,
    arg?: SymbolNavigationAnchor | unknown,
    range?: Range,
  ): Promise<void> {
    if (!editor.hasModel()) {
      return Promise.resolve(undefined)
    }
    const notificationService = accessor.get(INotificationService)
    const modelService = accessor.get(IModelService)
    const textFileService = accessor.get(ITextFileService)
    const haystackService = accessor.get(IHaystackService)
    const languageService = accessor.get(ILanguageService)
    const languageFeatureService = accessor.get(ILanguageFeaturesService)
    const progressService = accessor.get(IEditorProgressService)
    const symbolNavService = accessor.get(ISymbolNavigationService)
    const languageFeaturesService = accessor.get(ILanguageFeaturesService)
    const instaService = accessor.get(IInstantiationService)

    const model = editor.getModel()
    const editRange = editor.getEditRange()
    const position = editor.getPosition()
    const adjustedPosition = editRange
      ? position.delta(editRange.startLineNumber - 1)
      : position
    const anchor = SymbolNavigationAnchor.is(arg)
      ? arg
      : new SymbolNavigationAnchor(model, adjustedPosition)

    const cts = new EditorStateCancellationTokenSource(
      editor,
      CodeEditorStateFlag.Value | CodeEditorStateFlag.Position,
    )
    const openNewEditor = this.configuration.openNewEditor

    const promise = raceCancellation(
      this._getLocationModel(
        languageFeaturesService,
        haystackService,
        anchor.model,
        anchor.position,
        cts.token,
      ),
      cts.token,
    )
      .then(
        async (references) => {
          if (!references || cts.token.isCancellationRequested) {
            return
          }

          alert(references.ariaMessage)

          let altAction: SymbolNavigationAction | null | undefined
          if (references.referenceAt(model.uri, adjustedPosition)) {
            const altActionId = this._getAlternativeCommand(editor)
            if (
              !SymbolNavigationAction._activeAlternativeCommands.has(
                altActionId,
              ) &&
              SymbolNavigationAction._allSymbolNavigationCommands.has(
                altActionId,
              )
            ) {
              altAction =
                SymbolNavigationAction._allSymbolNavigationCommands.get(
                  altActionId,
                )!
            }
          }

          const referenceCount = references.references.length

          // We want to show the "no references message" when the user has clicked
          // on a symbol with only a reference to itself.
          const singletonReference =
            referenceCount === 1 ? references.firstReference() : undefined
          const noReferences =
            !altAction &&
            singletonReference &&
            Range.containsPosition(singletonReference.range, anchor.position)

          if (referenceCount === 0 || noReferences) {
            // no result -> show message
            if (!this.configuration.muteMessage) {
              const info = model.getWordAtPosition(adjustedPosition)
              MessageController.get(editor)?.showMessage(
                this._getNoResultFoundMessage(info),
                position,
              )
            }
          } else if (referenceCount === 1 && altAction) {
            // If the user is holding shift, we instead want to open
            // an editor at the definition location.
            if (this.configuration.openNewEditor) {
              instaService.invokeFunction((accessor) => {
                const haystackService = accessor.get(IHaystackService)
                const reference = references.firstReference()!
                haystackService
                  .getSymbolAtPosition(reference)
                  .then((symbol) => {
                    if (symbol == null) {
                      return
                    }
                    haystackService.createSymbolEditorWithSymbol(
                      symbol.name,
                      symbol.kind,
                      reference.uri,
                      symbol.range,
                      {
                        highlightRange: range,
                      },
                    )
                  })
              })

              return
            }

            // already at the only result, run alternative
            SymbolNavigationAction._activeAlternativeCommands.add(this.desc.id)
            instaService.invokeFunction((accessor) =>
              altAction
                .runEditorCommand(accessor, editor, arg, range)
                .finally(() => {
                  SymbolNavigationAction._activeAlternativeCommands.delete(
                    this.desc.id,
                  )
                }),
            )
          } else {
            // normal results handling
            return this._onResult(
              modelService,
              haystackService,
              languageService,
              languageFeatureService,
              textFileService,
              symbolNavService,
              editor,
              references,
              openNewEditor,
              range,
            )
          }
        },
        (err) => {
          // report an error
          notificationService.error(err)
        },
      )
      .finally(() => {
        cts.dispose()
      })

    progressService.showWhile(promise, 250)
    return promise
  }

  protected abstract _getLocationModel(
    languageFeaturesService: ILanguageFeaturesService,
    haystackService: IHaystackService,
    model: ITextModel,
    position: corePosition.Position,
    token: CancellationToken,
  ): Promise<ReferencesModel | undefined>

  protected abstract _getNoResultFoundMessage(
    info: IWordAtPosition | null,
  ): string

  protected abstract _getAlternativeCommand(editor: IActiveCodeEditor): string

  protected abstract _getGoToPreference(
    editor: IActiveCodeEditor,
  ): GoToLocationValues

  private async _onResult(
    modelService: IModelService,
    haystackService: IHaystackService,
    languageService: ILanguageService,
    languageFeatureService: ILanguageFeaturesService,
    textFileService: ITextFileService,
    symbolNavService: ISymbolNavigationService,
    editor: IActiveCodeEditor,
    model: ReferencesModel,
    openNewEditor: boolean,
    range?: Range,
  ): Promise<void> {
    const gotoLocation = this._getGoToPreference(editor)

    if (
      !openNewEditor &&
      !(editor instanceof EmbeddedCodeEditorWidget) &&
      (this.configuration.openInPeek ||
        (gotoLocation === "peek" && model.references.length > 1))
    ) {
      WorkspaceStoreWrapper.getWorkspaceState().sendTelemetry(
        "command click used to peek at multiple references",
      )
      haystackService.createReferenceEditor(
        model,
        editor,
        range ?? editor.getSelection(),
      )
    } else {
      const next = model.firstReference()!

      const peek = model.references.length > 1 && gotoLocation === "gotoAndPeek"
      const targetEditor = await this._openReference(
        editor,
        modelService,
        haystackService,
        languageService,
        languageFeatureService,
        textFileService,
        next,
      )

      if (!peek || !targetEditor) {
        model.dispose()
      }

      // keep remaining locations around when using
      // 'goto'-mode
      if (gotoLocation === "goto") {
        symbolNavService.put(next)
      }
    }
  }

  private async _openReference(
    editor: ICodeEditor,
    modelService: IModelService,
    haystackService: IHaystackService,
    languageService: ILanguageService,
    languageFeatureService: ILanguageFeaturesService,
    textFileService: ITextFileService,
    reference: Location | LocationLink,
  ): Promise<ICodeEditor | undefined> {
    // range is the target-selection-range when we have one
    // and the fallback is the 'full' range
    let range: IRange | undefined = undefined
    if (isLocationLink(reference)) {
      range = reference.targetSelectionRange
    }
    if (!range) {
      range = reference.range
    }
    if (!range) {
      return undefined
    }

    // We have to ensure the model exists before we try to grab its symbols.
    let model = modelService.getModel(reference.uri)
    if (model == null) {
      const languageId = languageService.guessLanguageIdByFilepathOrFirstLine(
        reference.uri,
      )
      if (languageId == null) return undefined
      const languageSelection = languageService.createById(languageId)

      const sourceCode = await textFileService.read(reference.uri)
      model = modelService.createModel(
        sourceCode.value,
        languageSelection,
        reference.uri,
      )
    }
    if (model == null) return undefined

    const providers =
      languageFeatureService.documentSymbolProvider.ordered(model)
    const documentSymbols: DocumentSymbol[] = []

    for (const provider of providers) {
      const source = new CancellationTokenSource()
      const symbols = await provider.provideDocumentSymbols(model, source.token)
      if (symbols == null) continue
      documentSymbols.push(...symbols)
    }

    let symbol: DocumentSymbol | null = null
    let documentSymbol: DocumentSymbol | undefined
    while ((documentSymbol = documentSymbols.pop())) {
      if (Range.equalsRange(documentSymbol.selectionRange, range)) {
        symbol = documentSymbol
        break
      } else if (
        Range.containsRange(documentSymbol.range, range) &&
        isContainerSymbol(documentSymbol)
      ) {
        symbol = documentSymbol
      }

      // Recurse further into the symbol subtree.
      if (
        Range.containsRange(documentSymbol.range, range) &&
        (documentSymbol.children?.length ?? 0) > 0
      ) {
        documentSymbols.push(...documentSymbol.children!)
      }
    }

    if (
      symbol == null ||
      !isValidSymbol(symbol) ||
      symbol.range.startLineNumber === symbol.range.endLineNumber
    ) {
      const editRange = editor._getViewModel()?.getEditRange()
      const editRangeContainsRef = editRange
        ? new Range(
            editRange.startLineNumber,
            editRange.startColumn,
            editRange.endLineNumber,
            editRange.endColumn,
          ).containsRange(reference.range)
        : true
      if (
        !this.configuration.openNewEditor &&
        reference.uri.toString() === editor.getModel()?.uri.toString() &&
        editRangeContainsRef
      ) {
        editor.revealRangeNearTopIfOutsideViewport(range)
        editor.setSelection({
          startLineNumber: range.startLineNumber,
          startColumn: range.startColumn,
          endLineNumber: range.startLineNumber,
          endColumn: range.startColumn,
        })
        const modelNow = editor.getModel()
        const decorations = editor.createDecorationsCollection([
          {
            range,
            options: {
              description: "symbol-navigate-action-highlight",
              className: "symbolHighlight",
            },
          },
        ])

        setTimeout(() => {
          if (editor.getModel() === modelNow) {
            decorations.clear()
          }
        }, 350)
        return undefined
      } else {
        await haystackService.createFileEditor(reference.uri, {
          selectionRange: {
            startLineNumber: range.startLineNumber,
            startColumn: range.startColumn,
            endLineNumber: range.startLineNumber,
            endColumn: range.startColumn,
          },
          highlightRange: range,
          forceNewEditor: this.configuration.openNewEditor,
        })
      }
    } else {
      // If we're a symbol editor and opening a new symbol editor, unconditionally
      // add the symbol dependency to the canvas.
      let dependencyRange: IRange | undefined = undefined
      const model = editor.getModel()
      const editorPosition = editor.getPosition()
      const editorEditRange = editor.getEditRange()
      if (editorPosition != null && editorEditRange != null && model != null) {
        const adjustedEditorPosition = editorPosition.delta(
          editorEditRange.startLineNumber - 1,
        )
        const fromPositionRange = model.getWordAtPosition(
          adjustedEditorPosition,
        )

        if (fromPositionRange != null) {
          dependencyRange = {
            startLineNumber: adjustedEditorPosition.lineNumber,
            startColumn: fromPositionRange.startColumn,
            endLineNumber: adjustedEditorPosition.lineNumber,
            endColumn: fromPositionRange.endColumn,
          }
        }
      }

      await haystackService.createSymbolEditorWithSymbol(
        symbol.name,
        symbol.kind,
        reference.uri,
        symbol.range,
        {
          highlightRange: range,
          forceNewEditor: this.configuration.openNewEditor,
          unconditionallyAddDependencyRange: dependencyRange,
        },
      )
    }

    return undefined
  }
}

//#region --- DEFINITION

export class DefinitionAction extends SymbolNavigationAction {
  protected async _getLocationModel(
    languageFeaturesService: ILanguageFeaturesService,
    haystackService: IHaystackService,
    model: ITextModel,
    position: corePosition.Position,
    token: CancellationToken,
  ): Promise<ReferencesModel> {
    const definitions = await getDefinitionsAtPosition(
      languageFeaturesService.definitionProvider,
      model,
      position,
      token,
    )
    const finalLocations: LocationLink[] = definitions

    // If we have a method definition, show the implementations as well.
    if (definitions.length === 1) {
      const symbol = await haystackService.getSymbolAtPosition(definitions[0])
      if (symbol != null && symbol.kind === SymbolKind.Method) {
        const implementations = await getImplementationsAtPosition(
          languageFeaturesService.implementationProvider,
          model,
          position,
          token,
        )

        for (const implementation of implementations) {
          if (
            implementation.uri.toString() === definitions[0].uri.toString() &&
            (Range.equalsRange(implementation.range, definitions[0].range) ||
              Range.containsRange(definitions[0].range, implementation.range))
          ) {
            continue
          }
          finalLocations.push(implementation)
        }
      }
    }

    return new ReferencesModel(
      finalLocations,
      nls.localize("def.title", "Definitions"),
    )
  }

  protected _getNoResultFoundMessage(info: IWordAtPosition | null): string {
    return info && info.word
      ? nls.localize("noResultWord", "No definition found for '{0}'", info.word)
      : nls.localize("generic.noResults", "No definition found")
  }

  protected _getAlternativeCommand(editor: IActiveCodeEditor): string {
    return editor.getOption(EditorOption.gotoLocation)
      .alternativeDefinitionCommand
  }

  protected _getGoToPreference(editor: IActiveCodeEditor): GoToLocationValues {
    return editor.getOption(EditorOption.gotoLocation).multipleDefinitions
  }
}

registerAction2(
  class GoToDefinitionAction extends DefinitionAction {
    static readonly id = "editor.action.revealDefinition"

    constructor() {
      super(
        {
          openToSide: false,
          openInPeek: false,
          muteMessage: false,
          openNewEditor: false,
        },
        {
          id: GoToDefinitionAction.id,
          title: {
            ...nls.localize2("actions.goToDecl.label", "Go to Definition"),
            mnemonicTitle: nls.localize(
              { key: "miGotoDefinition", comment: ["&& denotes a mnemonic"] },
              "Go to &&Definition",
            ),
          },
          precondition: EditorContextKeys.hasDefinitionProvider,
          keybinding: [
            {
              when: EditorContextKeys.editorTextFocus,
              primary: KeyCode.F12,
              weight: KeybindingWeight.EditorContrib,
            },
            {
              when: ContextKeyExpr.and(
                EditorContextKeys.editorTextFocus,
                IsWebContext,
              ),
              primary: KeyMod.CtrlCmd | KeyCode.F12,
              weight: KeybindingWeight.EditorContrib,
            },
          ],
          menu: [
            {
              id: MenuId.EditorContext,
              group: "navigation",
              order: 1.1,
            },
            {
              id: MenuId.MenubarGoMenu,
              precondition: null,
              group: "4_symbol_nav",
              order: 2,
            },
          ],
        },
      )
      CommandsRegistry.registerCommandAlias(
        "editor.action.goToDeclaration",
        GoToDefinitionAction.id,
      )
    }
  },
)

registerAction2(
  class GoToDefinitionInNewEditorAction extends DefinitionAction {
    static readonly id = "editor.action.revealDefinitionNewEditor"

    constructor() {
      super(
        {
          openToSide: false,
          openInPeek: false,
          muteMessage: false,
          openNewEditor: true,
        },
        {
          id: GoToDefinitionInNewEditorAction.id,
          title: {
            ...nls.localize2(
              "actions.goToDecl.label",
              "Go to Definition in New Editor",
            ),
            mnemonicTitle: nls.localize(
              {
                key: "miGotoDefinitionNewEditor",
                comment: ["&& denotes a mnemonic"],
              },
              "Go to &&Definition in New Editor",
            ),
          },
          precondition: EditorContextKeys.hasDefinitionProvider,
          keybinding: {
            when: EditorContextKeys.editorTextFocus,
            primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.F12,
            weight: KeybindingWeight.EditorContrib,
          },
          menu: [
            {
              id: MenuId.EditorContext,
              group: "navigation",
              order: 1.1,
            },
            {
              id: MenuId.MenubarGoMenu,
              precondition: null,
              group: "4_symbol_nav",
              order: 2,
            },
          ],
        },
      )
    }
  },
)

registerAction2(
  class OpenDefinitionToSideAction extends DefinitionAction {
    static readonly id = "editor.action.revealDefinitionAside"

    constructor() {
      super(
        {
          openToSide: true,
          openInPeek: false,
          muteMessage: false,
          openNewEditor: false,
        },
        {
          id: OpenDefinitionToSideAction.id,
          title: nls.localize2(
            "actions.goToDeclToSide.label",
            "Open Definition to the Side",
          ),
          precondition: ContextKeyExpr.and(
            EditorContextKeys.hasDefinitionProvider,
            EditorContextKeys.isInEmbeddedEditor.toNegated(),
          ),
          keybinding: [
            {
              when: EditorContextKeys.editorTextFocus,
              primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyCode.F12),
              weight: KeybindingWeight.EditorContrib,
            },
            {
              when: ContextKeyExpr.and(
                EditorContextKeys.editorTextFocus,
                IsWebContext,
              ),
              primary: KeyChord(
                KeyMod.CtrlCmd | KeyCode.KeyK,
                KeyMod.CtrlCmd | KeyCode.F12,
              ),
              weight: KeybindingWeight.EditorContrib,
            },
          ],
        },
      )
      CommandsRegistry.registerCommandAlias(
        "editor.action.openDeclarationToTheSide",
        OpenDefinitionToSideAction.id,
      )
    }
  },
)

registerAction2(
  class PeekDefinitionAction extends DefinitionAction {
    static readonly id = "editor.action.peekDefinition"

    constructor() {
      super(
        {
          openToSide: false,
          openInPeek: true,
          muteMessage: false,
          openNewEditor: false,
        },
        {
          id: PeekDefinitionAction.id,
          title: nls.localize2("actions.previewDecl.label", "Peek Definition"),
          precondition: ContextKeyExpr.and(
            EditorContextKeys.hasDefinitionProvider,
            PeekContext.notInPeekEditor,
            EditorContextKeys.isInEmbeddedEditor.toNegated(),
          ),
          keybinding: {
            when: EditorContextKeys.editorTextFocus,
            primary: KeyMod.Alt | KeyCode.F12,
            linux: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.F10 },
            weight: KeybindingWeight.EditorContrib,
          },
          menu: {
            id: MenuId.EditorContextPeek,
            group: "peek",
            order: 2,
          },
        },
      )
      CommandsRegistry.registerCommandAlias(
        "editor.action.previewDeclaration",
        PeekDefinitionAction.id,
      )
    }
  },
)

//#endregion

//#region --- DECLARATION

class DeclarationAction extends SymbolNavigationAction {
  protected async _getLocationModel(
    languageFeaturesService: ILanguageFeaturesService,
    haystackService: IHaystackService,
    model: ITextModel,
    position: corePosition.Position,
    token: CancellationToken,
  ): Promise<ReferencesModel> {
    return new ReferencesModel(
      await getDeclarationsAtPosition(
        languageFeaturesService.declarationProvider,
        model,
        position,
        token,
      ),
      nls.localize("decl.title", "Declarations"),
    )
  }

  protected _getNoResultFoundMessage(info: IWordAtPosition | null): string {
    return info && info.word
      ? nls.localize(
          "decl.noResultWord",
          "No declaration found for '{0}'",
          info.word,
        )
      : nls.localize("decl.generic.noResults", "No declaration found")
  }

  protected _getAlternativeCommand(editor: IActiveCodeEditor): string {
    return editor.getOption(EditorOption.gotoLocation)
      .alternativeDeclarationCommand
  }

  protected _getGoToPreference(editor: IActiveCodeEditor): GoToLocationValues {
    return editor.getOption(EditorOption.gotoLocation).multipleDeclarations
  }
}

registerAction2(
  class GoToDeclarationAction extends DeclarationAction {
    static readonly id = "editor.action.revealDeclaration"

    constructor() {
      super(
        {
          openToSide: false,
          openInPeek: false,
          muteMessage: false,
          openNewEditor: false,
        },
        {
          id: GoToDeclarationAction.id,
          title: {
            ...nls.localize2(
              "actions.goToDeclaration.label",
              "Go to Declaration",
            ),
            mnemonicTitle: nls.localize(
              { key: "miGotoDeclaration", comment: ["&& denotes a mnemonic"] },
              "Go to &&Declaration",
            ),
          },
          precondition: ContextKeyExpr.and(
            EditorContextKeys.hasDeclarationProvider,
            EditorContextKeys.isInEmbeddedEditor.toNegated(),
          ),
          menu: [
            {
              id: MenuId.EditorContext,
              group: "navigation",
              order: 1.3,
            },
            {
              id: MenuId.MenubarGoMenu,
              precondition: null,
              group: "4_symbol_nav",
              order: 3,
            },
          ],
        },
      )
    }

    protected override _getNoResultFoundMessage(
      info: IWordAtPosition | null,
    ): string {
      return info && info.word
        ? nls.localize(
            "decl.noResultWord",
            "No declaration found for '{0}'",
            info.word,
          )
        : nls.localize("decl.generic.noResults", "No declaration found")
    }
  },
)

registerAction2(
  class PeekDeclarationAction extends DeclarationAction {
    constructor() {
      super(
        {
          openToSide: false,
          openInPeek: true,
          muteMessage: false,
          openNewEditor: false,
        },
        {
          id: "editor.action.peekDeclaration",
          title: nls.localize2("actions.peekDecl.label", "Peek Declaration"),
          precondition: ContextKeyExpr.and(
            EditorContextKeys.hasDeclarationProvider,
            PeekContext.notInPeekEditor,
            EditorContextKeys.isInEmbeddedEditor.toNegated(),
          ),
          menu: {
            id: MenuId.EditorContextPeek,
            group: "peek",
            order: 3,
          },
        },
      )
    }
  },
)

//#endregion

//#region --- TYPE DEFINITION

class TypeDefinitionAction extends SymbolNavigationAction {
  protected async _getLocationModel(
    languageFeaturesService: ILanguageFeaturesService,
    haystackService: IHaystackService,
    model: ITextModel,
    position: corePosition.Position,
    token: CancellationToken,
  ): Promise<ReferencesModel> {
    return new ReferencesModel(
      await getTypeDefinitionsAtPosition(
        languageFeaturesService.typeDefinitionProvider,
        model,
        position,
        token,
      ),
      nls.localize("typedef.title", "Type Definitions"),
    )
  }

  protected _getNoResultFoundMessage(info: IWordAtPosition | null): string {
    return info && info.word
      ? nls.localize(
          "goToTypeDefinition.noResultWord",
          "No type definition found for '{0}'",
          info.word,
        )
      : nls.localize(
          "goToTypeDefinition.generic.noResults",
          "No type definition found",
        )
  }

  protected _getAlternativeCommand(editor: IActiveCodeEditor): string {
    return editor.getOption(EditorOption.gotoLocation)
      .alternativeTypeDefinitionCommand
  }

  protected _getGoToPreference(editor: IActiveCodeEditor): GoToLocationValues {
    return editor.getOption(EditorOption.gotoLocation).multipleTypeDefinitions
  }
}

registerAction2(
  class GoToTypeDefinitionAction extends TypeDefinitionAction {
    public static readonly ID = "editor.action.goToTypeDefinition"

    constructor() {
      super(
        {
          openToSide: false,
          openInPeek: false,
          muteMessage: false,
          openNewEditor: false,
        },
        {
          id: GoToTypeDefinitionAction.ID,
          title: {
            ...nls.localize2(
              "actions.goToTypeDefinition.label",
              "Go to Type Definition",
            ),
            mnemonicTitle: nls.localize(
              {
                key: "miGotoTypeDefinition",
                comment: ["&& denotes a mnemonic"],
              },
              "Go to &&Type Definition",
            ),
          },
          precondition: EditorContextKeys.hasTypeDefinitionProvider,
          keybinding: {
            when: EditorContextKeys.editorTextFocus,
            primary: 0,
            weight: KeybindingWeight.EditorContrib,
          },
          menu: [
            {
              id: MenuId.EditorContext,
              group: "navigation",
              order: 1.4,
            },
            {
              id: MenuId.MenubarGoMenu,
              precondition: null,
              group: "4_symbol_nav",
              order: 3,
            },
          ],
        },
      )
    }
  },
)

registerAction2(
  class PeekTypeDefinitionAction extends TypeDefinitionAction {
    public static readonly ID = "editor.action.peekTypeDefinition"

    constructor() {
      super(
        {
          openToSide: false,
          openInPeek: true,
          muteMessage: false,
          openNewEditor: false,
        },
        {
          id: PeekTypeDefinitionAction.ID,
          title: nls.localize2(
            "actions.peekTypeDefinition.label",
            "Peek Type Definition",
          ),
          precondition: ContextKeyExpr.and(
            EditorContextKeys.hasTypeDefinitionProvider,
            PeekContext.notInPeekEditor,
            EditorContextKeys.isInEmbeddedEditor.toNegated(),
          ),
          menu: {
            id: MenuId.EditorContextPeek,
            group: "peek",
            order: 4,
          },
        },
      )
    }
  },
)

//#endregion

//#region --- IMPLEMENTATION

class ImplementationAction extends SymbolNavigationAction {
  protected async _getLocationModel(
    languageFeaturesService: ILanguageFeaturesService,
    haystackService: IHaystackService,
    model: ITextModel,
    position: corePosition.Position,
    token: CancellationToken,
  ): Promise<ReferencesModel> {
    return new ReferencesModel(
      await getImplementationsAtPosition(
        languageFeaturesService.implementationProvider,
        model,
        position,
        token,
      ),
      nls.localize("impl.title", "Implementations"),
    )
  }

  protected _getNoResultFoundMessage(info: IWordAtPosition | null): string {
    return info && info.word
      ? nls.localize(
          "goToImplementation.noResultWord",
          "No implementation found for '{0}'",
          info.word,
        )
      : nls.localize(
          "goToImplementation.generic.noResults",
          "No implementation found",
        )
  }

  protected _getAlternativeCommand(editor: IActiveCodeEditor): string {
    return editor.getOption(EditorOption.gotoLocation)
      .alternativeImplementationCommand
  }

  protected _getGoToPreference(editor: IActiveCodeEditor): GoToLocationValues {
    return editor.getOption(EditorOption.gotoLocation).multipleImplementations
  }
}

registerAction2(
  class GoToImplementationAction extends ImplementationAction {
    public static readonly ID = "editor.action.goToImplementation"

    constructor() {
      super(
        {
          openToSide: false,
          openInPeek: false,
          muteMessage: false,
          openNewEditor: false,
        },
        {
          id: GoToImplementationAction.ID,
          title: {
            ...nls.localize2(
              "actions.goToImplementation.label",
              "Go to Implementations",
            ),
            mnemonicTitle: nls.localize(
              {
                key: "miGotoImplementation",
                comment: ["&& denotes a mnemonic"],
              },
              "Go to &&Implementations",
            ),
          },
          precondition: EditorContextKeys.hasImplementationProvider,
          keybinding: {
            when: EditorContextKeys.editorTextFocus,
            primary: KeyMod.CtrlCmd | KeyCode.F12,
            weight: KeybindingWeight.EditorContrib,
          },
          menu: [
            {
              id: MenuId.EditorContext,
              group: "navigation",
              order: 1.45,
            },
            {
              id: MenuId.MenubarGoMenu,
              precondition: null,
              group: "4_symbol_nav",
              order: 4,
            },
          ],
        },
      )
    }
  },
)

registerAction2(
  class PeekImplementationAction extends ImplementationAction {
    public static readonly ID = "editor.action.peekImplementation"

    constructor() {
      super(
        {
          openToSide: false,
          openInPeek: true,
          muteMessage: false,
          openNewEditor: false,
        },
        {
          id: PeekImplementationAction.ID,
          title: nls.localize2(
            "actions.peekImplementation.label",
            "Peek Implementations",
          ),
          precondition: ContextKeyExpr.and(
            EditorContextKeys.hasImplementationProvider,
            PeekContext.notInPeekEditor,
            EditorContextKeys.isInEmbeddedEditor.toNegated(),
          ),
          menu: {
            id: MenuId.EditorContextPeek,
            group: "peek",
            order: 5,
          },
        },
      )
    }
  },
)

//#endregion

//#region --- REFERENCES

abstract class ReferencesAction extends SymbolNavigationAction {
  protected _getNoResultFoundMessage(info: IWordAtPosition | null): string {
    return info
      ? nls.localize(
          "references.no",
          "No references found for '{0}'",
          info.word,
        )
      : nls.localize("references.noGeneric", "No references found")
  }

  protected _getAlternativeCommand(editor: IActiveCodeEditor): string {
    return editor.getOption(EditorOption.gotoLocation)
      .alternativeReferenceCommand
  }

  protected _getGoToPreference(editor: IActiveCodeEditor): GoToLocationValues {
    return editor.getOption(EditorOption.gotoLocation).multipleReferences
  }
}

registerAction2(
  class GoToReferencesAction extends ReferencesAction {
    constructor() {
      super(
        {
          openToSide: false,
          openInPeek: false,
          muteMessage: false,
          openNewEditor: false,
        },
        {
          id: "editor.action.goToReferences",
          title: {
            ...nls.localize2("goToReferences.label", "Go to References"),
            mnemonicTitle: nls.localize(
              { key: "miGotoReference", comment: ["&& denotes a mnemonic"] },
              "Go to &&References",
            ),
          },
          precondition: ContextKeyExpr.and(
            EditorContextKeys.hasReferenceProvider,
            PeekContext.notInPeekEditor,
            EditorContextKeys.isInEmbeddedEditor.toNegated(),
          ),
          keybinding: {
            when: EditorContextKeys.editorTextFocus,
            primary: KeyMod.Shift | KeyCode.F12,
            weight: KeybindingWeight.EditorContrib,
          },
          menu: [
            {
              id: MenuId.EditorContext,
              group: "navigation",
              order: 1.45,
            },
            {
              id: MenuId.MenubarGoMenu,
              precondition: null,
              group: "4_symbol_nav",
              order: 5,
            },
          ],
        },
      )
    }

    protected async _getLocationModel(
      languageFeaturesService: ILanguageFeaturesService,
      haystackService: IHaystackService,
      model: ITextModel,
      position: corePosition.Position,
      token: CancellationToken,
    ): Promise<ReferencesModel> {
      return new ReferencesModel(
        await getReferencesAtPosition(
          languageFeaturesService.referenceProvider,
          model,
          position,
          true,
          token,
        ),
        nls.localize("ref.title", "References"),
      )
    }
  },
)

registerAction2(
  class PeekReferencesAction extends ReferencesAction {
    constructor() {
      super(
        {
          openToSide: false,
          openInPeek: true,
          muteMessage: false,
          openNewEditor: false,
        },
        {
          id: "editor.action.referenceSearch.trigger",
          title: nls.localize2("references.action.label", "Peek References"),
          precondition: ContextKeyExpr.and(
            EditorContextKeys.hasReferenceProvider,
            PeekContext.notInPeekEditor,
            EditorContextKeys.isInEmbeddedEditor.toNegated(),
          ),
          menu: {
            id: MenuId.EditorContextPeek,
            group: "peek",
            order: 6,
          },
        },
      )
    }

    protected async _getLocationModel(
      languageFeaturesService: ILanguageFeaturesService,
      haystackService: IHaystackService,
      model: ITextModel,
      position: corePosition.Position,
      token: CancellationToken,
    ): Promise<ReferencesModel> {
      return new ReferencesModel(
        await getReferencesAtPosition(
          languageFeaturesService.referenceProvider,
          model,
          position,
          false,
          token,
        ),
        nls.localize("ref.title", "References"),
      )
    }
  },
)

//#endregion

//#region --- GENERIC goto symbols command

class GenericGoToLocationAction extends SymbolNavigationAction {
  constructor(
    config: SymbolNavigationActionConfig,
    private readonly _references: Location[],
    private readonly _gotoMultipleBehaviour: GoToLocationValues | undefined,
  ) {
    super(config, {
      id: "editor.action.goToLocation",
      title: nls.localize2("label.generic", "Go to Any Symbol"),
      precondition: ContextKeyExpr.and(
        PeekContext.notInPeekEditor,
        EditorContextKeys.isInEmbeddedEditor.toNegated(),
      ),
    })
  }

  protected async _getLocationModel(
    languageFeaturesService: ILanguageFeaturesService,
    haystackService: IHaystackService,
    _model: ITextModel,
    _position: corePosition.Position,
    _token: CancellationToken,
  ): Promise<ReferencesModel | undefined> {
    return new ReferencesModel(
      this._references,
      nls.localize("generic.title", "Locations"),
    )
  }

  protected _getNoResultFoundMessage(info: IWordAtPosition | null): string {
    return (
      (info &&
        nls.localize("generic.noResult", "No results for '{0}'", info.word)) ||
      ""
    )
  }

  protected _getGoToPreference(editor: IActiveCodeEditor): GoToLocationValues {
    return (
      this._gotoMultipleBehaviour ??
      editor.getOption(EditorOption.gotoLocation).multipleReferences
    )
  }

  protected _getAlternativeCommand() {
    return ""
  }
}

CommandsRegistry.registerCommand({
  id: "editor.action.goToLocations",
  metadata: {
    description: "Go to locations from a position in a file",
    args: [
      {
        name: "uri",
        description: "The text document in which to start",
        constraint: URI,
      },
      {
        name: "position",
        description: "The position at which to start",
        constraint: corePosition.Position.isIPosition,
      },
      {
        name: "locations",
        description: "An array of locations.",
        constraint: Array,
      },
      {
        name: "multiple",
        description:
          "Define what to do when having multiple results, either `peek`, `gotoAndPeek`, or `goto`",
      },
      {
        name: "noResultsMessage",
        description:
          "Human readable message that shows when locations is empty.",
      },
    ],
  },
  handler: async (
    accessor: ServicesAccessor,
    resource: any,
    position: any,
    references: any,
    multiple?: any,
    noResultsMessage?: string,
    openInPeek?: boolean,
  ) => {
    assertType(URI.isUri(resource))
    assertType(corePosition.Position.isIPosition(position))
    assertType(Array.isArray(references))
    assertType(typeof multiple === "undefined" || typeof multiple === "string")
    assertType(
      typeof openInPeek === "undefined" || typeof openInPeek === "boolean",
    )

    const editorService = accessor.get(ICodeEditorService)
    const editor = await editorService.openCodeEditor(
      { resource },
      editorService.getFocusedCodeEditor(),
    )

    if (isCodeEditor(editor)) {
      editor.setPosition(position)
      editor.revealPositionInCenterIfOutsideViewport(
        position,
        ScrollType.Smooth,
      )

      return editor.invokeWithinContext((accessor) => {
        const command = new (class extends GenericGoToLocationAction {
          protected override _getNoResultFoundMessage(
            info: IWordAtPosition | null,
          ) {
            return noResultsMessage || super._getNoResultFoundMessage(info)
          }
        })(
          {
            muteMessage: !Boolean(noResultsMessage),
            openInPeek: Boolean(openInPeek),
            openToSide: false,
            openNewEditor: false,
          },
          references,
          multiple as GoToLocationValues,
        )

        accessor
          .get(IInstantiationService)
          .invokeFunction(command.run.bind(command), editor)
      })
    }
  },
})

CommandsRegistry.registerCommand({
  id: "editor.action.peekLocations",
  metadata: {
    description: "Peek locations from a position in a file",
    args: [
      {
        name: "uri",
        description: "The text document in which to start",
        constraint: URI,
      },
      {
        name: "position",
        description: "The position at which to start",
        constraint: corePosition.Position.isIPosition,
      },
      {
        name: "locations",
        description: "An array of locations.",
        constraint: Array,
      },
      {
        name: "multiple",
        description:
          "Define what to do when having multiple results, either `peek`, `gotoAndPeek`, or `goto`",
      },
    ],
  },
  handler: async (
    accessor: ServicesAccessor,
    resource: any,
    position: any,
    references: any,
    multiple?: any,
  ) => {
    accessor
      .get(ICommandService)
      .executeCommand(
        "editor.action.goToLocations",
        resource,
        position,
        references,
        multiple,
        undefined,
        true,
      )
  },
})

//#endregion

//#region --- REFERENCE search special commands

CommandsRegistry.registerCommand({
  id: "editor.action.findReferences",
  handler: (accessor: ServicesAccessor, resource: any, position: any) => {
    assertType(URI.isUri(resource))
    assertType(corePosition.Position.isIPosition(position))

    const languageFeaturesService = accessor.get(ILanguageFeaturesService)
    const codeEditorService = accessor.get(ICodeEditorService)
    const haystackService = accessor.get(IHaystackService)

    return codeEditorService
      .openCodeEditor({ resource }, codeEditorService.getFocusedCodeEditor())
      .then((control) => {
        if (!isCodeEditor(control) || !control.hasModel()) {
          return undefined
        }

        const controller = ReferencesController.get(control)
        if (!controller) {
          return undefined
        }

        const references = createCancelablePromise((token) =>
          getReferencesAtPosition(
            languageFeaturesService.referenceProvider,
            control.getModel(),
            corePosition.Position.lift(position),
            false,
            token,
          ).then(
            (references) =>
              new ReferencesModel(
                references,
                nls.localize("ref.title", "References"),
              ),
          ),
        )
        const range = new Range(
          position.lineNumber,
          position.column,
          position.lineNumber,
          position.column,
        )

        return references.then((referencesModel) => {
          haystackService.createReferenceEditor(referencesModel, control, range)
        })
      })
  },
})

// use NEW command
CommandsRegistry.registerCommandAlias(
  "editor.action.showReferences",
  "editor.action.peekLocations",
)

//#endregion
