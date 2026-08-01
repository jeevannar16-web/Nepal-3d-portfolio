/**
 * Single source of truth for the scene's color palette — warm ambers/reds for
 * structures and lights, deep teal/blue for shadows and water, muted sage for
 * foliage. Keeps every material pulling from one set instead of each element
 * carrying its own arbitrary saturated color.
 */
export const PALETTE = {
  // Ground & grass
  ground: '#7d8f6e',
  grassSpeckDark: 'rgba(83, 99, 64, 0.45)',
  grassSpeckLight: 'rgba(150, 160, 120, 0.45)',
  grassBladeDark: 'rgba(76, 92, 58, 0.7)',
  grassBladeLight: 'rgba(130, 142, 98, 0.7)',

  // Foliage & trunks
  trunk: '#4c3b2a',
  foliageDark: '#3f5a46',
  foliage: '#4e6b50',
  foliageLight: '#607d5b',

  // Warm structures
  plaster: '#e8dcc8',
  sandstone: '#d9b98c',
  sand: '#c2a06e',
  sandDeep: '#b4915f',
  clayRoof: '#9c4a3c',
  clayRoofLight: '#b45f47',

  // Stone
  stupaWarm: ['#f5f0e6', '#efe7d8', '#fffaf0'],
  maniStone: ['#a8a291', '#b3ad9c', '#9c9685'],

  // Prayer flags — deliberately kept vibrant (small accent that pops against
  // the muted scene; bloom lifts them further).
  flags: ['#e63946', '#f4a261', '#e9c46a', '#457b9d', '#6a994e', '#2a9d8f'],

  // Mountains — warm slate / mauve so peaks pick up golden light.
  rock: [
    '#8a7f95',
    '#7c728a',
    '#94889e',
    '#756b84',
    '#9a8fa8',
    '#84798f',
    '#a99aa0',
    '#a09080',
  ],
  snow: ['#f4f8fc', '#eef4fb', '#fafcff'],
  haze: ['#cbb9a6', '#d4c2ae', '#b8b0a4', '#c9b8a8', '#bfb2a6'],

  // Cool shadows / water
  waterDeep: '#0f3a3c',
  waterShallow: '#3f7d7d',
  waterGlint: '#7fd0c8',
}
