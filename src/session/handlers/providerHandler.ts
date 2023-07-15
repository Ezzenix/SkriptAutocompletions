import {
	CancellationToken,
	CompletionContext,
	CompletionItem,
	CompletionItemKind,
	Hover,
	InlayHint,
	InlayHintKind,
	Location,
	MarkdownString,
	Position,
	Range,
	RelativePattern,
	SignatureHelp,
	SignatureInformation,
	SnippetString,
	TextDocument,
	Uri,
	languages,
} from "vscode";
import { Session } from "..";
import * as snippets from "../../snippets.json";
import { Parser } from "../../utilities/parser";

export class ProviderHandler {
	constructor(session: Session) {
		const workspacePath = session.workspacePath;
		const registryHandler = session.registryHandler;
		const registry = registryHandler.registry;

		const documentSelector = { language: "skript", pattern: new RelativePattern(workspacePath, "**/*.sk") };

		// --------------------------------
		// COMPLETION
		// --------------------------------
		session.subscriptions.push(
			languages.registerCompletionItemProvider(
				documentSelector,
				{
					provideCompletionItems: (
						document: TextDocument,
						position: Position,
						token: CancellationToken,
						context: CompletionContext
					) => {
						if (Parser.isPositionInString(document.lineAt(position.line).text, position.character)) {
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
											new Position(
												position.line,
												Math.max(position.character - typedText.length - 2, 0)
											)
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
										displayName === script.relativePath
											? displayName
											: `${displayName} (${script.relativePath})`;
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
		session.subscriptions.push(
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
		session.subscriptions.push(
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
		session.subscriptions.push(
			languages.registerSignatureHelpProvider(
				documentSelector,
				{
					provideSignatureHelp: (document: TextDocument, position: Position, token: CancellationToken) => {
						const script = registryHandler.getScript(document.uri.path);
						if (!script) return;

						const call = script.meta.functionCalls.find((v) => {
							return position.isAfter(v.range.start) && position.isBefore(v.range.end); // if position is within the range
						});
						if (!call) return;
						const func = registryHandler.getFunction(call.name);
						if (!func) return;

						const charIndex = position.character - call.range.start.character;

						const paramCharIndex = charIndex - call.name.length - 1;
						if (paramCharIndex < 0) return;

						const paramsTextToCursor = paramCharIndex === 0 ? "" : call.params.substring(0, paramCharIndex);
						const paramIndex = paramsTextToCursor.split(",").length - 1;

						const paramData = func.params[paramIndex];
						if (!paramData) return;

						// Create signature
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

		// --------------------------------
		// INLAY HINT
		// --------------------------------
		session.subscriptions.push(
			languages.registerInlayHintsProvider(documentSelector, {
				provideInlayHints: (document: TextDocument, range: Range, token: CancellationToken) => {
					if (!session.configuration.get("inlayHints")) return null;

					const script = registryHandler.getScript(document.uri.path);
					if (!script) return;

					const hints: InlayHint[] = [];
					const text = document.getText(range);

					script.meta.functionCalls.forEach((call) => {
						const func = registryHandler.getFunction(call.name);
						if (!func) return;

						// check if call is within the range to compute for
						if (!call.range.start.isAfterOrEqual(range.start) || !call.range.end.isBeforeOrEqual(range.end))
							return;

						let charIndex = call.name.length + 1;
						let paramIndex = 0;

						for (const paramText of call.params.split(",")) {
							if (paramText.trim() === "") continue;

							while (call.params[charIndex - call.name.length - 1] === " ") {
								charIndex += 1;
							}

							const paramData = func.params[paramIndex];
							if (paramData) {
								const pos = new Position(call.range.start.line, charIndex + call.range.start.character);
								hints.push(new InlayHint(pos, `${paramData.name}: `, InlayHintKind.Parameter));
							}

							charIndex += paramText.length + 1;
							paramIndex += 1;
						}
					});

					return hints;
				},
			})
		);
	}
}
