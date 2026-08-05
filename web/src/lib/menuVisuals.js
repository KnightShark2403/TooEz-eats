const PALETTE = [
  { bg: "#E4F1E6", icon: "🥗" },
  { bg: "#FBE6D4", icon: "🍚" },
  { bg: "#F5DCE4", icon: "🥪" },
  { bg: "#DCEAF5", icon: "🥤" },
  { bg: "#F1E6DC", icon: "🍰" },
];

export function visualForItem(id) {
  return PALETTE[id % PALETTE.length];
}
