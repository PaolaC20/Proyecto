SPRITES DE CYBER MAZE

PLAYER
assets/sprites/player/player_sheet.png
- Hoja de 256x256.
- Celdas de 32x32 (8 columnas x 8 filas).
- Fila 0: poses de espera.
- Fila 2: caminar.
- Fila 3: correr/desplazamiento rápido.
- Fila 4: ataque.
- Fila 5: daño/caída.
- Fila 6: poses direccionales para estar quieto.

ENEMIGOS
assets/sprites/enemies/enemies_sheet.png
- Hoja de 256x256.
- 6 columnas x 4 filas.
- Fila 0 = Alpha.
- Fila 1 = Beta.
- Fila 2 = Gamma.
- Fila 3 = Delta.

CONTROLES DE SPRITES
- Flecha derecha / D: caminar hacia la derecha.
- Flecha izquierda / A: caminar hacia la izquierda (sprite reflejado).
- Flecha arriba / W: dirección arriba.
- Flecha abajo / S: dirección abajo.
- ESPACIO o ENTER: animación de ataque.

Para cambiar los sprites, conserva las rutas y el formato PNG con transparencia.
Si cambias el tamaño de las celdas, modifica SW/SH en SpriteManager dentro de js/cybermaze.js.
