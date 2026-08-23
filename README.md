# Ying Zhang portfolio snapshot

Authorized static reproduction of [yingzhang.xyz](https://yingzhang.xyz/), preserving its ten public routes, responsive presentation, content, external links, and Framer interactions.

## Build

```sh
npm install
npm run snapshot
```

The generated HTML preserves the live Framer output, with only origin references and home-fragment links rewritten for GitHub Pages' project-path routing. Large portfolio media remains on Framer's CDN so the published repository stays within GitHub's file-size limits.

## QA

Serve the parent directory so the local URL retains the GitHub Pages project prefix:

```sh
python3 -m http.server 4173 --directory ..
npm run qa
```

The QA pass compares all ten source and local routes at desktop and mobile sizes, checks text parity, broken images, horizontal overflow, internal-link rewriting, and screenshot pixel differences.

After deployment, run `npm run qa:interactions` to exercise every public route plus project-card, Projects, About, and Contact navigation on the live Pages origin.
