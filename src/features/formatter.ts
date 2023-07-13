import { Position, Range, TextDocument, window, workspace } from "vscode";
import { getFirstCharIndexInLine } from "../utilities/functions";

/*
THIS IS NOT WORKING YET
NOT BEING USED
*/

const NEW_KEYWORDS = ["function", "on", "command"];

function formatSource(source: string) {
	const lines = source.split("\n");

	const formattedLines = [];

	let indentation = 0;

	for (let line = 0; line < lines.length; line++) {
		const text = lines[line];
		const trimmedText = text.trim();

		if (NEW_KEYWORDS.some((keyword) => trimmedText.startsWith(keyword + " "))) {
			// a new keyword so start over with indentation
			indentation = 0;
		}

		if (trimmedText.startsWith("#")) {
			// don't change comments
			formattedLines.push(text);
			continue;
		}

		formattedLines.push(`${"\t".repeat(indentation)}${trimmedText}`);

		if (trimmedText.endsWith(":")) {
			indentation++;
		}
	}

	return formattedLines.join("\n");
}

export function formatDocument() {
	const editor = window.activeTextEditor;
	if (!editor) return;

	const document = editor.document;
	if (!document || !document.fileName.endsWith(".sk")) return;

	const source = document.getText();
	const newSource = formatSource(source);

	const oldLines = source.split("\n");
	const newLines = newSource.split("\n");

	editor.edit((editBuilder) => {
		for (let line = 0; line <= oldLines.length - 1; line++) {
			const oldText = oldLines[line];
			const newText = newLines[line];
			if (oldText === newText) continue;

			const pos1 = new Position(line, 0);
			const pos2 = new Position(line, Infinity);
			editBuilder.replace(new Range(pos1, pos2), newText);
		}
	});
}
