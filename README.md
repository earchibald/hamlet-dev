# Hamlet

A two-scale colony simulation in one HTML file, on its way to being a project.

    node build.js                    # assemble dist/hearth-sim.html
    node serve.js                    # dev server at http://localhost:8700/ , rebuilds when src/ changes
    node tests/soak.js               # 70-day soak on six seeds, with assertions (about 15 seconds a seed)
    node tests/terrain.js            # levels, slopes, hills: under a second
    SEEDS=r DAYS=10 node tests/soak.js   # a quick run
    node tests/trace-deaths.js x     # where, why, and what they were thinking
    open dist/hearth-sim.html

See `design/notes.md` for the design and `CLAUDE.md` for how to work on it.
