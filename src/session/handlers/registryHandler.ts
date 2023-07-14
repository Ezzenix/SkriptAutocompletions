import { readdirSync } from "fs";
import { basename, join } from "path";
import { Uri, workspace } from "vscode";
import { Session } from "..";
import { fileStat, fixPath } from "../../utilities/fsWrapper";
import { isPathWithin } from "../../utilities/functions";
import { Parser, Function, Script } from "./parser";

export class RegistryHandler {
	session: Session;
	registry: Script[];
	updateQueue: string[];
	hasQueuedUpdate = false;

	constructor(session: Session) {
		this.session = session;
		this.registry = [];
		this.updateQueue = [];
	}

	start() {
		this.getScriptPaths().forEach((path) => {
			this.queueForUpdate(path);
		});

		// listen for document changes to update registry for
		this.session.subscriptions.push(
			workspace.onDidChangeTextDocument((e) => {
				if (e.contentChanges.length === 0) return;
				const path = fixPath(e.document.uri.fsPath);
				if (isPathWithin(path, this.session.workspacePath)) {
					this.queueForUpdate(path);
				}
			})
		);
	}

	// UPDATE
	private _update(path: string) {
		path = fixPath(path);

		const script = Parser.parseScript(path, this.session.workspacePath);
		if (!script) return; // something went wrong

		this.removeFromRegistryByPath(path);
		this.registry.push(script);
	}

	private _clearUpdateQueue() {
		for (const path of this.updateQueue) {
			this._update(path);
		}
		this.updateQueue.length = 0; // reset queue

		// look for duplicates just to be sure
		const traversedPaths = new Set();
		this.registry = this.registry.filter((script) => {
			const path = script.path.toLowerCase();
			if (traversedPaths.has(path)) return false;
			traversedPaths.add(path);
			return true;
		});

		// run diagnostics
		this.session.diagnosticHandler.runDiagnosticOnAllFiles();
	}

	queueForUpdate(path: string) {
		path = fixPath(path);

		const name = basename(path);
		if (name.startsWith("-")) return; // skip disabled scripts

		if (this.updateQueue.find((v) => v === path)) return;
		this.updateQueue.push(path);

		if (this.hasQueuedUpdate) return;
		this.hasQueuedUpdate = true;
		setTimeout(() => {
			this._clearUpdateQueue();
			this.hasQueuedUpdate = false;
		}, 500);
	}

	// Gets a function by name
	getFunction(name: string): Function | void {
		for (const script of this.registry) {
			for (const func of script.meta.functions) {
				if (func.name === name) {
					return func;
				}
			}
		}
	}

	// Gets a script by name
	getScript(path: string) {
		path = fixPath(path);
		for (const script of this.registry) {
			if (script.path === path) {
				return script;
			}
		}
	}

	// Get all paths to .sk files in the workspace
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
				if (path.endsWith(".sk")) scripts.push(fixPath(path));
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
		this.queueForUpdate(uri.path);
	}
	fileDeleted(uri: Uri) {
		this.removeFromRegistryByPath(uri.path);
	}
	fileChanged(uri: Uri) {
		this.queueForUpdate(uri.path);
	}
}
