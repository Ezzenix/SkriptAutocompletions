import { readdirSync } from "fs";
import { Session } from "..";
import { fileStat, fixPath, readFile } from "../../utilities/fsWrapper";
import { basename, join, relative } from "path";
import { Disposable, Position, Range, Uri, workspace } from "vscode";

export type FunctionParam = {
	name: string;
	type: string;
};

export type Function = {
	name: string;
	params: FunctionParam[];
	documentation: string[];
	script: Script;
	declarationRange: Range;
	declarationLineText: string;
};

export type Script = {
	name: string;
	path: string;
	relativePath: string;
	meta: {
		functions: Function[];
	};
};

export class RegistryHandler {
	session: Session;
	registry: Script[];
	documentListener: Disposable;

	constructor(session: Session) {
		this.session = session;

		// initialize registry
		this.registry = [];
		this.getScriptPaths().forEach((path) => {
			this.updateRegistryFor(path);
		});

		// listen for document changes to update registry for
		this.documentListener = workspace.onDidChangeTextDocument((e) => {
			const isInWorkspace = relative(e.document.uri.fsPath, session.workspacePath).startsWith("..");
			if (!isInWorkspace) return;
			this.updateRegistryFor(fixPath(e.document.uri.path));
		});
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
					comments.unshift(commentText);
				}
			} else if (text.trim().length === 0) {
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
		for (const line of lines) {
			const match = line.match(/^\s*function\s+(\w+)\s*\(\s*([\w\s:]+)\s*\)/g);
			if (match) {
				const lineCount = lines.indexOf(line);

				const t = match[0].split(" ");
				t.splice(0, 1);
				const split = t.join(" ").split("(");

				const functionName = split[0];
				const paramsText = split[1];
				const params: FunctionParam[] = paramsText
					.substring(0, paramsText.length - 1) // remove last )
					.split(", ")
					.map((param) => {
						const paramSplit = param.split(": ");
						return {
							name: paramSplit[0],
							type: paramSplit[1],
						};
					});

				const documentation = this.getCommentsAbove(lines, lineCount);

				const range = new Range(new Position(lineCount, 0), new Position(lineCount, line.length));

				functions.push({
					name: functionName,
					params: params,
					documentation: documentation,
					script: script,
					declarationRange: range,
					declarationLineText: line,
				});
			}
		}

		return functions;
	}

	// UPDATE
	private updateRegistryFor(path: string, source?: string) {
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
			},
		};

		script.meta.functions = this.parseFunctions(script, source);

		// add to registry
		this.removeFromRegistryByPath(path);
		this.registry.push(script);
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
