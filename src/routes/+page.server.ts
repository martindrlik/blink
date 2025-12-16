import { encodeBase32LowerCase } from '@oslojs/encoding';
import type { PageLoad } from './$types';

export const load: PageLoad = () => {
	return {
		gameId: generateRandom(),
		gameResult: game(diceRoll8(), diceRoll8()).toArray()
	};
};

function* game(player: Uint8Array<ArrayBuffer>, opponent: Uint8Array<ArrayBuffer>) {
	for (let i = 0; i < Math.min(player.length, opponent.length); i++) {
		yield winner(player[i], opponent[i]);
	}
}

function winner(player: number, opponent: number): string {
	if (player > opponent) return 'player won';
	if (player < opponent) return 'opponent won';
	return 'draw';
}

function generateRandom() {
	// 120 bits of entropy, or about the same as UUID v4.
	const bytes = crypto.getRandomValues(new Uint8Array(15));
	const id = encodeBase32LowerCase(bytes);
	return id;
}

function diceRoll8() {
	const array = new Uint8Array(8);
	crypto.getRandomValues(array);
	return array;
}
