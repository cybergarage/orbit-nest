# Dependency audit scope

npm audit on 2026-10-03 flags four high-severity entries in the inherited Orbit build dependency chain: braces → micromatch → fast-glob → Orbit. The [upstream advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) lists no patched version. No blanket npm audit fix or upstream package upgrade is performed in this prototype.

Nest has no user-controlled glob tool. Its shared scheduler imports the isolated pure canonical-JSON helper rather than the agent execution journal and its unrelated tooling imports. Electron main/preload are bundled, and the unsigned package excludes node_modules and vendor build sources. Build-workspace dependency audit findings remain; the shipped runtime must not contain braces/micromatch/fast-glob code. This reduces the deployed dependency surface and does not claim that upstream Orbit's advisory is fixed.
