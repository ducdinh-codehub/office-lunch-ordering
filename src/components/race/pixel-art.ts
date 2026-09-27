/**
 * The desert, drawn by hand as pixel maps: `#` is ink, anything else is
 * empty. In the spirit of the browser's offline game — grey on white, square
 * pixels, no smoothing — but our own drawings.
 */

export type Sprite = { width: number; height: number; cells: [number, number][] };

function sprite(rows: string[]): Sprite {
  const cells: [number, number][] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === "#") cells.push([x, y]);
  });
  return { width: Math.max(...rows.map((row) => row.length)), height: rows.length, cells };
}

/** Head, body and tail — the legs are added per frame below. */
const DINO_BODY = [
  "..........########..",
  ".........##.#######.",
  ".........##########.",
  ".........##########.",
  ".........#####......",
  ".........########...",
  "#.......#####.......",
  "#......######.......",
  "##....##########....",
  "###..#########.#....",
  "#############.......",
  ".############.......",
  "..###########.......",
  "...#########........",
  "....#######.........",
];

export const DINO_WIDTH = 20;

/** Left leg up, right leg down. */
export const DINO_RUN_A = sprite([
  ...DINO_BODY,
  "....###..##.........",
  "....##...##.........",
  ".........##.........",
  ".........###........",
]);

/** Right leg up, left leg down. */
export const DINO_RUN_B = sprite([
  ...DINO_BODY,
  "....###..##.........",
  "....##...##.........",
  "....##..............",
  "....###.............",
]);

/** Both feet on the ground — mid-jump, before the start and after the line. */
export const DINO_STAND = sprite([
  ...DINO_BODY,
  "....###..##.........",
  "....##...##.........",
  "....##...##.........",
  "....###..###........",
]);

export const DINO_HEIGHT = DINO_STAND.height;

export const CACTUS = sprite([
  "...##...",
  "...##...",
  "#..##...",
  "#..##.#.",
  "#..##.#.",
  "#..####.",
  "#####...",
  "...##...",
  "...##...",
  "...##...",
]);

export const CLOUD = sprite([
  "......####......",
  "....##....#.....",
  "...#.......##...",
  ".##..........#..",
  "#.............##",
  "#...............#",
  "#################",
]);

/** Paints a sprite with its top-left corner at (x, y), each cell `pixel` px square. */
export function drawSprite(
  context: CanvasRenderingContext2D,
  art: Sprite,
  x: number,
  y: number,
  pixel: number,
) {
  const left = Math.round(x);
  const top = Math.round(y);
  for (const [cx, cy] of art.cells) {
    context.fillRect(left + cx * pixel, top + cy * pixel, pixel, pixel);
  }
}
