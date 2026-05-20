Servi sous http://localhost:3000/characters/

BootScene charge :
  char_def_0..3.png, char_att_0..3.png
  + pour chaque i : char_def_i_{stand,gun,hold,machine,reload}.png
  + char_att_i_{même liste}.png
  (pack Kenney top-down shooter, sprites découpés depuis le spritesheet.)

Héros : plus de PNG dédiés — le display charge `hero_player_base` (= char_def_0_stand.png) et applique une teinte par id (shared/heroBodyTint.js).
