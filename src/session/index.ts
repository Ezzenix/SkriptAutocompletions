import { ExtensionContext, FileSystemWatcher, RelativePattern, Uri, workspace } from "vscode";
import { RegistryHandler } from "./handlers/registryHandler";
import { ProviderHandler } from "./handlers/providerHandler";

export class Session {
	context: ExtensionContext;
	workspacePath: string;
	watcher: FileSystemWatcher;

	registryHandler: RegistryHandler;
	providerHandler: ProviderHandler;

	constructor(context: ExtensionContext, workspacePath: string) {
		this.context = context;
		this.workspacePath = workspacePath;

		// Initialize registry
		this.registryHandler = new RegistryHandler(this);

		// Initialize providers
		const documentSelector = { language: "skript", pattern: new RelativePattern(workspacePath, "**/*.sk") };
		this.providerHandler = new ProviderHandler(this, documentSelector);

		// Create file watcher
		const pattern = new RelativePattern(workspacePath, "*.sk");
		this.watcher = workspace.createFileSystemWatcher(pattern, false, false, false);
		const fileChanged = this.fileChanged.bind(this);
		const fileCreated = this.fileCreated.bind(this);
		const fileDeleted = this.fileDeleted.bind(this);
		this.watcher.onDidChange(fileChanged);
		this.watcher.onDidCreate(fileCreated);
		this.watcher.onDidDelete(fileDeleted);
	}

	fileCreated(uri: Uri) {
		//console.log("fileCreated");
		this.registryHandler.fileCreated(uri);
	}
	fileDeleted(uri: Uri) {
		//console.log("fileDeleted");
		this.registryHandler.fileDeleted(uri);
	}
	fileChanged(uri: Uri) {
		//console.log("fileChanged");
		this.registryHandler.fileChanged(uri);
	}

	dispose() {
		this.watcher.dispose();
		this.providerHandler.dispose();
	}
}
