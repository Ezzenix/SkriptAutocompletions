import { TextDocument, Uri, workspace } from "vscode";
import { fixPath, readFile } from "./fsWrapper";

export function getDocumentFromPath(filePath: string): TextDocument | undefined {
	filePath = fixPath(filePath);
	const document = workspace.textDocuments.find((doc) => fixPath(doc.uri.fsPath) === filePath);
	return document;
}

// Gets either source from document or from filesystem
export function getLatestSource(path: string) {
	path = fixPath(path);
	const document = getDocumentFromPath(path);
	if (document) {
		return document.getText();
	} else {
		return readFile(path);
	}
}

export function isPathWithin(path: string, within: string) {
	path = fixPath(path);
	within = fixPath(within);
	return path.startsWith(within);
}
