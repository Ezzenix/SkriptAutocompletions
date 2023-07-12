import { Session } from "..";
import {
	CancellationToken,
	CompletionContext,
	CompletionItem,
	CompletionItemKind,
	Disposable,
	DocumentSelector,
	Hover,
	InlayHint,
	InlayHintKind,
	Location,
	MarkdownString,
	ParameterInformation,
	Position,
	Range,
	SignatureHelp,
	SignatureInformation,
	SnippetString,
	TextDocument,
	Uri,
	languages,
} from "vscode";

import * as snippets from "../../snippets.json";
import { isPositionInString } from "../../utilities/functions";

export class ProviderHandler {
	disposables: Disposable[] = [];

	constructor(session: Session, documentSelector: DocumentSelector) {
		const workspacePath = session.workspacePath;
		const registryHandler = session.registryHandler;
		const registry = registryHandler.registry;

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
						if (isPositionInString(document.lineAt(position.line).text, position.character)) {
							return;
						}

						const items = [];
						const typedRange = document.getWordRangeAtPosition(position);
						const typedText = document.getText(typedRange);

						const activeScript = registryHandler.getScript(document.uri.path);

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
								const functions = script.meta.functions.filter((func) => {
									// filter private functions
									if (!func.isPrivate) return true; // public
									return func.script === activeScript;
								});
								functions.forEach((func) => {
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

		// --------------------------------
		// SIGNATURE HELP
		// --------------------------------
		/* Delayed, disabled for now
		this.disposables.push(
			languages.registerSignatureHelpProvider(
				documentSelector,
				{
					provideSignatureHelp: (document: TextDocument, position: Position, token: CancellationToken) => {
						const currentLine = document.lineAt(position.line).text;
						//const currentWord = document.getText(document.getWordRangeAtPosition(position));

						// Check if its in declaration
						const fullLine = document.getText(new Range(new Position(position.line, 0), new Position(position.line, Infinity)));
						if (fullLine.startsWith("function ")) {
							return;
						}

						// Get the function
						const functionNameMatch = currentLine.match(/([a-zA-Z_][\w]*)\s*\(/);
						const functionName = functionNameMatch ? functionNameMatch[1] : "";
						const func = registryHandler.getFunction(functionName);
						if (!func) return;

						// Get the written arguments
						const argsString = currentLine.substring(currentLine.indexOf("(") + 1, position.character);
						const argsText = argsString.split(",").map((arg) => arg.trim());

						// Prepare information
						const index = argsText.length - 1;
						const paramData = func.params[index];
						if (!paramData) return;

						// Check if the position is within the function call parentheses
						const parenthesesStack: string[] = [];
						let withinFunctionCall = true;
						let foundOpeningParenthesis = false;

						for (let i = 0; i < currentLine.length; i++) {
							const char = currentLine[i];

							if (char === "(") {
								parenthesesStack.push(char);
								foundOpeningParenthesis = true;
							} else if (char === ")" && foundOpeningParenthesis) {
								parenthesesStack.pop();
							}

							if (i === position.character) {
								break;
							}
						}

						if (parenthesesStack.length > 0) {
							withinFunctionCall = false;
						}

						if (!withinFunctionCall) {
							return null;
						}

						// Create signatures
						const help = new SignatureHelp();

						const sign = new SignatureInformation(`${paramData.name}: ${paramData.type}`);
						help.signatures.push(sign);

						help.activeSignature = 0;
						help.activeParameter = 0;
						return help;
					},
				},
				{ triggerCharacters: ["(", ","], retriggerCharacters: ["(", ","] } // Specify trigger and retrigger characters
			)
		);
		*/
	}

	dispose() {
		for (const disposable of this.disposables) {
			if (disposable.dispose) disposable.dispose();
		}
	}
}
