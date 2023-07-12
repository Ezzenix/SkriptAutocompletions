import { Session } from "..";
import {
	CancellationToken,
	CompletionContext,
	CompletionItem,
	CompletionItemKind,
	Disposable,
	DocumentSelector,
	Hover,
	Location,
	MarkdownString,
	Position,
	Range,
	SnippetString,
	TextDocument,
	Uri,
	languages,
} from "vscode";

import * as snippets from "../../snippets.json";

export class ProviderHandler {
	disposables: Disposable[] = [];

	constructor(session: Session, documentSelector: DocumentSelector) {
		const workspacePath = session.workspacePath;
		const registry = session.registryHandler.registry;

		// --------------------------------
		// COMPLETION
		// --------------------------------
		this.disposables.push(
			languages.registerCompletionItemProvider(
				documentSelector,
				{
					provideCompletionItems: (
						document: TextDocument,
						position: Position,
						token: CancellationToken,
						context: CompletionContext
					) => {
						const items = [];
						const typedRange = document.getWordRangeAtPosition(position);
						const typedText = document.getText(typedRange);

						const _wordBeforeChar = position.character - typedText.length - 2;
						const wordBefore =
							_wordBeforeChar >= 0
								? document.getText(
										document.getWordRangeAtPosition(
											new Position(position.line, Math.max(position.character - typedText.length - 2, 0))
										)
								  )
								: undefined;

						// Functions
						if (wordBefore !== "function") {
							registry.forEach((script) => {
								script.meta.functions.forEach((func) => {
									const item = new CompletionItem(func.name + "()", CompletionItemKind.Function);

									const displayName = `${script.name}.sk`;
									const pathDisplay =
										displayName === script.relativePath ? displayName : `${displayName} (${script.relativePath})`;
									item.detail = `in ${pathDisplay}`;

									const markdown = new MarkdownString();
									markdown.appendCodeblock(func.declarationLineText, "skript");
									markdown.appendText(func.documentation.join("\n"));

									item.documentation = markdown;
									//item.preselect = true;
									//item.sortText = "!!!!!";

									items.push(item);
								});
							});
						}

						// Snippets
						Object.keys(snippets).forEach((key) => {
							const snippet = snippets[key];
							const completionItem = new CompletionItem(snippet.prefix, CompletionItemKind.Snippet);
							completionItem.insertText = new SnippetString(snippet.body.join("\n"));
							completionItem.detail = snippet.description;
							items.push(completionItem);
						});

						return items;
					},
				},
				"."
			)
		);

		// --------------------------------
		// HOVER
		// --------------------------------
		this.disposables.push(
			languages.registerHoverProvider(documentSelector, {
				provideHover: (document: TextDocument, position: Position, token: CancellationToken) => {
					const hoveredWord = document.getText(document.getWordRangeAtPosition(position));
					const functionName = hoveredWord.split("(")[0];
					const func = session.registryHandler.getFunction(functionName);
					if (!func) return;
					const script = func.script;

					// Create hover
					const markdown = new MarkdownString();
					markdown.appendCodeblock(func.declarationLineText, "skript");
					markdown.appendText(func.documentation.join("\n"));

					return new Hover([markdown]);
				},
			})
		);

		// --------------------------------
		// DEFINITION
		// --------------------------------
		this.disposables.push(
			languages.registerDefinitionProvider(documentSelector, {
				provideDefinition: (document: TextDocument, position: Position, token: CancellationToken) => {
					const hoveredWord = document.getText(document.getWordRangeAtPosition(position));
					const functionName = hoveredWord.split("(")[0];
					const func = session.registryHandler.getFunction(functionName);
					if (!func) return;
					const script = func.script;

					const location = new Location(Uri.file(script.path), func.declarationRange);

					return [location];
				},
			})
		);
	}

	dispose() {
		for (const disposable of this.disposables) {
			if (disposable.dispose) disposable.dispose();
		}
	}
}
