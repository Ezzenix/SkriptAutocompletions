import { ExtensionContext, WorkspaceFolder, workspace } from "vscode";
import { Session } from "./session/index";
import { fixPath } from "./utilities/fsWrapper";

export function activate(context: ExtensionContext) {
	console.log("skript autocompletions activated");

	// ALl session objects
	const sessions: { [key: string]: Session } = {};

	function createSession(workspaceFolder: WorkspaceFolder) {
		const path = fixPath(workspaceFolder.uri.path);
		if (sessions[path]) return sessions[path];
		const session = new Session(context, path);
		sessions[path] = session;
		return session;
	}

	function removeSession(workspaceFolder: WorkspaceFolder) {
		const path = fixPath(workspaceFolder.uri.path);
		const session = sessions[path];
		if (!session) return;
		session.destroy();
		delete sessions[path];
	}

	// Listen for when workspaces are added/removed
	context.subscriptions.push(
		workspace.onDidChangeWorkspaceFolders((event) => {
			for (const workspaceFolder of event.added) {
				createSession(workspaceFolder);
			}
			for (const workspaceFolder of event.removed) {
				removeSession(workspaceFolder);
			}
		})
	);

	// Add the already open ones
	for (const workspaceFolder of workspace.workspaceFolders) {
		createSession(workspaceFolder);
	}
}

export function deactivate() {
	console.log("skript autocompletions deactivated");
}
