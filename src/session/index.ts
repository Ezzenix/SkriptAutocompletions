import {
	Disposable,
	ExtensionContext,
	FileSystemWatcher,
	RelativePattern,
	Uri,
	WorkspaceConfiguration,
	commands,
	env,
	window,
	workspace,
} from "vscode";
import { DiagnosticHandler } from "./handlers/diagnosticHandler";
import { ProviderHandler } from "./handlers/providerHandler";
import { RegistryHandler } from "./handlers/registryHandler";

export class Session {
	context: ExtensionContext;
	workspacePath: string;
	watcher: FileSystemWatcher;
	configuration: WorkspaceConfiguration;
	subscriptions: Disposable[];

	registryHandler: RegistryHandler;
	diagnosticHandler: DiagnosticHandler;
	providerHandler: ProviderHandler;

	constructor(context: ExtensionContext, workspacePath: string) {
		this.context = context;
		this.workspacePath = workspacePath;
		this.configuration = workspace.getConfiguration("skriptAutocompletions");
		this.subscriptions = [];

		// Initialize handlers
		this.diagnosticHandler = new DiagnosticHandler(this);
		this.registryHandler = new RegistryHandler(this);
		this.providerHandler = new ProviderHandler(this);

		// Create file watcher
		const pattern = new RelativePattern(workspacePath, "*.sk");
		const watcher = workspace.createFileSystemWatcher(pattern, false, false, false);
		const fileChanged = this.fileChanged.bind(this);
		const fileCreated = this.fileCreated.bind(this);
		const fileDeleted = this.fileDeleted.bind(this);
		watcher.onDidChange(fileChanged);
		watcher.onDidCreate(fileCreated);
		watcher.onDidDelete(fileDeleted);
		this.subscriptions.push(watcher);

		// Start
		this.diagnosticHandler.start();
		this.registryHandler.start();

		// Debug command
		this.subscriptions.push(
			commands.registerCommand("skriptAutocompletions.dumpRegistry", () => {
				const array = new Array(this.registryHandler.registry.size);
				this.registryHandler.registry.forEach((script) => array.push(script));

				const json = JSON.stringify(array, (key, value) => (key === "script" ? undefined : value));

				env.clipboard.writeText(json);
				window.showInformationMessage("Registry dump copied to clipboard as JSON");
			})
		);
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
		for (const disposable of this.subscriptions) {
			if (disposable.dispose) {
				disposable.dispose();
			}
		}
	}
}
