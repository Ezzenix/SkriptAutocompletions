import { Position, workspace } from "vscode";
import { fileStat, fixPath, readFile } from "./fsWrapper";
import { readdirSync } from "fs";
import { basename, join } from "path";

/**
 * Gets a vscode document from path
 * @param path The path
 * @returns TextDocument
 */
export function getDocumentFromPath(path: string) {
	path = fixPath(path);
	const document = workspace.textDocuments.find((doc) => fixPath(doc.uri.fsPath) === path);
	return document;
}

/**
 * Gets the latest source from a file
 * @param path Path to file
 * @returns Source
 */
export function getLatestSource(path: string) {
	path = fixPath(path);
	const document = getDocumentFromPath(path);
	return document ? document.getText() : readFile(path);
}

/**
 * Checks if a path is within a directory
 * @param path Path to check
 * @param within Directory to check
 * @returns Boolean
 */
export function isPathWithin(path: string, dir: string) {
	return fixPath(path).startsWith(fixPath(dir));
}

/**
 * Gets all script paths in a directory, does not include disabled scripts
 * @param dirPath The directory path
 * @returns Paths
 */
export function getScriptPaths(dirPath: string) {
	const scripts = [];

	function traverse(path: string) {
		const stat = fileStat(path);
		if (!stat) return; // something went wrong or file doesn't exist

		if (stat.isDirectory()) {
			readdirSync(path).forEach((file) => {
				traverse(join(path, file));
			});
		} else {
			const name = basename(path);
			if (name.endsWith(".sk") && !name.startsWith("-")) {
				// only non-disabled .sk files
				scripts.push(fixPath(path));
			}
		}
	}

	traverse(dirPath);
	return scripts;
}

/**
 * Takes a source and a character index and creates a position object
 * @param source The source
 * @param index Index
 * @returns Position
 */
export function getPos(source: string, index: number): Position {
	const nMatches = Array.from(source.slice(0, index).matchAll(/\n/g));
	const lineNumber = nMatches.length;
	const characterIndex = index - nMatches[lineNumber - 1].index;
	return new Position(lineNumber, characterIndex - 1);
}
