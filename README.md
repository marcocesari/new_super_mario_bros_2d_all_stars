# Super Mario 2D

A side-scrolling Super Mario platformer built with [p5.js](https://p5js.org/).

Features:
- 3 themed worlds with platforms, pipes, enemies, and items
- Goombas and Koopas with stomping and shell mechanics
- Question blocks with mushroom power-ups and coins
- 1-player and 2-player local co-op
- Keyboard and controller support (Teleprompter pad)

<!-- TODO: add screenshot -->
<!-- <img src="demo_assets/gameplay.png" width="480"/> -->

## How to Run

Open `index.html` in a browser, or use a local server:

```bash
# Using Python
python3 -m http.server

# Using Node.js
npx serve .
```

Then open `http://localhost:8000` (or the port shown).

## Controls

### Keyboard (1 Player)

| Action | Key |
|--------|-----|
| Move   | Arrow keys |
| Jump   | Space |
| Restart | R |

### Keyboard (2 Players)

| Action | Player 1 (Mario) | Player 2 (Luigi) |
|--------|-------------------|-------------------|
| Move   | Arrow keys        | A / D             |
| Jump   | Space             | W                 |

### Controller

Select "I have a controller" from the menu to map your buttons.

## Credits

- Game specs by [marcocesari](https://github.com/marcocesari)
- Sprite sheets: <!-- TODO: credit sprite source -->
- Built with [p5.js](https://p5js.org/)

This is a non-commercial fan project made for fun and learning.
