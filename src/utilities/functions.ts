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

export function getFirstCharIndexInLine(line: string) {
	let charIndex = 0;
	while ((isWhitespace(line[charIndex]) || line[charIndex] === "#") && charIndex < line.length - 1) {
		charIndex++;
	}
	return charIndex;
}

export function isCommented(line: string) {
	if (typeof line !== "string") return false;
	return line.trim().startsWith("#");
}

export function isWhitespace(char: string) {
	if (typeof char !== "string") return false;
	return char.trim() === "";
}
