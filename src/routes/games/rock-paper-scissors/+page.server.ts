import { randomUint8 } from '$lib/random';
import type { Cookies } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
	const player2Turns = cookies.get('player2');

	if (!player2Turns) {
		constructPlayer2Turns([...randomShapes(5)], cookies);
	}
	return {
		turns: [...deconstructTurns(cookies)].map((x) => toUiTurn(x))
	};
};

function constructTurns(turns: Turn[], cookies: Cookies) {
	cookies.set('turns', turns.map((x) => constructTurn(x)).join(','), { path: '/' });
}

function constructTurn(turn: { player1: Shape; player2: Shape; result: TurnResult }): string {
	return `${turn.player1}-${turn.player2}-${turn.result}`;
}

function deconstructTurns(cookies: Cookies): Iterable<Turn> {
	const turns = cookies.get('turns');
	if (turns === undefined || turns === '') return [];
	return turns.split(',').map((turn) => deconstructTurn(turn));
}

function deconstructTurn(turn: string): Turn {
	const turnArray = turn.split('-');
	return {
		player1: parseInt(turnArray[0]),
		player2: parseInt(turnArray[1]),
		result: parseInt(turnArray[2])
	};
}

function toUiTurn(turn: Turn): UiTurn {
	const { player1, player2, result } = turn;
	return {
		player1: shapeString(player1),
		player2: shapeString(player2),
		result: result
	};
}

interface Turn {
	player1: Shape;
	player2: Shape;
	result: TurnResult;
}

interface UiTurn {
	player1: string;
	player2: string;
	result: number;
}

export const actions = {
	rock: async ({ cookies }) => {
		turnAndStore(Shape.Rock, cookies);
	},
	paper: async ({ cookies }) => {
		turnAndStore(Shape.Paper, cookies);
	},
	scissors: async ({ cookies }) => {
		turnAndStore(Shape.Scissers, cookies);
	},
	reset: async ({ cookies }) => {
		cookies.set('turns', '', { path: '/' });
		constructPlayer2Turns([...randomShapes(5)], cookies);
	}
} satisfies Actions;

function turnAndStore(player1: Shape, cookies: Cookies) {
	const player2Turns = [...deconstructPlayer2Turns(cookies)];
	const player2 = player2Turns[0];
	const result = turn(player1, player2);
	const turns = [...deconstructTurns(cookies)];
	turns.push({ player1, player2, result });
	constructTurns(turns.length > 5 ? turns.slice(1, 6) : turns, cookies);
	constructPlayer2Turns(player2Turns.slice(1), cookies);
}

function turn(player1: Shape, player2: Shape): TurnResult {
	switch (player2) {
		case Shape.Rock:
			switch (player1) {
				case Shape.Rock:
					return TurnResult.Draw;
				case Shape.Paper:
					return TurnResult.Player1Won;
				case Shape.Scissers:
					return TurnResult.Player2Won;
				default:
					throw new Error('unreachable');
			}
		case Shape.Paper:
			switch (player1) {
				case Shape.Rock:
					return TurnResult.Player2Won;
				case Shape.Paper:
					return TurnResult.Draw;
				case Shape.Scissers:
					return TurnResult.Player1Won;
				default:
					throw new Error('unreachable');
			}
		case Shape.Scissers:
			switch (player1) {
				case Shape.Rock:
					return TurnResult.Player1Won;
				case Shape.Paper:
					return TurnResult.Player2Won;
				case Shape.Scissers:
					return TurnResult.Draw;
				default:
					throw new Error('unreachable');
			}
		default:
			throw new Error('unreachable');
	}
}

function constructPlayer2Turns(turns: Shape[], cookies: Cookies) {
	cookies.set('player2', turns.join(','), { path: '/' });
}

function deconstructPlayer2Turns(cookies: Cookies) {
	const player2Turns = [
		...(cookies
			.get('player2')
			?.split(',')
			.map((x) => parseInt(x) as Shape) ?? [])
	];
	if (player2Turns.length === 0) {
		return randomShapes(1);
	} else {
		return player2Turns;
	}
}

function* randomShapes(count: number): Iterable<Shape> {
	for (const number of randomUint8(count)) {
		yield number % 3;
	}
}

enum Shape {
	Rock = 0,
	Paper,
	Scissers
}

function shapeString(shape: Shape): string {
	switch (shape) {
		case Shape.Rock:
			return 'rock';
		case Shape.Paper:
			return 'paper';
		case Shape.Scissers:
			return 'scissors';
	}
}

enum TurnResult {
	Player1Won = 1,
	Player2Won,
	Draw
}
