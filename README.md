# Teardown Mod Maker

A website where you snap blocks together to make mods for [Teardown](https://teardowngame.com/), without writing code. Made for beginners and for teaching.

- **Blocks, not code.** Drag blocks like "make a tool called Boom Stick" and "explode where I'm looking" (uses [Blockly](https://developers.google.com/blockly)).
- **Hold T for help.** Hold the T key to see what every button, block and word on screen means.
- **English and Polish.** Switch language in the top right. English is the default.
- **See the real code.** Press "Show code" to see the Lua that your blocks write.
- **Download and play.** "Download mod" gives you a zip to drop into Teardown's mods folder.
- **No accounts.** Your blocks save in your browser automatically. "Save" and "Open" let you keep them in a file.

## Run it on Windows

You only need to do steps 1 to 3 once.

**1. Install Python.** Open PowerShell and type `python --version`.
If it says `Python 3.10` or higher, skip to step 2. Otherwise, install Python 3.12 from
[python.org/downloads](https://www.python.org/downloads/windows/). On the first installer screen, tick **"Add python.exe to PATH"**. Then close and reopen PowerShell and check `python --version` again.

**2. Get the code.** If you have [Git](https://git-scm.com/download/win):

```powershell
cd $HOME\Documents
git clone https://github.com/SzymonDevGit/teardown-mod-maker.git
cd teardown-mod-maker
```

No Git? On the GitHub page click **Code → Download ZIP**, unzip it, then `cd` into the folder in PowerShell.

**3. Set it up.**

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

If PowerShell says running scripts is disabled, run this once, then try again:
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

**4. Start it** (every time):

```powershell
.\.venv\Scripts\Activate.ps1
python app.py
```

Open <http://localhost:5000> in your browser. Press `Ctrl+C` in PowerShell to stop it.

The editor loads Blockly from the internet, so you need to be online.

## Play your mod in Teardown

1. Click **Download mod**, give it a name, and download the zip.
2. Unzip it. You get a folder such as `boom_stick`.
3. Move that folder into `Documents\Teardown\mods`.
4. Start Teardown, open **Mod Manager**, and turn your mod on.
5. Play **Sandbox**. Your tool is in the tool list (scroll the mouse wheel to find it).

Tip: use the **show message** block to check your blocks run. The message appears in the top left of the game.

## What's inside

| File | What it does |
| --- | --- |
| `app.py` | The Flask web server: shows the editor, switches language, builds the mod zip. |
| `modpack.py` | Makes the zip: `info.txt`, `main.lua` and a default `vox/tool.vox` model. |
| `static/js/blocks.js` | Every Teardown block, and the Lua code each one writes. |
| `static/js/help.js` | The hold-T help labels. |
| `static/js/main.js` | Buttons, saving, opening, and downloading. |
| `translations/en.json`, `pl.json` | All the text in both languages, including the help descriptions. |

**Adding a block:** define it and its Lua in `static/js/blocks.js`, add it to `TOOLBOX` and `BLOCK_TERMS`, then add its words to both translation files.

## Tests

```powershell
pip install -r requirements-dev.txt
pytest
```

The tests check the mod zip, the language switch, and that the Polish file has every English text.
