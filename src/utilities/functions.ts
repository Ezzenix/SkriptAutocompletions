import { TextDocument, Uri, workspace } from "vscode";
import { fixPath } from "./fsWrapper";

export function isPositionInString(line: string, character: number): boolean {
	let insideString = false;
	let isInEscapeSequence = false;

	for (let i = 0; i < character; i++) {
		const char = line[i];

		if (char === '"') {
			if (!isInEscapeSequence) {
				insideString = !insideString;
			}
		}

		isInEscapeSequence = char === "\\" && !isInEscapeSequence;
	}

	return insideString;
}

export function getDocumentFromPath(filePath: string): TextDocument | undefined {
	const uri = Uri.file(filePath);
	const document = workspace.textDocuments.find((doc) => doc.uri.toString() === uri.toString());
	return document;
}

export function isPathWithin(path: string, within: string) {
	path = fixPath(path);
	within = fixPath(within);
	return path.startsWith(within);
}
