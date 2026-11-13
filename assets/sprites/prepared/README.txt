SPRITES PREPARADOS - CYBER MAZE

PLAYER
- idle_down.png  = vista frontal
- idle_up.png    = vista trasera
- idle_left.png  = vista lateral izquierda
- idle_right.png = vista lateral derecha
- walk.png       = animacion lateral de 8 frames
- run.png        = animacion rapida de 8 frames
- attack.png     = animacion de ataque de 8 frames
- death.png      = animacion de caida/muerte

ENEMIGOS
- alpha_walk.png, beta_walk.png, gamma_walk.png, delta_walk.png
  Cada hoja contiene 6 frames de 32x64 px.
- Los enemigos se dibujan a 38x76 px para conservar la proporcion original.
- Izquierda se obtiene con espejo horizontal; derecha usa el sprite original.

NOTA
Los sprites originales no contienen 4 animaciones completas independientes para
cada direccion. Por eso el juego usa las poses front/back para movimiento vertical
y las animaciones laterales para movimiento horizontal. No se deforma la imagen.
Para una version totalmente profesional, se pueden reemplazar estas hojas por
sprites con walk_up/walk_down/walk_left/walk_right reales.
