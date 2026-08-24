/* ============================================================
   Colour schemes — the runtime palette-swap targets. The sprite
   sheets are painted on the master ramp (SMASTER); the renderer maps
   those master colours onto a scheme's base / secondary / trim ramps.
   Also referenced by docs/art-spec.md §5.
   ============================================================ */
export const SCHEMES = {
  Vanguard: { base: ["#0e1526", "#16233f", "#243a63"], sec: ["#0c6f82", "#17aecb", "#22e0ff"], trim: ["#c79a1f", "#ffd23e"] },
  Ember: { base: ["#1a120c", "#2a1c10", "#45301a"], sec: ["#8a3a12", "#d2641e", "#ff8a3e"], trim: ["#b5311f", "#ff5a3e"] },
  Venom: { base: ["#0a1a12", "#10261a", "#1c4230"], sec: ["#2f7d2a", "#58c23a", "#7dff6b"], trim: ["#0c7f96", "#22e0ff"] },
  Sovereign: { base: ["#141026", "#1e1636", "#322a5c"], sec: ["#5a3a8a", "#8a5fc8", "#b98cff"], trim: ["#b5236a", "#ff2e88"] },
  Warhound: { base: ["#141014", "#241820", "#3a2a34"], sec: ["#8a1f3a", "#d2244f", "#ff3b6b"], trim: ["#c9c9d6", "#ffffff"] },
  Scarlet: { base: ["#3a0e10", "#7a1c22", "#b83038"], sec: ["#0c6f82", "#17aecb", "#22e0ff"], trim: ["#ffcf3e", "#ffe98f"] },
  Solar: { base: ["#3a1e08", "#7a3e12", "#c66a1e"], sec: ["#123a6e", "#2a6ec2", "#4aa8ff"], trim: ["#ffd23e", "#fff0a0"] },
  Amber: { base: ["#3a2e08", "#786218", "#c9a52a"], sec: ["#123a6e", "#2a6ec2", "#4aa8ff"], trim: ["#ff6a2e", "#ffb46b"] },
  Verdant: { base: ["#0e2a14", "#1a5226", "#2c8c3e"], sec: ["#7a5a12", "#c9a52a", "#ffe066"], trim: ["#ff3b6b", "#ff85a8"] },
  Azure: { base: ["#0e1a3a", "#1a2f70", "#2c4ec8"], sec: ["#0c6f82", "#17aecb", "#22e0ff"], trim: ["#ffd23e", "#fff0a0"] },
  Indigo: { base: ["#14123a", "#221e6e", "#3a34b4"], sec: ["#5a3a8a", "#8a5fc8", "#b98cff"], trim: ["#22e0ff", "#a8f4ff"] },
  Amethyst: { base: ["#2a0e3a", "#521c74", "#8230b8"], sec: ["#8a1f5a", "#d2246e", "#ff3b9b"], trim: ["#ffd23e", "#fff0a0"] },
  Enemy: { base: ["#160a10", "#2a1420", "#48212f"], sec: ["#8a1f2a", "#d22436", "#ff3b4b"], trim: ["#c98a1f", "#ffb43e"] },
};
export const SCHEME_NAMES = Object.keys(SCHEMES).filter(s => s !== 'Enemy');
export const SMASTER = { base: ["#0e1526", "#16233f", "#243a63"], sec: ["#0c6f82", "#17aecb", "#22e0ff"], trim: ["#c79a1f", "#ffd23e"], glow: "#ffffff" };
