/**
 * The desert, drawn by hand as pixel maps: `#` is ink, anything else is
 * empty; the colour is chosen when a sprite is painted. In the spirit of the
 * browser's offline game — square pixels, no smoothing — but our own drawings.
 */

export type Sprite = { width: number; height: number; cells: [number, number][] };

function sprite(rows: string[]): Sprite {
  const cells: [number, number][] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === "#") cells.push([x, y]);
  });
  return { width: Math.max(...rows.map((row) => row.length)), height: rows.length, cells };
}

/** A round little dino with a spiky back — the legs are added per frame below. */
const DINO_BODY = [
  "............#####...",
  "...........#######..",
  "...........##.#####.",
  "....#.#.#..########.",
  "...##########.......",
  "..############......",
  ".##############.....",
  "###############.##..",
  "#.#############.....",
  "..#############.....",
  "...###########......",
  "....#########.......",
];

export const DINO_WIDTH = 20;

/** Front leg reaching, back leg pushing off. */
export const DINO_RUN_A = sprite([
  ...DINO_BODY,
  "....###..###........",
  "...##.....##........",
  "..##.......##.......",
]);

/** Legs passing under the body. */
export const DINO_RUN_B = sprite([
  ...DINO_BODY,
  "....###..###........",
  ".....##..##.........",
  "......####..........",
]);

/** Both feet on the ground — before the start and after the line. */
export const DINO_STAND = sprite([
  ...DINO_BODY,
  "....###..###........",
  "....##...##.........",
  "...###..###.........",
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

/** A duck afloat, facing right; it swims, so there are no legs to animate. */
export const DUCK = sprite([
  "...........####.....",
  "..........######....",
  "..........###.##....",
  "..........########..",
  "..........######....",
  "#.........#####.....",
  "##.......######.....",
  "###############.....",
  "################....",
  "################....",
  ".###############....",
  "..#############.....",
  "....#########.......",
]);

/** A runner, head and torso — the legs are added per frame below. */
const PERSON_BODY = [
  ".......###....",
  "......#####...",
  "......#####...",
  ".......###....",
  "......####....",
  ".....######...",
  "....##.####.#.",
  "...##..#####..",
  "..##...####...",
  ".......####...",
  "......####....",
  "......#####...",
];

/** Mid-stride: one leg reaching forward, the other kicked back. */
export const PERSON_RUN_A = sprite([
  ...PERSON_BODY,
  ".....###.##...",
  "....##....##..",
  "...##......##.",
  "..##.......#..",
  ".##...........",
]);

/** Legs passing under the body. */
export const PERSON_RUN_B = sprite([
  ...PERSON_BODY,
  "......####....",
  "......##.#....",
  "......##..#...",
  "......##.#....",
  ".....###......",
]);

/** Standing still — before the start and after the line. */
export const PERSON_STAND = sprite([
  ...PERSON_BODY,
  "......####....",
  "......##.##...",
  "......##.##...",
  "......##.##...",
  ".....###.###..",
]);

/** Reeds on the river bank. */
export const REED = sprite([
  "..#.....",
  "..#..#..",
  "#.#..#..",
  "#.#.##..",
  "#.#.#..#",
  "#.###..#",
  ".###..#.",
  "..#####.",
  "...###..",
  "...##...",
]);

/** A bush beside the running track. */
export const BUSH = sprite([
  "...####.....",
  "..######.##.",
  ".##########.",
  "############",
  "############",
  ".##########.",
  "....##......",
]);

/** Worn by the winner once the time is up. */
export const CROWN = sprite([
  "#..#..#",
  "##.#.##",
  "#######",
  "#######",
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

/**
 * Sprites pre-rendered to small canvases, one per sprite, cell size, colour and
 * device ratio. Painting cell by cell costs a `fillRect` per `#` — a couple of
 * hundred per dino — which a phone cannot afford for a full field every frame;
 * a cached image is one `drawImage`.
 */
export function spriteCache(ratio: number) {
  const images = new Map<string, HTMLCanvasElement>();
  const ids = new Map<Sprite, number>();

  function image(art: Sprite, pixel: number, color: string): HTMLCanvasElement {
    let id = ids.get(art);
    if (id === undefined) ids.set(art, (id = ids.size));
    const key = `${id}|${pixel}|${color}`;
    let canvas = images.get(key);
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.width = Math.ceil(art.width * pixel * ratio);
      canvas.height = Math.ceil(art.height * pixel * ratio);
      const context = canvas.getContext("2d")!;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.fillStyle = color;
      drawSprite(context, art, 0, 0, pixel);
      images.set(key, canvas);
    }
    return canvas;
  }

  return function draw(
    context: CanvasRenderingContext2D,
    art: Sprite,
    x: number,
    y: number,
    pixel: number,
    color: string,
  ) {
    context.drawImage(image(art, pixel, color), Math.round(x), Math.round(y), art.width * pixel, art.height * pixel);
  };
}

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
