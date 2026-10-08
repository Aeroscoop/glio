# glio
module (gliosoom) coordinating system

## Gliosoom-vormen (iso-demo)

Elke module heeft een manifest (`manifest/`). De renderer in `src/iso/` maakt daaruit
automatisch een isometrische kubusvorm. Hoe je zo'n vorm leest: `docs/visual-principles.md`.

```bash
python3 -m http.server 8000   # daarna http://localhost:8000/iso.html
node --test                   # tests
node tools/measure.js <modulemap-of-script> manifest/examples/digest.json
```

`index.html` is de oudere canvas-demo van de cel.
