import { Position, Range } from "vscode";
import { readFile } from "../../utilities/fsWrapper";
import { basename } from "path";
import { getDocumentFromPath, getLatestSource } from "../../utilities/functions";

export type FunctionParam = {
	name: string;
	type: string;
};

export type FunctionUse = {
	name: string;
	params: string;
	range: Range;
};

export type Function = {
	name: string;
	params: FunctionParam[];
	documentation: string[];
	script: Script;
	declarationRange: Range;
	declarationLineText: string;
	isPrivate: boolean;
};

export type Script = {
	name: string;
	path: string;
	relativePath: string;
	meta: {
		functions: Function[];
		functionUses: FunctionUse[];
	};
};

export class Parser {
	static isCommented(line: string) {
		return line.trim().startsWith("#");
	}

	static getCommentsAbove(lines: string[], lineCount: number) {
		const comments = [];

		// start from lineCount and go upwards
		for (let i = lineCount - 1; i >= 0; i--) {
			const text = lines[i];
			if (!text) break;

			const match = text.match(/^\s*#(.+)/);
			if (match) {
				const commentText = match[1];
				if (commentText.trim().length !== 0) {
					comments.unshift(commentText.trim());
				}
			} else if (text.trim().length === 0 && comments.length === 0) {
				// if its empty then continue, but only if no comments have been added yet
				continue;
			} else {
				break;
			}
		}

		return comments;
	}

	static parseFunctions(script: Script, source: string) {
		const functions: Function[] = [];

		const lines = source.split("\n");
		let lineCount = -1;
		for (const line of lines) {
			lineCount += 1;
			const match = line.match(/^\s*function\s+(\w+)\s*(?:\(\s*([\w\s:,]+)\s*\))?/g);
			if (match) {
				const t = match[0].split(" ");
				t.splice(0, 1);
				const split = t.join(" ").split("(");

				const functionName = split[0];
				const paramsText = split[1];
				const params: FunctionParam[] = paramsText
					? paramsText
							.substring(0, paramsText.length - 1) // remove last )
							.split(", ")
							.map((param) => {
								const paramSplit = param.split(": ");
								return {
									name: paramSplit[0],
									type: paramSplit[1],
								};
							})
					: [];

				const documentation = this.getCommentsAbove(lines, lineCount);

				const range = new Range(new Position(lineCount, 0), new Position(lineCount, line.length));

				functions.push({
					name: functionName,
					params: params,
					documentation: documentation,
					script: script,
					declarationRange: range,
					declarationLineText: line,
					isPrivate: documentation.some((comment) => {
						return comment.trim() === "@private";
					}),
				});
			}
		}

		return functions;
	}

	/**
	 * Updates the uses information for every function in the registry
	 */
	static parseFunctionUses(script: Script, source: string): FunctionUse[] {
		const uses = [];

		const lines = source.split("\n");
		const regex = /(?<!\bfunction\s+)\b(\w+)\(([^)]*)\)/g;
		let match;

		lines.forEach((line, lineNumber) => {
			while ((match = regex.exec(line))) {
				const functionName = match[1];
				const parametersString = match[2];
				//const parameters = parametersString.split(",").map((param) => param.trim());

				// Calculate the range of the function usage
				const usageStartPosition = match.index + match[0].indexOf(functionName);
				const usageEndPosition = regex.lastIndex;
				const range = new Range(new Position(lineNumber, usageStartPosition), new Position(lineNumber, usageEndPosition));

				if (line.trim().startsWith("#")) continue; // ignore in comments
				if (Parser.isPositionInString(line, range.start.character)) continue; // ignore in strings

				uses.push({
					name: functionName,
					params: parametersString,
					range: range,
				});
			}
		});

		return uses;
	}

	static getFirstCharIndexInLine(line: string) {
		let charIndex = 0;
		while ((Parser.isWhitespace(line[charIndex]) || line[charIndex] === "#") && charIndex < line.length - 1) {
			charIndex++;
		}
		return charIndex;
	}

	static isWhitespace(char: string) {
		if (typeof char !== "string") return false;
		return char.trim() === "";
	}

	static isPositionInString(line: string, character: number): boolean {
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

	static parseScript(path: string, workspacePath: string) {
		const source = getLatestSource(path);
		if (!source) return; // could not read it

		const script = {
			name: basename(path, ".sk"),
			path: path,
			relativePath: path.slice(workspacePath.length + 1).replace(/\\/g, "/"),
			meta: {
				functions: [],
				functionUses: [],
			},
		};

		script.meta.functions = this.parseFunctions(script, source);
		script.meta.functionUses = this.parseFunctionUses(script, source);

		return script;
	}
}
