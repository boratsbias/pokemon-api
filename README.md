# Pokédex

A polished, single-page Pokédex powered by the [PokéAPI](https://pokeapi.co). Search any Pokémon by name or National Dex number and explore artwork, stats, abilities, evolutions, and cries.

## Features

- Modern, type-themed card UI with gradient backgrounds and smooth animations
- Search by name **or** ID, with autocomplete from the full National Dex
- Animated base-stat bars and total
- Official artwork with **shiny toggle**
- Pokémon **cry playback**
- **Evolution chain** preview (click any node to jump to it)
- **Prev / Next** navigation through the Pokédex
- **Random** Pokémon button
- Deep links via URL hash (e.g. `pokemon.html#charizard`)
- Keyboard shortcuts: `/` to focus search, `Alt + ←/→` to navigate
- In-memory request caching for snappy back-and-forth
- Skeleton loading state and friendly error messages
- Fully responsive; respects `prefers-reduced-motion`

## Run it

It's a static site — no build step, no dependencies.

```bash
# any static server works, e.g.
python3 -m http.server 8000
# then open http://localhost:8000/pokemon.html
```

Or just open `pokemon.html` directly in your browser.

## Files

- `pokemon.html` — markup and a `<template>` for the result card
- `styles.css` — design system, type colors, animations, responsive rules
- `pokemon.js` — data fetching, rendering, caching, keyboard & hash routing

## Credits

- Data and sprites: [PokéAPI](https://pokeapi.co)
- Pokémon and all respective names are trademarks of Nintendo / Game Freak
