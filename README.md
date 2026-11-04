# bjarvik.com

Den byggede hjemmeside for Bjarvik. Siderne laves på Mac'en af `vanta/skabeloner/byg-site.ps1` i vanta-system
og kopieres hertil af `vanta/skabeloner/udgiv-bjarvik.sh`. Ret ikke siderne her; ret i `vanta/site-build/` og byg igen.

Når der pushes til main, uploader "Udgiv siden" (`.github/workflows/udgiv.yml`) filerne til webhotellet hos Simply
over FTPS, som saetdagsordenen.dk og sagsvagt.dk. Kun ændrede filer uploades efter første gang.

`.htaccess`, `.github/` og denne fil ligger kun her og overskrives ikke af udgiv-scriptet.
