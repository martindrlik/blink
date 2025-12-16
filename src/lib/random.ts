import { encodeBase32LowerCase } from '@oslojs/encoding';

export function randomString(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(15));
	return encodeBase32LowerCase(bytes);
}

export function randomUint8(count: number): Uint8Array<ArrayBuffer> {
	const array = new Uint8Array(count);
	crypto.getRandomValues(array);
	return array;
}
