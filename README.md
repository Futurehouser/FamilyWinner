# FamilyWinner

Asistente para el **juego de las familias** (42 cartas: 7 familias × 6 miembros — Árabe, Bantú, Chino, Esquimal, Indio, Mexicano y Tirolés; cada una con Abuelo, Abuela, Padre, Madre, Hijo e Hija).

Disponible como **exe portable para Windows** y **APK para Android**.

## Qué hace

- Le dices qué **6 cartas** te han tocado y quién empieza.
- En tu turno te **sugiere qué carta pedir**, con la probabilidad de que el rival la tenga (prioriza las cartas que sabes seguro que tiene y las familias que tienes más avanzadas).
- Si fallas, te pregunta **qué carta has robado**.
- En el turno del rival le indicas **qué te pide**; la app te dice si ha acertado (y debes dársela) o ha fallado (y roba).
- **Detecta trampas**, por ejemplo:
  - Tienes 5 cartas de una familia, pides la 6ª, el rival dice que no la tiene, y después te pide una carta de esa familia (imposible si no ha robado entre medias).
  - Dice que no tiene una carta que tú le diste.
  - Baja una familia que incluye una carta que negó tener.
  - Las cuentas de cartas no cuadran.
- Deshacer, guardado automático de la partida y registro de jugadas.
- **Auto-actualización**: al abrirse, comprueba la última Release de este repositorio y pregunta si quieres actualizar (en Windows sustituye el exe y reinicia; en Android descarga el APK y abre el instalador).

## Desarrollo

```bash
npm install
npm start            # abre la app de escritorio
npm test             # tests de la lógica
npm run icons        # regenera iconos (requiere Python + Pillow)
```

Las imágenes de las cartas están en `Cards/` con el formato `familia_miembro.jpg`; `npm run sync` las copia a `www/cards/`.

## Publicar una nueva versión

1. Sube la versión en `package.json` (por ejemplo `1.0.1`).
2. `npm run build` → genera `release/FamilyWinner-Portable.exe` y `release/FamilyWinner.apk`.
3. Crea la Release con esos dos archivos (los nombres importan para el auto-updater):

```bash
gh release create v1.0.1 release/FamilyWinner-Portable.exe release/FamilyWinner.apk --title "FamilyWinner 1.0.1" --notes "Novedades..."
```

> El APK se firma con `android/keystore/familywinner.jks` (configurado en `android/keystore.properties`). Esos archivos **no se suben** al repositorio; guárdalos a salvo: sin la misma clave, Android no permitirá instalar las actualizaciones encima.
