/** Slot déterministe 0–3 pour choisir le sprite personnage. */
export function charSlot(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return h % 4;
}
