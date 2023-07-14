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
import { Function, Script } from "./registryHandler";
import { fixPath, readFile } from "../../utilities/fsWrapper";

function checkAlreadyDeclaredFunction(session: Session, script: Script, source: string, diagnostics: Diagnostic[]) {
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
				if (func.script !== script) return; // declaration is not in this file
				diagnostics.push({
					code: "",
					message: `Function '${func.name}' is already defined`,
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

const BUILTIN_SKRIPT_FUNCTIONS = [
	"abs",
	"acos",
	"asin",
	"atan",
	"atan2",
	"calcExperience",
	"caseEquals",
	"ceil",
	"ceiling",
	"cos",
	"date",
	"exp",
	"floor",
	"ln",
	"location",
	"log",
	"max",
	"min",
	"mod",
	"product",
	"rgb",
	"round",
	"sin",
	"sqrt",
	"sum",
	"tan",
	"vector",
	"world",
];
function checkNonExistingFunctionUse(session: Session, script: Script, source: string, diagnostics: Diagnostic[]) {
	for (const use of script.meta.functionUses) {
		if (BUILTIN_SKRIPT_FUNCTIONS.includes(use.name)) continue;
		const func = session.registryHandler.getFunction(use.name);
		if (!func) {
			diagnostics.push({
				code: "",
				message: `Function '${use.name}' does not exist`,
				range: use.range,
				severity: DiagnosticSeverity.Error,
				source: "",
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
		/* if (window.activeTextEditor) {
			this.updateDiagnostics(window.activeTextEditor.document.uri);
		} */
		/* this.session.context.subscriptions.push(
			window.onDidChangeActiveTextEditor((editor) => {
				this.updateDiagnostics(editor.document.uri);
			})
		); */
	}

	/**
	 * Gets the source of an uri, if a document is open use that (unsaved source also)
	 * Otherwise read the file from the filesystem
	 */
	private getSource(uri: Uri) {
		const path = fixPath(uri.path);
		const document = getDocumentFromPath(path);
		if (document) {
			return document.getText();
		} else {
			return readFile(path);
		}
	}

	updateDiagnostics(uri: Uri) {
		const script = this.session.registryHandler.getScript(uri.path);
		if (!script) return;

		const source = this.getSource(uri);
		if (!source) return;

		// gather diagnotstics
		const diagnostics = [];

		checkAlreadyDeclaredFunction(this.session, script, source, diagnostics);
		checkNonExistingFunctionUse(this.session, script, source, diagnostics);

		// set collection
		this.collection.set(uri, diagnostics);
	}
}
