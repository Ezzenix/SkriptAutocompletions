import { readdirSync } from "fs";
import { basename, join, relative } from "path";
import { Position, Range, Uri, workspace } from "vscode";
import { Session } from "..";
import { fileStat, fixPath, readFile } from "../../utilities/fsWrapper";
import { isPathWithin, isPositionInString } from "../../utilities/functions";

export type FunctionParam = {
	name: string;
	type: string;
};

export type FunctionUse = {
	name: string;
	params: string;
	range: Range;
};

export type Function = {
	name: string;
	params: FunctionParam[];
	documentation: string[];
	script: Script;
	declarationRange: Range;
	declarationLineText: string;
	isPrivate: boolean;
};

export type Script = {
	name: string;
	path: string;
	relativePath: string;
	meta: {
		functions: Function[];
		functionUses: FunctionUse[];
	};
};

export class RegistryHandler {
	session: Session;
	registry: Script[];

	constructor(session: Session) {
		this.session = session;

		// initialize registry
		this.registry = [];
	}

	start() {
		this.getScriptPaths().forEach((path) => {
			this.updateRegistryFor(path);
		});

		// listen for document changes to update registry for
		this.session.context.subscriptions.push(
			workspace.onDidChangeTextDocument((e) => {
				if (e.contentChanges.length === 0) return;
				const path = fixPath(e.document.uri.fsPath);
				if (isPathWithin(path, this.session.workspacePath)) {
					this.updateRegistryFor(path, e.document.getText());
				}
			})
		);
	}

	// PARSING
	private getCommentsAbove(lines: string[], lineCount: number) {
		const comments = [];

		// start from lineCount and go upwards
		for (let i = lineCount - 1; i >= 0; i--) {
			const text = lines[i];
			if (!text) break;

			const match = text.match(/^\s*#(.+)/);
			if (match) {
				const commentText = match[1];
				if (commentText.trim().length !== 0) {
					comments.unshift(commentText.trim());
				}
			} else if (text.trim().length === 0 && comments.length === 0) {
				// if its empty then continue, but only if no comments have been added yet
				continue;
			} else {
				break;
			}
		}

		return comments;
	}

	private parseFunctions(script: Script, source: string) {
		const functions: Function[] = [];

		const lines = source.split("\n");
		let lineCount = -1;
		for (const line of lines) {
			lineCount += 1;
			const match = line.match(/^\s*function\s+(\w+)\s*(?:\(\s*([\w\s:,]+)\s*\))?/g);
			if (match) {
				const t = match[0].split(" ");
				t.splice(0, 1);
				const split = t.join(" ").split("(");

				const functionName = split[0];
				const paramsText = split[1];
				const params: FunctionParam[] = paramsText
					? paramsText
							.substring(0, paramsText.length - 1) // remove last )
							.split(", ")
							.map((param) => {
								const paramSplit = param.split(": ");
								return {
									name: paramSplit[0],
									type: paramSplit[1],
								};
							})
					: [];

				const documentation = this.getCommentsAbove(lines, lineCount);

				const range = new Range(new Position(lineCount, 0), new Position(lineCount, line.length));

				functions.push({
					name: functionName,
					params: params,
					documentation: documentation,
					script: script,
					declarationRange: range,
					declarationLineText: line,
					isPrivate: documentation.some((comment) => {
						return comment.trim() === "@private";
					}),
				});
			}
		}

		return functions;
	}

	/**
	 * Updates the uses information for every function in the registry
	 */
	private parseFunctionUses(script: Script, source: string): FunctionUse[] {
		const uses = [];

		const lines = source.split("\n");
		const regex = /(?<!\bfunction\s+)\b(\w+)\(([^)]*)\)/g;
		let match;

		lines.forEach((line, lineNumber) => {
			while ((match = regex.exec(line))) {
				const functionName = match[1];
				const parametersString = match[2];
				//const parameters = parametersString.split(",").map((param) => param.trim());

				// Calculate the range of the function usage
				const usageStartPosition = match.index + match[0].indexOf(functionName);
				const usageEndPosition = regex.lastIndex;
				const range = new Range(new Position(lineNumber, usageStartPosition), new Position(lineNumber, usageEndPosition));

				if (line.trim().startsWith("#")) continue; // ignore in comments
				if (isPositionInString(line, range.start.character)) continue; // ignore in strings

				uses.push({
					name: functionName,
					params: parametersString,
					range: range,
				});
			}
		});

		return uses;
	}

	// UPDATE
	private updateRegistryFor(path: string, source?: string) {
		path = fixPath(path);

		if (!source) {
			// if no source was provided then read from the filesystem
			source = readFile(path);
			if (!source) return; // could not read it
		}

		const name = basename(path, ".sk");

		const script = {
			name: name,
			path: path,
			relativePath: path.slice(this.session.workspacePath.length + 1).replace(/\\/g, "/"),
			meta: {
				functions: [],
				functionUses: [],
			},
		};

		script.meta.functions = this.parseFunctions(script, source);
		script.meta.functionUses = this.parseFunctionUses(script, source);

		// add to registry
		this.removeFromRegistryByPath(path);
		this.registry.push(script);

		// diagnostics
		this.runDiagnosticOnAllFiles();

		//console.log(this.registry);
	}

	private runDiagnosticOnAllFiles() {
		for (const script of this.registry) {
			const uri = Uri.file(script.path);
			if (!uri) continue;
			this.session.diagnosticHandler.updateDiagnostics(uri);
		}
	}

	// -------------
	getFunction(name: string): Function | void {
		for (const script of this.registry) {
			for (const func of script.meta.functions) {
				if (func.name === name) {
					return func;
				}
			}
		}
	}

	getScript(path: string) {
		path = fixPath(path);
		for (const script of this.registry) {
			if (script.path === path) {
				return script;
			}
		}
	}

	private getScriptPaths() {
		const scripts = [];

		function traverse(path: string) {
			const stat = fileStat(path);
			if (!stat) return; // something went wrong or file doesn't exist

			if (stat.isDirectory()) {
				readdirSync(path).forEach((file) => {
					traverse(join(path, file));
				});
			} else {
				if (path.endsWith(".sk")) scripts.push(path);
			}
		}

		traverse(this.session.workspacePath);
		return scripts;
	}

	private removeFromRegistryByPath(path: string) {
		path = fixPath(path);

		const script = this.registry.find((v) => v.path === path);
		if (!script) return;
		const index = this.registry.indexOf(script);
		if (index === -1) return;
		this.registry.splice(index, 1);
	}

	fileCreated(uri: Uri) {
		this.updateRegistryFor(uri.path);
	}
	fileDeleted(uri: Uri) {
		this.removeFromRegistryByPath(uri.path);
	}
	fileChanged(uri: Uri) {
		this.updateRegistryFor(uri.path);
	}
}
