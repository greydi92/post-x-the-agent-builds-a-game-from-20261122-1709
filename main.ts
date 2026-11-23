// post-x entrypoint (Node 22, standard library only).
//
// This bounty is won on X, not inside this program: the agent built a game,
// recorded a 48s video of it, and posted the video natively on X with the
// bounty link, the @makefunai tag and the play code in the post text.
// POST.json names that post. What this program does is prove, before the
// hand-in, that every piece of the entry is really there and consistent:
// the post URL in POST.json, the bounty link / tag / play code in the post
// text, and the video and game files the post is about. Then it hands
// POST.json to /output, where the gate reads it.
//
// Hardening (message 2): every file access is guarded, so a missing or
// unreadable file is a clear stderr error plus a non-zero exit instead of
// an uncaught exception; and ANY failed check makes the whole run fail
// (exit 1, no hand-in), so a broken entry can never look like a pass.
//
// Outside the grader's container, MAKEFUN_BOT_DIR and MAKEFUN_OUTPUT_DIR
// stand in for /bot and /output:
//   mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts

import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BOT_DIR = process.env.MAKEFUN_BOT_DIR ?? '/bot';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const PLAY_CODE = 'makefun-bridge-nugget-hockey';
const BOUNTY_LINK = 'make.fun/bounty/post-x-the-agent-builds-a-game-from-20261122-1709';
const EXPECTED_POST_URL = 'https://x.com/greydi92/status/2124566382579011691';
const MIN_VIDEO_BYTES = 100_000;
const MIN_GAME_BYTES = 1_000;

const results: boolean[] = [];

function check(name: string, ok: boolean, detail: string): void {
  results.push(ok);
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name} — ${detail}`);
}

// Every file access goes through these helpers so a missing or unreadable
// file is a clear stderr message plus exit 1, never an uncaught exception.
function fail(message: string): never {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function readText(path: string, label: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch (err) {
    fail(`cannot read ${label} at ${path}: ${(err as Error).message}`);
  }
}

function fileBytes(path: string): number {
  try {
    return statSync(path).size;
  } catch {
    return -1;
  }
}

// 1. POST.json: the post URL.
const postPath = join(BOT_DIR, 'POST.json');
const postRaw = readText(postPath, 'POST.json');
let post: { url?: unknown };
try {
  post = JSON.parse(postRaw) as { url?: unknown };
} catch (err) {
  fail(`POST.json at ${postPath} is not valid JSON: ${(err as Error).message}`);
}
const postUrl = typeof post.url === 'string' ? post.url : '';
check('post url present', postUrl.length > 0, postUrl || '(empty)');
check('post url is an X status', /^https:\/\/x\.com\/[A-Za-z0-9_]+\/status\/[0-9]+$/.test(postUrl), postUrl);
check('post url matches the entry post', postUrl === EXPECTED_POST_URL, EXPECTED_POST_URL);

// 2. post-text.txt: bounty link / tag and play code.
const textPath = join(BOT_DIR, 'post-text.txt');
const text = readText(textPath, 'post-text.txt');
check('post text names the bounty', text.includes(BOUNTY_LINK), BOUNTY_LINK);
check('post text tags @makefunai', text.includes('@makefunai'), '@makefunai');
check('post text carries the play code', text.includes(PLAY_CODE), PLAY_CODE);

// 3. game.html: the game shown in the video.
const gamePath = join(BOT_DIR, 'game.html');
const gameBytes = fileBytes(gamePath);
const gameOk = gameBytes >= 0;
check('game.html exists', gameOk, gameOk ? `${gameBytes} bytes` : '(missing)');
check('game.html is a real game file', gameBytes >= MIN_GAME_BYTES, `>= ${MIN_GAME_BYTES} bytes`);
const gameText = gameOk ? readText(gamePath, 'game.html') : '';
check('game.html is the Asteroid Dodge game', gameText.includes('Asteroid Dodge'), 'title found in game.html');

// 4. video.mp4: the native X video.
const videoPath = join(BOT_DIR, 'video.mp4');
const videoBytes = fileBytes(videoPath);
const videoOk = videoBytes >= 0;
check('video.mp4 exists', videoOk, videoOk ? `${videoBytes} bytes` : '(missing)');
check('video.mp4 is a full clip, not a stub', videoBytes >= MIN_VIDEO_BYTES, `>= ${MIN_VIDEO_BYTES} bytes`);

const passed = results.filter(Boolean).length;
console.log(`validation: ${passed}/${results.length} checks passed`);

// Strict exit: a failed check is a failed run. Do not hand in POST.json
// for a broken entry — exit non-zero instead of exiting 0 with FAILs.
if (passed !== results.length) {
  console.error(`ERROR: validation failed (${results.length - passed} check(s) failed); not handing in POST.json`);
  process.exit(1);
}

// 5. Hand in POST.json where the gate reads it.
try {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  copyFileSync(postPath, join(OUTPUT_DIR, 'POST.json'));
  console.log(`handed in POST.json -> ${join(OUTPUT_DIR, 'POST.json')}`);
} catch (err) {
  fail(`POST.json could not be copied from ${BOT_DIR}: ${(err as Error).message}`);
}
