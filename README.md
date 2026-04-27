# Pokédex

> Gotta fetch 'em all. A snappy, type-themed Pokédex in three files — no build, no deps.

Powered by the [PokéAPI](https://pokeapi.co).

## What's inside

- Search by **name or #ID**, with autocomplete for all 1025 Pokémon
- Type-colored cards, animated stat bars, official artwork
- **Shiny toggle**, **cry playback**, full **evolution chain**
- Prev / Next nav, **Random** button, deep links (`#pikachu`)
- Shortcuts: `/` to search, `Alt + ←/→` to walk the dex
- Fast: request cache, skeleton loading, in-flight cancellation

## Run it

```bash
python3 -m http.server 8000
# → http://localhost:8000/pokemon.html
```

Or just open `pokemon.html` in your browser.

## Files

`pokemon.html` · `styles.css` · `pokemon.js`

---

Pokémon © Nintendo / Game Freak. Data & sprites via [PokéAPI](https://pokeapi.co).
