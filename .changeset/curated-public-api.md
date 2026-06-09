---
"@anarchitecture/summon": minor
"@anarchitecture/summon-server": patch
"@anarchitecture/summon-react": patch
---

Curate the root Summon export to the beta host-authoring API and move advanced
browser, engine, and host runtime APIs behind explicit public subpaths. Packed
server and React packages now import those public subpaths instead of relying on
root export leakage.
