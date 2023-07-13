/*
	Not fully made by me
*/

import {
	CancellationToken,
	Color,
	ColorInformation,
	ColorPresentation,
	ExtensionContext,
	Position,
	Range,
	RelativePattern,
	TextDocument,
	languages,
} from "vscode";
import { Session } from "../session";

function getPos(text: string, index: number): Position {
	const nMatches = Array.from(text.slice(0, index).matchAll(/\n/g));

	const lineNumber = nMatches.length;

	const characterIndex = index - nMatches[lineNumber - 1].index;

	return new Position(lineNumber, characterIndex - 1);
}

function hexToRgba(hex: string) {
	hex = hex.replace("#", "");

	const r = parseInt(hex.substring(0, 2), 16);
	const g = parseInt(hex.substring(2, 4), 16);
	const b = parseInt(hex.substring(4, 6), 16);
	let a = 255;
	if (hex.length === 8) {
		a = parseInt(hex.substring(6, 8), 16);
	}

	//console.log(r, g, b, a);
	return [r, g, b, a];
}

function roundComponent(num: number) {
	return Math.min(Math.max(Math.round(num), 0), 255);
}

function componentToHex(c: number) {
	var hex = c.toString(16);
	return hex.length === 1 ? "0" + hex : hex;
}

function rgbaToHex(r: number, g: number, b: number, a?: number) {
	if (a === 255) a = undefined;
	let hex = "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
	if (a !== undefined) hex = hex + componentToHex(a);
	return hex;
}

// Main function to register
export function colorPicker(context: ExtensionContext) {
	context.subscriptions.push(
		languages.registerColorProvider("skript", {
			// hex to rgba
			provideDocumentColors(document: TextDocument) {
				const text = document.getText();

				const matches = text.matchAll(/#(?:[\da-f]{3,4}){1,2}\b/gi);
				return Array.from(matches).map((match) => {
					const t = match[0];

					const [r, g, b, a] = hexToRgba(t);
					const range = new Range(getPos(text, match.index), getPos(text, match.index + t.length));

					return new ColorInformation(range, new Color(r / 255, g / 255, b / 255, a / 255));
				});
			},
			// rgba to hex
			provideColorPresentations(color, context) {
				//let colorString = context.document.getText(context.range);

				const c = {
					red: roundComponent(color.red * 255),
					green: roundComponent(color.green * 255),
					blue: roundComponent(color.blue * 255),
					alpha: 255,
				};
				if (color.alpha !== null) {
					c.alpha = roundComponent(color.alpha * 255);
				}

				const hex = rgbaToHex(c.red, c.green, c.blue, c.alpha);
				const presentation = new ColorPresentation(hex);

				return [presentation];
			},
		})
	);
}
