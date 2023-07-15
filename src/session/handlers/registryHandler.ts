import { Uri, workspace } from "vscode";
import { Session } from "..";
import { fixPath } from "../../utilities/fsWrapper";
import { getScriptPaths, isPathWithin } from "../../utilities/functions";
import { Parser, Function, Script } from "../../utilities/parser";
import { RERGISTRY_UPDATE_THRESHOLD } from "../../constants";

/**
 * Handles storing and updating script information
 */
export class RegistryHandler {
	session: Session;
	registry = new Map<string, Script>();
	updateQueue = new Set<string>();
	hasQueuedUpdate = false;

	constructor(session: Session) {
		this.session = session;
	}

	/** Runs when the diagnosticsHandler has initialized */
	start() {
		getScriptPaths(this.session.workspacePath).forEach((path) => {
			this.queueUpdate(path);
		});

		// listen for document changes to update registry for
		this.session.subscriptions.push(
			workspace.onDidChangeTextDocument((e) => {
				if (e.contentChanges.length === 0) return;
				const path = fixPath(e.document.uri.fsPath);
				if (isPathWithin(path, this.session.workspacePath)) {
					this.queueUpdate(path);
				}
			})
		);
	}

	/** Registry */
	private _clearUpdateQueue() {
		this.updateQueue.forEach((path) => {
			/** Update each script */
			const script = Parser.parseScript(path, this.session.workspacePath);
			if (script) {
				this.registry.set(path, script);
			} else {
				this.registry.delete(path);
			}
		});

		// console.log(this.registry)

		this.updateQueue.clear();
		this.session.diagnosticHandler.runDiagnosticOnAllFiles();
	}

	queueUpdate(path: string) {
		path = fixPath(path);

		if (this.updateQueue.has(path)) return;
		this.updateQueue.add(path);

		if (this.hasQueuedUpdate) return;
		this.hasQueuedUpdate = true;
		setTimeout(() => {
			this._clearUpdateQueue();
			this.hasQueuedUpdate = false;
		}, RERGISTRY_UPDATE_THRESHOLD);
	}

	remove(path: string) {
		this.registry.delete(fixPath(path));
	}

	/** Helper functions */
	getFunction(name: string): Function | void {
		for (const [_, script] of Array.from(this.registry.entries())) {
			for (const func of script.meta.functions) {
				if (func.name === name) {
					return func;
				}
			}
		}
	}

	getScript(path: string) {
		return this.registry.get(fixPath(path));
	}

	/** File changes */
	fileCreated(uri: Uri) {
		this.queueUpdate(uri.path);
	}
	fileDeleted(uri: Uri) {
		this.remove(uri.path);
	}
	fileChanged(uri: Uri) {
		this.queueUpdate(uri.path);
	}
}
