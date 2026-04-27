"use strict";

const API = "https://pokeapi.co/api/v2";
const MAX_DEX = 1025;

const TYPE_COLORS = {
    normal:   ["#a8a77a", "#7e7d56"],
    fire:     ["#ee8130", "#a85a1d"],
    water:    ["#6390f0", "#3a64b8"],
    electric: ["#f7d02c", "#b89915"],
    grass:    ["#7ac74c", "#4e8a30"],
    ice:      ["#96d9d6", "#5fa9a6"],
    fighting: ["#c22e28", "#7d1d19"],
    poison:   ["#a33ea1", "#6f2870"],
    ground:   ["#e2bf65", "#9c8438"],
    flying:   ["#a98ff3", "#6f57b8"],
    psychic:  ["#f95587", "#b9325b"],
    bug:      ["#a6b91a", "#6c7a10"],
    rock:     ["#b6a136", "#7a6c20"],
    ghost:    ["#735797", "#4a3661"],
    dragon:   ["#6f35fc", "#4a1fb0"],
    dark:     ["#705746", "#43332a"],
    steel:    ["#b7b7ce", "#7e7e93"],
    fairy:    ["#d685ad", "#9c5680"],
};

const STAT_LABELS = {
    "hp":              "HP",
    "attack":          "Attack",
    "defense":         "Defense",
    "special-attack":  "Sp. Atk",
    "special-defense": "Sp. Def",
    "speed":           "Speed",
};

const els = {
    input:     document.getElementById("pokemonName"),
    searchBtn: document.getElementById("searchBtn"),
    randomBtn: document.getElementById("randomBtn"),
    clearBtn:  document.getElementById("clearBtn"),
    result:    document.getElementById("result"),
    suggest:   document.getElementById("pokemon-suggestions"),
    template:  document.getElementById("card-template"),
};

const cache = new Map();
let allNames = [];
let currentDexId = null;
let inFlight = null;

async function fetchJSON(url, signal) {
    if (cache.has(url)) return cache.get(url);
    const res = await fetch(url, { signal });
    if (!res.ok) {
        const err = new Error(res.status === 404 ? "not-found" : "network");
        err.status = res.status;
        throw err;
    }
    const data = await res.json();
    cache.set(url, data);
    return data;
}

async function loadAllNames() {
    try {
        const data = await fetchJSON(`${API}/pokemon?limit=${MAX_DEX}`);
        allNames = data.results.map(p => p.name);
        els.suggest.innerHTML = allNames
            .slice(0, 1025)
            .map(n => `<option value="${n}"></option>`)
            .join("");
    } catch {
        // Suggestions are a nice-to-have; ignore failures.
    }
}

function formatDexId(id) {
    return "#" + String(id).padStart(4, "0");
}

function metersToFt(m) {
    const totalInches = m * 39.3701;
    const ft = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches - ft * 12);
    return `${ft}′${inches}″`;
}

function formatHeight(decimetres) {
    const m = decimetres / 10;
    return `${m.toFixed(1)} m (${metersToFt(m)})`;
}

function formatWeight(hectograms) {
    const kg = hectograms / 10;
    const lbs = (kg * 2.20462).toFixed(1);
    return `${kg.toFixed(1)} kg (${lbs} lb)`;
}

function pickFlavor(species) {
    if (!species?.flavor_text_entries) return "";
    const en = species.flavor_text_entries.filter(e => e.language?.name === "en");
    const entry = en.find(e => e.version?.name === "shield")
        || en.find(e => e.version?.name === "sword")
        || en[en.length - 1]
        || en[0];
    return entry ? entry.flavor_text.replace(/[\f\n\r\u000c]+/g, " ").trim() : "";
}

function pickGenus(species) {
    if (!species?.genera) return "";
    const en = species.genera.find(g => g.language?.name === "en");
    return en ? en.genus : "";
}

function pickSprite(pokemon, shiny) {
    const art = pokemon.sprites?.other?.["official-artwork"];
    if (art) {
        const src = shiny ? art.front_shiny : art.front_default;
        if (src) return src;
    }
    return shiny
        ? pokemon.sprites.front_shiny || pokemon.sprites.front_default
        : pokemon.sprites.front_default;
}

function pickCry(pokemon) {
    return pokemon.cries?.latest || pokemon.cries?.legacy || null;
}

function applyTypeTheme(card, types) {
    const primary = types[0] || "normal";
    const secondary = types[1] || primary;
    const [c1] = TYPE_COLORS[primary] || TYPE_COLORS.normal;
    const [c2] = TYPE_COLORS[secondary] || TYPE_COLORS.normal;
    card.style.setProperty("--type-color", c1);
    card.style.setProperty("--type-color-2", c2);
}

function buildTypeBadges(container, types) {
    container.innerHTML = "";
    types.forEach(t => {
        const [c] = TYPE_COLORS[t] || TYPE_COLORS.normal;
        const span = document.createElement("span");
        span.className = "type-badge";
        span.style.setProperty("--bg", c);
        span.textContent = t;
        container.appendChild(span);
    });
}

function buildStats(listEl, totalEl, stats) {
    listEl.innerHTML = "";
    let total = 0;
    stats.forEach(s => {
        total += s.base_stat;
        const li = document.createElement("li");
        li.className = "stat-row";
        const pct = Math.min(100, (s.base_stat / 255) * 100);
        li.innerHTML = `
            <span class="stat-name">${STAT_LABELS[s.stat.name] ?? s.stat.name}</span>
            <span class="stat-value">${s.base_stat}</span>
            <div class="stat-bar"><span data-pct="${pct}"></span></div>
        `;
        listEl.appendChild(li);
    });
    totalEl.textContent = total;
    requestAnimationFrame(() => {
        listEl.querySelectorAll(".stat-bar > span").forEach(bar => {
            bar.style.width = bar.dataset.pct + "%";
        });
    });
}

function flattenEvoChain(node, acc = []) {
    if (!node) return acc;
    acc.push(node.species.name);
    (node.evolves_to || []).forEach(child => flattenEvoChain(child, acc));
    return acc;
}

async function buildEvolutionChain(container, species, currentName) {
    container.innerHTML = "";
    if (!species?.evolution_chain?.url) return;
    try {
        const evo = await fetchJSON(species.evolution_chain.url);
        const names = [];
        flattenEvoChain(evo.chain, names);
        if (names.length === 0) return;

        for (let i = 0; i < names.length; i++) {
            const name = names[i];
            const node = document.createElement("button");
            node.className = "evo-node" + (name === currentName ? " current" : "");
            node.type = "button";
            node.dataset.name = name;
            node.innerHTML = `
                <img alt="${name}" loading="lazy" />
                <span class="evo-name">${name}</span>
            `;
            const img = node.querySelector("img");
            try {
                const p = await fetchJSON(`${API}/pokemon/${name}`);
                img.src = pickSprite(p, false) || "";
            } catch {
                img.alt = name;
            }
            node.addEventListener("click", () => loadPokemon(name));
            container.appendChild(node);

            if (i < names.length - 1) {
                const arrow = document.createElement("span");
                arrow.className = "evo-arrow";
                arrow.textContent = "→";
                container.appendChild(arrow);
            }
        }
    } catch {
        container.innerHTML = `<span class="evo-arrow">Evolution data unavailable</span>`;
    }
}

function showSkeleton() {
    els.result.innerHTML = `
        <div class="skeleton" aria-busy="true" aria-label="Loading">
            <div class="bar lg"></div>
            <div class="circle"></div>
            <div class="bar md"></div>
            <div class="bar sm"></div>
            <div class="bar"></div>
            <div class="bar md"></div>
            <div class="bar sm"></div>
        </div>
    `;
}

function showError(query, kind) {
    const isNotFound = kind === "not-found";
    els.result.innerHTML = `
        <div class="error-card">
            <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png" alt="" width="120" height="120" style="image-rendering:pixelated;opacity:0.85;">
            <h2>${isNotFound ? "Pokémon not found" : "Something went wrong"}</h2>
            <p>${
                isNotFound
                    ? `We couldn't find <strong>${query || "that"}</strong> in the Pokédex. Check the spelling or try an ID like <code>25</code>.`
                    : "We couldn't reach PokéAPI. Check your connection and try again."
            }</p>
        </div>
    `;
}

function renderPokemon(pokemon, species) {
    const node = els.template.content.firstElementChild.cloneNode(true);

    const types = pokemon.types.map(t => t.type.name);
    applyTypeTheme(node, types);

    node.querySelector(".card-id").textContent = formatDexId(pokemon.id);
    node.querySelector(".card-genus").textContent = pickGenus(species) || "—";
    node.querySelector(".card-name").textContent = pokemon.name.replace(/-/g, " ");

    buildTypeBadges(node.querySelector(".card-types"), types);

    const sprite = node.querySelector(".card-sprite");
    sprite.src = pickSprite(pokemon, false) || "";
    sprite.alt = `${pokemon.name} artwork`;

    const shinyBtn = node.querySelector(".sprite-toggle");
    shinyBtn.addEventListener("click", () => {
        const next = shinyBtn.dataset.shiny !== "true";
        shinyBtn.dataset.shiny = next ? "true" : "false";
        sprite.src = pickSprite(pokemon, next) || sprite.src;
    });

    const cryUrl = pickCry(pokemon);
    const cryBtn = node.querySelector(".cry-btn");
    if (cryUrl) {
        const audio = new Audio(cryUrl);
        audio.volume = 0.55;
        cryBtn.addEventListener("click", () => {
            audio.currentTime = 0;
            cryBtn.classList.add("playing");
            audio.play().catch(() => {});
        });
        audio.addEventListener("ended", () => cryBtn.classList.remove("playing"));
    } else {
        cryBtn.disabled = true;
        cryBtn.title = "No cry available";
    }

    node.querySelector('[data-meta="height"]').textContent = formatHeight(pokemon.height);
    node.querySelector('[data-meta="weight"]').textContent = formatWeight(pokemon.weight);
    node.querySelector('[data-meta="abilities"]').textContent =
        pokemon.abilities.map(a => a.ability.name.replace(/-/g, " ")).join(", ") || "—";

    const flavor = pickFlavor(species);
    const flavorEl = node.querySelector('[data-meta="flavor"]');
    if (flavor) flavorEl.textContent = flavor;
    else flavorEl.remove();

    buildStats(
        node.querySelector(".stats-list"),
        node.querySelector('[data-meta="total"]'),
        pokemon.stats
    );

    buildEvolutionChain(node.querySelector(".evo-chain"), species, pokemon.name);

    const prev = node.querySelector('[data-nav="prev"]');
    const next = node.querySelector('[data-nav="next"]');
    prev.disabled = pokemon.id <= 1;
    next.disabled = pokemon.id >= MAX_DEX;
    prev.addEventListener("click", () => loadPokemon(String(pokemon.id - 1)));
    next.addEventListener("click", () => loadPokemon(String(pokemon.id + 1)));

    els.result.replaceChildren(node);
    currentDexId = pokemon.id;

    document.documentElement.style.setProperty(
        "--theme-accent",
        (TYPE_COLORS[types[0]] || TYPE_COLORS.normal)[0]
    );
}

async function loadPokemon(query) {
    const trimmed = String(query ?? "").trim().toLowerCase();
    if (!trimmed) {
        els.input.focus();
        return;
    }

    if (inFlight) inFlight.abort();
    const ctrl = new AbortController();
    inFlight = ctrl;

    showSkeleton();
    setBusy(true);

    try {
        const pokemon = await fetchJSON(`${API}/pokemon/${encodeURIComponent(trimmed)}`, ctrl.signal);
        const species = await fetchJSON(pokemon.species.url, ctrl.signal).catch(() => null);
        renderPokemon(pokemon, species);

        history.replaceState(null, "", `#${pokemon.name}`);
        document.title = `${pokemon.name[0].toUpperCase()}${pokemon.name.slice(1)} · Pokédex`;
        els.input.value = pokemon.name;
        toggleClear();
    } catch (e) {
        if (e.name === "AbortError") return;
        showError(trimmed, e.message === "not-found" ? "not-found" : "network");
    } finally {
        if (inFlight === ctrl) inFlight = null;
        setBusy(false);
    }
}

function setBusy(busy) {
    [els.searchBtn, els.randomBtn].forEach(b => (b.disabled = busy));
}

function toggleClear() {
    els.clearBtn.hidden = !els.input.value;
}

function randomDexId() {
    return String(Math.floor(Math.random() * MAX_DEX) + 1);
}

function bind() {
    els.searchBtn.addEventListener("click", () => loadPokemon(els.input.value));
    els.randomBtn.addEventListener("click", () => loadPokemon(randomDexId()));
    els.clearBtn.addEventListener("click", () => {
        els.input.value = "";
        toggleClear();
        els.input.focus();
    });
    els.input.addEventListener("input", toggleClear);
    els.input.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            e.preventDefault();
            loadPokemon(els.input.value);
        }
    });
    document.addEventListener("keydown", e => {
        if (e.key === "/" && document.activeElement !== els.input) {
            e.preventDefault();
            els.input.focus();
            els.input.select();
        }
        if (e.key === "ArrowLeft" && e.altKey && currentDexId > 1) {
            loadPokemon(String(currentDexId - 1));
        }
        if (e.key === "ArrowRight" && e.altKey && currentDexId && currentDexId < MAX_DEX) {
            loadPokemon(String(currentDexId + 1));
        }
    });
    window.addEventListener("hashchange", () => {
        const name = decodeURIComponent(location.hash.replace(/^#/, ""));
        if (name && name !== els.input.value) loadPokemon(name);
    });
}

function bootstrap() {
    bind();
    loadAllNames();
    const initial = decodeURIComponent(location.hash.replace(/^#/, ""));
    if (initial) loadPokemon(initial);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
} else {
    bootstrap();
}
