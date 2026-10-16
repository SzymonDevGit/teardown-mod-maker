# Teardown Mod Maker

A website where you snap blocks together to make mods for [Teardown](https://teardowngame.com/), without writing code. Made for beginners and for teaching.

- **Blocks, not code.** Drag blocks like "make a tool called Boom Stick" and "explode where I'm looking" (uses [Blockly](https://developers.google.com/blockly)).
- **Hold T for help.** Hold the T key to see what every button, block and word on screen means.
- **English and Polish.** Switch language in the top right. English is the default, Polish is at `/pl/`.
- **See the real code.** Press "Show code" to see the Lua that your blocks write.
- **Download and play.** "Download mod" gives you a zip to drop into Teardown's mods folder.
- **No accounts.** Your blocks save in your browser automatically. "Save" and "Open" let you keep them in a file.

## The blocks

| Group | Blocks |
| --- | --- |
| Events | make a tool, when a key is pressed, when the game starts, every few seconds, every frame |
| Actions | explode, make a hole, start a fire, shoot, paint, shake the screen, play a sound, show a message |
| Player | launch, push me, teleport, set or change health, slow motion, my health, my speed, key held down, on the ground |
| Places | where I'm looking, my position, in front of me, above a place, a random spot near a place |
| If / Then, Repeat, Numbers, Text, Variables | Blockly's standard blocks, including "join text" and "change variable by" |
| **Advanced: Timers** | after some seconds, every few seconds, time since the level started |
| **Advanced: Screen** | big text on the screen (top, middle or bottom), clear it, black and white or old-photo colours |
| **Advanced: Objects** | push or remove what you're looking at, spawn a box, looking at something that can move, gravity |
| **Advanced: Effects** | coloured lights, smoke and sparks, rain |
| **Advanced: My blocks** | make your own block out of other blocks and reuse it |

Mods are classic singleplayer mods (plain `init`, `tick` and `draw` in `main.lua`), which Teardown still supports. They don't work in multiplayer yet.

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

## Put it online for free (Cloudflare Pages)

Everything, including building the mod zip, runs in the visitor's browser, so the website is just plain files. It never sleeps and costs nothing to host.

1. Sign in at [dash.cloudflare.com](https://dash.cloudflare.com) and go to **Workers & Pages → Create → Pages → Connect to Git**.
2. Pick the `teardown-mod-maker` repo and fill in:
   - Production branch: `main`
   - Build command: `pip install -r requirements.txt && python build_static.py`
   - Build output directory: `dist`
3. Click **Save and Deploy**. The site appears at `teardown-mod-maker.pages.dev`, and updates by itself every time `main` changes.
4. To use your own domain, open the project's **Custom domains** tab and add it (for a domain bought through Cloudflare, it sets up the DNS for you).

To try the built site on your own PC: `python build_static.py`, then `python -m http.server 8000 --directory dist` and open <http://localhost:8000>.

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
| `app.py` | The Flask web server for running it on your PC: shows the editor in English (`/`) or Polish (`/pl/`). |
| `build_static.py` | Saves the editor as plain files in `dist/` for static hosting. |
| `static/js/modpack.js` | Makes the mod zip in the browser: `info.txt`, `main.lua` and `vox/tool.vox`. |
| `modpack.py` | Makes the default tool model, `static/vox/tool.vox`. Run `python modpack.py` after changing it. |
| `static/js/blocks.js` | Every Teardown block, and the Lua code each one writes. |
| `static/js/help.js` | The hold-T help labels. |
| `static/js/main.js` | Buttons, saving, opening, and downloading. |
| `translations/en.json`, `pl.json` | All the text in both languages, including the help descriptions. |

**Adding a block:** define it and its Lua in `static/js/blocks.js`, add it to `TOOLBOX` and `BLOCK_TERMS`, then add its words and its hold-T help to both translation files. The tests fail if any of those are missing.

## Tests

```powershell
pip install -r requirements-dev.txt
pytest
```

The tests check the mod zip (these need [Node.js](https://nodejs.org/), and are skipped without it), both language pages, the static build, that the Polish file has every English text, and that every block has its words and hold-T help in both languages.
