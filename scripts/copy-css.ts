await Bun.write(new URL('../dist/picker.css', import.meta.url), Bun.file(new URL('../src/picker.css', import.meta.url)))
