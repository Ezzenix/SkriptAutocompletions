import * as fs from "fs";
import { normalize } from "path";

const DEBUG_MODE = true;

/*
	Converts a path to a more consistent format
*/
export function fixPath(path: string) {
	path = normalize(path);

	path.replace(/\//g, "\\"); // replace / with \
	path.replace(/\\\\/g, "\\"); // replace double \\ with single \

	if (path.startsWith("\\")) {
		path = path.substring(1, path.length);
	}
	if (path.endsWith("\\")) {
		path = path.substring(0, path.length - 1);
	}

	return path;
}

/*
	Reads the file at the given path
	Automatically parses .json if 'doNotParse' is not true
*/
export function readFile(path: string, doNotParse = false) {
	path = fixPath(path);
	try {
		const contents = fs.readFileSync(path);
		if (contents) {
			if (path.endsWith(".json") && !doNotParse) {
				return JSON.parse(contents.toString());
			} else {
				return contents.toString();
			}
		}
	} catch (err) {
		if (DEBUG_MODE) console.error(err);
		return;
	}
}

/*
	Writes to the file at the given path
*/
export function writeFile(path: string, contents: string) {
	path = fixPath(path);
	try {
		fs.writeFileSync(path, contents, `utf8`);
		return true;
	} catch (err) {
		if (DEBUG_MODE) console.error(err);
		return false;
	}
}

/*
	Returns true or false depending on if a file exists
*/
export function fileExists(path: string) {
	path = fixPath(path);
	try {
		fs.accessSync(path);
		return true;
	} catch (err) {
		return false;
	}
}

/*
	Gets the stat of a file at the given path
*/
export function fileStat(path: string) {
	path = fixPath(path);
	try {
		const stat = fs.statSync(path);
		return stat;
	} catch (err) {
		return false;
	}
}
