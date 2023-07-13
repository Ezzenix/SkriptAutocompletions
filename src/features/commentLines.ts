import { ExtensionContext, Position, Range, commands, window } from "vscode";

function isCommented(line: string) {
	if (typeof line !== "string") return false;
	return line.trim().startsWith("#");
}

function isWhitespace(char: string) {
	if (typeof char !== "string") return false;
	return char.trim() === "";
}

function getFirstCharIndexInLine(line: string) {
	let charIndex = 0;
	while ((isWhitespace(line[charIndex]) || line[charIndex] === "#") && charIndex < line.length - 1) {
		charIndex++;
	}
	return charIndex;
}

function execute() {
	const editor = window.activeTextEditor;
	if (!editor) return; // No active editor

	const document = editor.document;
	if (!document.fileName.endsWith(".sk")) return; // Not a .sk file

	editor.edit((editBuilder) => {
		for (const selection of editor.selections) {
			const startLine = selection.start.line;
			const endLine = selection.end.line;

			// determine if we should add or remove comments based on what the majority already is
			const lineAmount = endLine - startLine + 1;
			let commentedAmount = 0;
			for (let line = startLine; line <= endLine; line++) {
				const text = document.lineAt(line).text;
				if (isCommented(text)) commentedAmount++;
			}
			const action = commentedAmount / lineAmount > 0.5 ? "uncomment" : "comment";

			for (let line = startLine; line <= endLine; line++) {
				const text = document.lineAt(line).text;
				if (text.trim() === "") {
					continue; // do not change completely empty lines
				} else if (isCommented(text) && action === "uncomment") {
					const charIndex = text.indexOf("#");
					const pos1 = new Position(line, charIndex);
					const pos2 = new Position(line, charIndex + 1);
					editBuilder.replace(new Range(pos1, pos2), "");
				} else if (!isCommented(text) && action === "comment") {
					const charIndex = getFirstCharIndexInLine(text);
					const pos1 = new Position(line, charIndex);
					const pos2 = new Position(line, charIndex);
					editBuilder.replace(new Range(pos1, pos2), "#");
				}
			}
		}
	});
}

export function commentLines(context: ExtensionContext) {
	context.subscriptions.push(commands.registerCommand("skriptAutocompletions.commentLines", execute));
}
