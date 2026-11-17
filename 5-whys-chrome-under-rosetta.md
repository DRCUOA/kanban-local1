# 5 Whys — Mac very laggy, Chrome especially

**Date:** 2026-11-07, measured 21:19–22:05 NZDT
**Machine:** MacBook Air, Apple M3 (8 cores), 16 GB, macOS (Darwin 25.6.0), on battery
**Artifact:** `/Users/Rich/Applications/Kanbando.app` (launcher dated 2026-10-12 16:42); Google Chrome 156.0.8078.80
**Status:** Chrome cause verified by reproduction. **Fixed 2026-11-07 ~22:05** in all four launcher apps, and verified. The running Chrome was reopened at 21:58:37 and is native (0 of 16 processes translated at 22:10). A second, system-wide cause (WindowServer load) is **not established**; see the end.

## Problem statement

Rich reports the whole Mac lagging badly, Chrome the worst. A first pass at 21:19 looked only at load: CPU 82–85% idle, memory pressure "normal" (level 1), 408 MB swap, no heat warnings, 102 GB disk free. On that basis it said the Mac was not overloaded. That was the wrong measure, because it did not check how Chrome was running. The Mac was restarted at 21:26–21:27 (`last`) and the lag continued.

## 5 Whys

**1. Why is Chrome laggy?**
One Chrome tab is holding a full CPU core all the time. Renderer pid 2747 used 101% of one core across a 10-second measurement, and `ps` showed 100% at 4m54s and 5m14s after it started. It started at 21:47:30. The only page opened in any Chrome profile in the 15 seconds around that was `https://www.nzherald.co.nz/` (Profile 1 history, 21:47:31). An extension process (pid 1104) also hit 40.8% in one sample.
A 2-second stack sample (`sample 2747`) is made up of frames in **"Rosetta JIT"** and **"Rosetta Runtime Routines"**. The tab's JavaScript is being translated from Intel code as it runs.

**2. Why is Chrome's JavaScript going through Rosetta?**
All of Chrome is running as the Intel version. All 21 Chrome processes have the kernel's translated flag set (`ps -o flags`, bit `0x20000`). That includes the browser process, the GPU process and every tab. The installed Chrome contains both versions (`lipo -archs` → `x86_64 arm64`), so the native one was available and not used. The only other translated process on the Mac is Zoom's audio plug-in.

**3. Why is a two-version Chrome running as Intel?**
Because an Intel-translated process started it. The browser process (pid 1077, started 21:28:09, a minute after the restart) has exactly this command line:
`--profile-directory=Profile 11 --app=https://livedexptechexpert.com/`
That is the command in `/Users/Rich/Applications/Kanbando.app/Contents/MacOS/launcher`, which runs Chrome's executable directly (`"$CHROME" … &`). A program started directly by a translated process is translated too. Tested: from native bash the child reports `proc_translated=0`; from `arch -x86_64` bash it reports `1`.
LaunchServices has **no** "Open using Rosetta" setting for Chrome (checked `com.apple.LaunchServices.plist`), so the inherited setting from the launcher is the only route found.

**4. Why does the Kanbando launcher run as Intel?**
Kanbando.app's main program is a **bash script**, and its Info.plist sets no preferred architecture. Reproduced with a throwaway bundle that copies Kanbando's Info.plist keys, opened through LaunchServices (`open -W`):

| Bundle | Script translated | `uname -m` | Child started directly | Child via `arch -arm64` |
|---|---|---|---|---|
| Same layout as Kanbando | **1** | **x86_64** | **1** | 0 |
| Same, plus `LSArchitecturePriority = [arm64]` | 0 | arm64 | 0 | 0 |

**5. Why does it hit everything in Chrome, and so hard?**
When Chrome is not already running, the launcher's process becomes the main Chrome browser. Every window, profile and tab then runs as Intel code until Chrome is fully quit. JavaScript-heavy pages suffer most, because Rosetta has to translate the code JavaScript generates as it runs. Measured on this Mac with Apple's own JavaScript engine (`jsc`, which also has both versions), three runs of the same script took **160–177 ms native** and **1,310–1,362 ms under Rosetta, about 8× slower**.
Nothing warns about any of this: Rosetta is already installed, so macOS shows no prompt, and the launcher sends Chrome's output to `/dev/null`.

**What set it off this time (unverified detail):** the 21:27 restart left Chrome closed, and the first Chrome start afterwards came from the Kanbando launcher at 21:28:09. *How* Kanbando was opened at 21:28 (login item, reopened at login, or the Dock) could not be established: the log entries need admin access, and `~/Library/Preferences/com.apple.loginitems.plist` has no entry.

## Root cause

**Kanbando.app's main program is a bash script with no architecture preference, so macOS runs it under Rosetta. Because the script starts Chrome directly, any Chrome it starts runs entirely as Intel code for the whole session, about 8× slower on JavaScript, and nothing warns that this has happened.**

## Fix (countermeasures at each level)

Applied to all four apps in `/Users/Rich/Applications/`: `Kanbando.app`, `StageBoard.app`, `StageBoard Console.app`, `StageBoard Test.app`. The originals of each `launcher` and `Info.plist` are in `/Users/Rich/Applications/.launcher-backup-2026-11-07/<app name>/`.

1. **The running Chrome (why 2): done.** Chrome was quit and reopened at 21:58:37 without the launcher's command line. It now runs natively: 0 of 16 processes translated.
2. **The defect (why 4): applied.** Each `Info.plist` now has `LSArchitecturePriority` = `["arm64"]`. All four still pass `plutil -lint`, stay XML, and were re-registered with `lsregister -f`. Opened through LaunchServices, each launcher script now runs natively.
3. **Belt and braces (why 3): applied.** Each launcher now starts Chrome with `/usr/bin/arch -arm64 "$CHROME" …` when `sysctl hw.optional.arm64` is `1`, which it is even under Rosetta (tested). Otherwise it keeps the old direct start, so the script still works on an Intel Mac. Chrome now starts natively even if the script itself is ever translated again.
4. **Same defect in other launchers (adjacent instances): applied** to the three StageBoard apps as well as Kanbando. Changes are identical: 10 lines in each launcher, one key in each `Info.plist`.
5. **Make it visible (masking): not applied.** With fix 3, Chrome starts natively whatever the script's own state, so a warning would never fire for Chrome. Left out to avoid adding behaviour nobody asked for.

To undo, copy the files back from the backup folder and run `lsregister -f` on the app.

## Verification

- **Latency checks:** scheduling, program launch and file I/O were normal (sleep overshoot median 1.26 ms; launching `/usr/bin/true` median 1.68 ms; creating or reading a 4 KB file under 0.1 ms). So the lag is not general CPU contention, disk or antivirus slowing every file access.
- **Rosetta tests:** the reproduction, the parent-to-child test and the JavaScript benchmark are all above. The test bundles were unregistered from LaunchServices and deleted afterwards.
- **After the fix (22:00–22:10):**
  - `bash -n` passes on all four launchers. They are still executable, and each diff against its backup is exactly the intended 10 lines.
  - **Copies of the fixed apps, opened through LaunchServices:** each was copied with only the bundle ID changed, and `CHROME` pointed at a probe that records its own architecture.

    | Copy | Launcher translated | Chrome stand-in translated | Arguments passed through |
    |---|---|---|---|
    | Original Kanbando (control, from backup) | **1** | **1** | correct |
    | Fixed Kanbando | 0 | 0 | correct |
    | Fixed StageBoard | 0 | 0 | correct |
    | Fixed StageBoard Console | 0 | 0 | correct |
    | Fixed StageBoard Test | 0 | 0 | correct |

  - **Real Chrome from a translated parent:** a separate hidden Chrome with its own scratch profile, so Rich's Chrome was untouched. Started directly, it came up translated (1 process seen by the 3-second check). Started with `arch -arm64`, all 10 processes (browser, GPU, utility, renderers) were **native**, and the parent was confirmed translated. The test copies, test profiles and test Chromes were all removed afterwards.
  - **About the 0 counts in two earlier test runs:** the shell running the checks (zsh) did not split a variable holding several process IDs into separate IDs, so multi-process results counted as 0. That was a flaw in the check, not a result. The final run listed processes directly and is the one used above.
- **Not tested:** opening the real `Kanbando.app` itself while Chrome is closed. That needs Rich to quit Chrome, which closes his windows. The copies above test the same `Info.plist` and launcher content through the same LaunchServices path.
- The 8× figure is from JavaScriptCore, not Chrome's own engine (V8). Treat it as the size of the effect, not an exact number for Chrome.

## Second cause, not established: WindowServer load

WindowServer (which draws the screen) used 38–43% CPU in every sample, before and after the restart. GPU use was 34–42% at about 21:52 and 12–17% a few minutes later. Of the GPU time, 32% was WindowServer's own; Claude was 2.8% and Safari 1.1%. The keyboard/trackpad idle time (`HIDIdleTime`) read 0 seconds in all 10 samples, so input was arriving the whole time. Whether that was Rich using the Mac or a device sending events is unknown. **No evidence links this to Rosetta, and its cause is not established.**
Re-measured at about 22:10, with Chrome native: WindowServer 30–34% CPU (instant readings from `top`), GPU 8–23%, all of Chrome 6–16% CPU. Input was still arriving in every sample. So WindowServer is somewhat lower but still high, and still unexplained.

**Hands-off test, about 22:12–22:13.** Rich was asked to keep off the keyboard and trackpad. After an 8-second wait for him to let go, there were 14 samples of about 2 seconds each.

| Measure | Result |
|---|---|
| Seconds since last input | 7.1 s at the first sample, then 0.0–2.3 s for the rest: input arrived every 1–2 s |
| Source of that input | WindowServer's "user is active" flag (`pmset -g assertions`, 22:13:56) names `service:AppleMultitouchDevice product:Apple Internal Keyboard /…`, the **built-in keyboard and trackpad**. No software was declaring activity. |
| WindowServer CPU | 40.4–43.6% in every sample, **including the first one, when there had been no input for 7 s** |
| GPU use | 15–33%. GPU time by process: WindowServer 17.0%, Claude 5.0%, CoreServicesUIAgent 2.2% |
| Other CPU | Claude app 24–30%, Chrome 27–54%, kernel_task 10–13% |
| Windows on screen | Claude (1392×923), Chrome (1392×923), Dock, menu bar and Control Centre items. No unexpected overlay windows. |

What this shows:
- WindowServer's load is **not caused by the input events**: it was just as high in the sample with no input.
- The only apps drawing on screen are Claude and Chrome, and both were busy throughout. Part of the Claude app's load is this diagnostic session running in it; that share was not separated.
- **Not established:** whether the trackpad input during the test came from Rich touching it or from the trackpad registering touches on its own. Only Rich can say whether he touched it.

**Hide-Chrome test, about 22:16.** Samples were taken every ~2.5 s for 76 s, recording whether Chrome had a window on screen (from the system's on-screen window list). Chrome was on screen until ~33 s, then hidden from ~36 s to the end, apart from one sample at 40 s.

| Chrome's window | Samples | WindowServer CPU | GPU | Chrome CPU | Claude app CPU |
|---|---|---|---|---|---|
| On screen | 15 | 40.6% | 27% | 2.4% | 23.7% |
| Hidden | 17 | 39.5% | 37% | 1.1% | 27.3% |

- **Chrome is ruled out as the source of WindowServer's load.** Hiding it changed WindowServer by about 1 point, and Chrome was nearly idle (0–8% CPU) throughout.
- While Chrome was hidden, the only app window on screen was Claude's. The Claude app used 19–51% CPU in every sample.
- **Not yet separated:** how much of that is the Claude app's normal behaviour and how much is this diagnostic session running in it.
- **Test flaw:** the "front app" reading failed. A parsing bug recorded the field name `LSDisplayName` instead of the app's name, so which app was in front in the first half is unknown. The on-screen comparison above doesn't depend on it.

**Idle-session test, 22:22:22–22:23:22.** The sampler started after the session's reply had finished. 25 samples were taken; the front app was read correctly this time.

| Phase | Samples | Input idle | WindowServer CPU | GPU | Claude app CPU | Session CPU | Chrome CPU |
|---|---|---|---|---|---|---|---|
| Claude in front, Chrome hidden, nobody touching | 17 | 57 → 93 s | 25.2–38.6% | **35–38%** | 12.6–17.8% | 0.6–8.3% | 0–3.5% |
| Chrome in front (Rich using it) | 8 | 0–1.7 s | 30.6–39.7% | **13–31%** | 13.0–23.7% | 0.6–3.0% | 11–75% |

Averages over all 25 samples: WindowServer 32.5% CPU, GPU 31%, Claude app 15.6%, session 1.5%, Chrome 14.4%. GPU time by process: WindowServer 22.6%, Claude 2.5%, CoreServicesUIAgent 0.8%.

What this shows:
- **WindowServer stays at roughly 25–40% CPU in every condition tested:** with and without input, Chrome shown or hidden, the session busy or idle. Its cause is still **not established**.
- **The Claude app uses 13–18% CPU even when its session is idle** and nobody is touching the Mac.
- **GPU use follows the Claude window (a correlation, not a controlled test):** 35–38% in all 17 samples with Claude in front, 13–17% in 6 of the 8 samples with Chrome covering it. Earlier runs fit the same pattern. Bringing Chrome forward also changed other things, so this is not proof.
- **The trackpad sent no input for 93 seconds when nobody was touching it.** There is no sign of it registering touches on its own.

**Next test, if lag is still felt now that Chrome is native:** hide the Claude app (⌘H) with no other window in front, for 20 seconds. That gives WindowServer's load with no app drawing (the desktop only), which is the missing baseline.
Next test: once Chrome is running natively, leave the keyboard and trackpad untouched for 30 seconds while WindowServer CPU, GPU use and idle time are sampled.

## Left as-is

- Zoom's audio plug-in (`ZoomAudioDevice.driver`) runs translated. Its CPU use was negligible.
- `codesign --verify --deep --strict` on Chrome fails with "resource fork, Finder information, or similar detritus". The signing identity is Google's (team `EQHXZ8M8AV`, including `libaperitif.dylib`). The cause of the failure was not investigated.
- Earlier today Spotlight (`spotlightknowledged`) went over macOS's CPU limits (09:46, 10:48, 11:08). Photo and video analysis (`mediaanalysisd`) had used 8.9 h of CPU over 4 days before the restart. Neither was active during these measurements.
