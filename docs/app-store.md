# Putting Manifester in the App Store

Manifester is a web app. Everything below is the work of turning it into a
thing Apple will list, in the order the work actually has to happen, with the
one part that decides whether any of it is worth doing stated first.

Prices, policy numbers and asset sizes change. Every figure here is worth
checking against [developer.apple.com](https://developer.apple.com) and the
[App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
on the day you start.

---

## 0. The question that decides the rest

**Guideline 4.2 — Minimum Functionality.** Apple rejects apps that are a
website in a shell. "Your app should include features, content, and UI that
elevate it beyond a repackaged website." A WKWebView pointed at
`cvree.github.io/Manifester` is the textbook rejection.

So the App Store version cannot be the PWA with an icon on it. It has to do
things the PWA cannot — and the useful part is that Manifester already knows
exactly what those are, because they are the same things
[Browser limitations, honestly](../README.md#browser-limitations-honestly)
lists as the web version's real losses:

| What the web version cannot do | What the native app would do |
| --- | --- |
| iOS suspends backgrounded web audio, so a session ends when the screen locks | An `AVAudioSession` with the `audio` background mode — a loop that runs for forty minutes with the phone in a pocket |
| Lock-screen controls are a `MediaSession` approximation | Real `MPNowPlayingInfoCenter` and remote commands |
| No reminders — the app writes one `.ics` event and says so | Opt-in local notifications, still with no server behind them |
| Studio Voice for your own words is a ~90 MB in-browser download | The same model shipped in the bundle, or `AVSpeechSynthesizer` |
| Nothing outside the browser | A Home Screen widget, a Shortcuts action, mindful minutes written to Health |

Background audio alone is both the strongest 4.2 answer and the biggest actual
product win — it is the one thing people would install a native version *for*.
Do that one first; the rest is optional.

**The honest alternative:** if the point is reach rather than capability, the
App Store's own search is the channel, and the web work in
[the website section](../README.md#the-website) is cheaper, faster and reversible.
Do that first regardless. This document is only worth executing if background
audio matters to you.

---

## 1. Enrol in the Apple Developer Program

- **$99 per year**, renewed annually or the app is delisted.
- Individual enrolment needs an Apple Account with two-factor authentication and
  a government ID. Enrolling as an organisation additionally needs a
  **D-U-N-S number**, which is free but can take a couple of weeks — start it
  early if you want the listing to say something other than your legal name.
- Enrolment itself does not need a Mac. Everything after it does.

## 2. Get a Mac in the loop

Xcode is macOS-only, and only Xcode can build and upload an iOS app. Options,
cheapest first:

- A Mac you already have.
- **GitHub Actions `macos-latest` runners** — free minutes on public repos, and
  this repo is public. Enough to build, sign and upload; not enough to run the
  Simulator interactively while you debug.
- A rented cloud Mac (MacStadium, Scaleway, or a CI service with an interactive
  session) by the hour.

## 3. Wrap the app with Capacitor

[Capacitor](https://capacitorjs.com) is the standard route for exactly this
shape of project: it takes a built `dist/` and gives it a native iOS project
whose plugins you can call from TypeScript.

```bash
npm install @capacitor/core @capacitor/ios
npm install --save-dev @capacitor/cli
npx cap init Manifester io.github.cvree.manifester --web-dir dist
MANIFESTER_BASE=/ npm run build   # a native bundle is served from the root
npx cap add ios
npx cap sync ios
npx cap open ios                  # opens Xcode
```

Two things to get right at this step:

- **`MANIFESTER_BASE=/`.** The GitHub Pages sub-path is wrong inside a native
  bundle, and every asset 404s silently if you forget.
- **The service worker.** Capacitor serves from `capacitor://localhost`. The
  offline bundle is redundant there — the files are already on disk — and a
  stale service worker is a class of bug you do not want inside a shell you
  cannot hot-fix. Disable registration when running natively.

## 4. Build the things that make it an app

In rough order of what a reviewer will notice:

1. **Background audio.** `AVAudioSession` category `.playback`, the `audio`
   background mode in `Info.plist`, and the session kept alive across screen
   lock. Test it by locking the phone for ten minutes.
2. **Now Playing.** Title, artwork and elapsed time on the lock screen; play,
   pause and stop wired to `MPRemoteCommandCenter`.
3. **Local notifications**, opt-in and off by default — the deliberate absence
   of nagging is part of the pitch, so this is a setting somebody turns on, not
   a permission prompt on first launch.
4. **HealthKit** `mindfulSession` writes, if you want the Health app to reflect
   a session. Needs a usage-description string and a clear reason.
5. **Voice.** Either ship the Kokoro model in the bundle (large, but it is the
   difference between "your words in the app's voice" being the default and
   being a 90 MB opt-in) or fall back to `AVSpeechSynthesizer`.

## 5. Decide what does *not* ship on iOS

- **The bring-your-own-Gemini-key flow.** An app that asks a user to paste a
  third-party API key is a reviewer question you do not need, and it is the one
  feature in the app that sends anything anywhere. Leaving it out of the iOS
  build makes the privacy label unambiguous — see step 7.
- **Anything that reads as a medical claim.** Affirmations and breathing are
  wellness. Copy that says the app treats anxiety, depression or insomnia moves
  you into a category with much heavier requirements, and Manifester's existing
  copy is already careful about this. Keep it that way.
- **Payments.** While the app is free with nothing to unlock there is nothing to
  do. The moment anything is sold, it must go through In-App Purchase
  (guideline 3.1.1) with Apple's cut.

## 6. Assets and the App Store Connect record

- **Bundle identifier**, registered once and permanent: `io.github.cvree.manifester`,
  or reverse-DNS on a domain you own.
- **App name** — unique across the whole store, up to 30 characters.
  *Manifester* may well be taken; check before you build a listing around it.
  A subtitle of 30 characters sits under it, and
  "Affirmations in your own words" fits exactly.
- **Icon**, 1024×1024 PNG, no alpha channel and no rounded corners — Apple
  applies the mask. `scripts/generate-icons.mjs` already draws the motif at 512;
  add a 1024 output with a flat background.
- **Screenshots** for the current required iPhone display sizes, plus iPad if
  you list iPad support. These are the listing. Take them from the real app.
- **Privacy policy URL** — mandatory for every app. The
  [Privacy section of the README](../README.md#privacy) is most of the text
  already; it needs to exist as a page at a stable URL, which the static site
  now has a natural place for.
- **Support URL** — the GitHub issues page qualifies.
- **App Privacy details.** Manifester can answer **Data Not Collected** across
  the board, which almost nothing in this category can. That answer has to stay
  true, which is the real reason to leave the Gemini flow out of the iOS build.
- **Age rating** questionnaire, **primary category** (Health & Fitness, or
  Lifestyle), and **export compliance** — an app using only standard HTTPS is
  normally exempt, but the question is asked on every upload and can be answered
  once in `Info.plist`.
- **`PrivacyInfo.xcprivacy`**, the privacy manifest, declaring required-reason
  API use (`UserDefaults` counts) and any third-party SDK's.

## 7. Sign, upload, test, submit

1. Automatic signing in Xcode for the first build; an App Store Connect API key
   and `fastlane match` if you move it to CI later.
2. Archive and upload to App Store Connect.
3. **TestFlight** — install it on your own phone from TestFlight before anybody
   reviews it. Internal testers need no review; external testers need a short
   one.
4. Submit for review. First reviews commonly land within a day or two; a
   rejection restarts that clock, so it is worth reading guideline 4.2 once more
   before you press the button.
5. In the notes to the reviewer, say plainly what the app does that a website
   cannot, and how to see it — *lock the screen during a session and the audio
   continues*. Reviewers are working from a checklist against the clock, and 4.2
   rejections are frequently a reviewer not finding the thing that answers it.

## 8. What it costs to keep

- $99 a year, indefinitely.
- Apple raises the minimum SDK for new submissions roughly annually, so the
  project needs a rebuild against a current Xcode about once a year whether or
  not anything changed.
- Every update goes through review again.

---

## The short version

Enrol ($99), get a Mac, wrap `dist/` with Capacitor, and then do the part that
matters: make the loop keep playing when the screen locks. That single feature
is both the answer to the rejection Apple would otherwise send and the only
reason the native version is better than the URL. Everything else on this page
is paperwork around it.
