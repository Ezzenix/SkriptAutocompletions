import {
	Diagnostic,
	DiagnosticCollection,
	DiagnosticRelatedInformation,
	DiagnosticSeverity,
	Location,
	Uri,
	languages,
} from "vscode";
import { Session } from "..";
import { getLatestSource, getScriptPaths } from "../../utilities/functions";
import { Function, Script } from "../../utilities/parser";
import { fixPath } from "../../utilities/fsWrapper";
import { BUILT_IN_FUNCTIONS } from "../../constants";

/**
 * Looks for functions declared with same name
 */
function checkAlreadyDeclaredFunction(session: Session, script: Script, source: string, diagnostics: Diagnostic[]) {
	const traversedFunctions: { [key: string]: Function[] } = {}; // object with names as key and all declarations as values
	session.registryHandler.registry.forEach((script) => {
		script.meta.functions.forEach((func) => {
			if (!traversedFunctions[func.name]) traversedFunctions[func.name] = [];
			traversedFunctions[func.name].push(func);
		});
	});

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

/**
 * Looks for function-calls that call a function that doesn't exist
 */
function checkNonExistingFunctionCall(session: Session, script: Script, source: string, diagnostics: Diagnostic[]) {
	for (const call of script.meta.functionCalls) {
		if (BUILT_IN_FUNCTIONS.includes(call.name)) continue;
		const func = session.registryHandler.getFunction(call.name);
		if (!func) {
			diagnostics.push({
				code: "",
				message: `Function '${call.name}' does not exist`,
				range: call.range,
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

	start() {}

	runDiagnostics(uri: Uri) {
		const script = this.session.registryHandler.getScript(uri.path);
		const source = getLatestSource(uri.path);
		if (!script || !source) return this.collection.delete(uri);

		// gather diagnotstics
		const diagnostics = [];
		checkAlreadyDeclaredFunction(this.session, script, source, diagnostics);
		checkNonExistingFunctionCall(this.session, script, source, diagnostics);

		// set collection
		this.collection.set(uri, diagnostics);
	}

	runDiagnosticOnAllFiles() {
		const paths = getScriptPaths(this.session.workspacePath);

		// update every uri
		paths.forEach((path) => {
			const uri = Uri.file(path);
			if (!uri) return;
			this.session.diagnosticHandler.runDiagnostics(uri);
		});

		// remove uris from collection that don't exist / aren't in use anymore
		this.collection.forEach((uri) => {
			if (!paths.includes(fixPath(uri.path))) {
				this.collection.delete(uri);
			}
		});
	}
}
