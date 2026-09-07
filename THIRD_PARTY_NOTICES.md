# Retained licensing information

This file keeps dependency and data licensing outside the product interface.

The base experience and bundled Earth textures were retained from the user-provided reference at https://earth.ethanplus.ai/civilization.html. Original source metadata and historical source URLs are retained in the code.

The bundled Three.js code is MIT-licensed. Its license comment is retained in `vendor/three.js`. Package dependency licenses are included with their installed packages.

The geographic country and populated-place datasets are Natural Earth public-domain data. The derived catalog simplifies coordinates and retains identifying metadata. Dataset files: `ne_10m_admin_0_countries`, `ne_10m_populated_places`, and `ne_10m_populated_places_simple`, from https://github.com/nvkelso/natural-earth-vector.

Wikidata geographic identities and sitelinks are available under CC0. Live historical prose is fetched from English Wikipedia, is reformatted into plain-text sections, and remains subject to CC BY-SA 4.0 and applicable terms. Each history response includes its article URL and revision identifier; the visible full-history link identifies the corresponding article and its revision history. Article authorship is available through that article's history. License: https://creativecommons.org/licenses/by-sa/4.0/ . The application does not claim ownership of that historical prose.

The bundled DM Sans and Manrope fonts are distributed under the SIL Open Font License, version 1.1. Full notices are in `public/fonts/DM-Sans-OFL.txt` and `public/fonts/Manrope-OFL.txt`.
