import { ExtensionContext, FileSystemWatcher, RelativePattern, Uri, WorkspaceConfiguration, workspace } from "vscode";
import { DiagnosticHandler } from "./handlers/diagnosticHandler";
import { ProviderHandler } from "./handlers/providerHandler";
import { RegistryHandler } from "./handlers/registryHandler";
import { colorPicker } from "./handlers/colorPicker";

export class Session {
	context: ExtensionContext;
	workspacePath: string;
	watcher: FileSystemWatcher;
	configuration: WorkspaceConfiguration;

	registryHandler: RegistryHandler;
	diagnosticHandler: DiagnosticHandler;
	providerHandler: ProviderHandler;

	constructor(context: ExtensionContext, workspacePath: string) {
		this.context = context;
		this.workspacePath = workspacePath;
		this.configuration = workspace.getConfiguration("skriptAutocompletions");

		// Initialize handlers
		this.diagnosticHandler = new DiagnosticHandler(this);
		this.registryHandler = new RegistryHandler(this);
		this.providerHandler = new ProviderHandler(this);

		// Create file watcher
		const pattern = new RelativePattern(workspacePath, "*.sk");
		this.watcher = workspace.createFileSystemWatcher(pattern, false, false, false);
		const fileChanged = this.fileChanged.bind(this);
		const fileCreated = this.fileCreated.bind(this);
		const fileDeleted = this.fileDeleted.bind(this);
		this.watcher.onDidChange(fileChanged);
		this.watcher.onDidCreate(fileCreated);
		this.watcher.onDidDelete(fileDeleted);

		// Start
		this.diagnosticHandler.start();
		this.registryHandler.start();

		colorPicker(this);
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

	destroy() {
		this.watcher.dispose();
	}
}
