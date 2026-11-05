// Writes the marketplace/plugin icon as PNG (Stream Deck requires PNG for the plugin icon).
// Draws an antialiased white ring on transparency using only node:zlib.
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

function crc32(buf) {
	let c, crc = 0xffffffff;
	for (let n = 0; n < buf.length; n++) {
		c = (crc ^ buf[n]) & 0xff;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		crc = (crc >>> 8) ^ c;
	}
	return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
	const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
	const td = Buffer.concat([Buffer.from(type), data]);
	const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
	return Buffer.concat([len, td, crc]);
}
function ringPng(size) {
	const raw = Buffer.alloc((size * 4 + 1) * size);
	const c = size / 2, r = size * 0.31, w = size * 0.1;
	for (let y = 0; y < size; y++) {
		raw[y * (size * 4 + 1)] = 0;
		for (let x = 0; x < size; x++) {
			const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
			const a = Math.max(0, Math.min(1, w / 2 + 0.5 - Math.abs(d - r)));
			const i = y * (size * 4 + 1) + 1 + x * 4;
			raw[i] = raw[i + 1] = raw[i + 2] = 255;
			raw[i + 3] = Math.round(a * 255);
		}
	}
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
	ihdr[8] = 8; ihdr[9] = 6;
	return Buffer.concat([
		Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
		chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
	]);
}
const dir = "kz.standingby.ringreadiness.sdPlugin/imgs/plugin";
writeFileSync(`${dir}/icon.png`, ringPng(256));
writeFileSync(`${dir}/icon@2x.png`, ringPng(512));
console.log("icons written");
