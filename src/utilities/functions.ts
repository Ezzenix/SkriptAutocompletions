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
