# ASCII artwork font

`site-ascii.woff2` is a static, regular-weight subset of Noto Sans Mono 2.014, licensed under the SIL Open Font License (see `OFL.txt`). It contains every character used by `asciiArt.txt` and `chipi.txt`, including spaces, box drawing, and the full block. All included glyphs have the same advance width.

Source: https://github.com/google/fonts/tree/main/ofl/notosansmono

Generated with fontTools: instantiate `wght=400`, `wdth=100`; subset to the union of both text files excluding newlines; save as WOFF2. If either artwork introduces new characters, regenerate the subset from the upstream font.
