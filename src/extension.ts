import { ExtensionContext, workspace } from "vscode";
import { Session } from "./session/index";

export function activate(context: ExtensionContext) {
	console.log("skript autocompletions activated");

	if (workspace.workspaceFolders && workspace.workspaceFolders.length >= 1) {
		const workspacePath = workspace.workspaceFolders[0].uri.fsPath;
		const session = new Session(context, workspacePath);
		context.subscriptions.push(session);
	}
}

export function deactivate() {
	console.log("skript autocompletions deactivated");
}
