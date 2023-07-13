import {
	Diagnostic,
	DiagnosticCollection,
	DiagnosticRelatedInformation,
	DiagnosticSeverity,
	Location,
	TextDocument,
	Uri,
	languages,
	window,
	workspace,
} from "vscode";
import { Session } from "..";
import { getDocumentFromPath, isPathWithin } from "../../utilities/functions";
import { Function } from "./registryHandler";
import { fixPath } from "../../utilities/fsWrapper";

function checkAlreadyDeclaredFunction(session: Session, document: TextDocument, diagnostics: Diagnostic[]) {
	const thisScript = session.registryHandler.getScript(document.uri.path);
	if (!thisScript) return;

	const traversedFunctions: { [key: string]: Function[] } = {}; // object with names as key and all declarations as values
	for (const script of session.registryHandler.registry) {
		for (const func of script.meta.functions) {
			if (!traversedFunctions[func.name]) traversedFunctions[func.name] = [];
			traversedFunctions[func.name].push(func);
		}
	}

	for (const functionName in traversedFunctions) {
		const declarations = traversedFunctions[functionName];
		if (declarations.length > 1) {
			declarations.forEach((func) => {
				if (func.script !== thisScript) return; // declaration is not in this file
				diagnostics.push({
					code: "",
					message: `Function ${func.name} is already defined`,
					range: func.declarationRange,
					severity: DiagnosticSeverity.Error,
					source: "",
					relatedInformation: declarations
						.filter((v) => v !== func)
						.map((v) => {
							return new DiagnosticRelatedInformation(
								new Location(Uri.file(v.script.path), v.declarationRange),
								"Also defined here"
							);
						}),
				});
			});
		}
	}
}

export class DiagnosticHandler {
	session: Session;
	collection: DiagnosticCollection;

	constructor(session: Session) {
		this.session = session;
		this.collection = languages.createDiagnosticCollection("skript-autocompletions-diagnostics");
	}

	start() {
		if (window.activeTextEditor) {
			this.updateDiagnostics(window.activeTextEditor.document);
		}
		this.session.context.subscriptions.push(
			window.onDidChangeActiveTextEditor((editor) => {
				this.updateDiagnostics(editor.document);
			})
		);
	}

	updateDiagnostics(document: TextDocument | string) {
		if (typeof document === "string") {
			document = getDocumentFromPath(document);
		}
		if (!document) return this.collection.clear();

		// gather diagnotstics
		const diagnostics = [];

		checkAlreadyDeclaredFunction(this.session, document, diagnostics);

		// set collection
		this.collection.set(document.uri, diagnostics);
	}
}
