# Club Event Radar: handoff notes for Manu

## 1. What works now

**Website:** https://bus4498.github.io/BUS4498_InClass_Builds/event_radar/

- **Posting:** a club officer pastes an announcement (and, if they want, a JPG or PNG flyer up to 5 MB). The AI agent turns it into an event card and checks the posting rules. The post is then **published**, **waiting** for a moderator, **not posted** (not an event), or **already posted** (a duplicate).
- **The event list:** the website shows published events, soonest first, with Free and 🍕 Free food tags and flyer photos.
- **Moderators:** they sign in at the bottom of the page and approve or reject waiting posts. Posts with a photo always wait for a moderator.
- **Accounts:** new sign-ups are turned off, so only accounts made in Supabase can sign in.

## 2. Where things live

- **GitHub repository:** `BUS4498_InClass_Builds`. Everything for this project is in the `event_radar/` folder. GitHub Pages serves the website from the `main` branch.
- **Supabase project:** `event-radar`, Project URL `https://vwbkkkxxndbzzwlizvkn.supabase.co`.
  - **Database table:** `public.events` saves every post.
  - **Edge Function:** `submit-event` is the AI agent.
  - **Storage bucket:** `flyers` holds the photos.
  - **Auth:** holds the moderator accounts.
- **Files that matter:**
  - `index.html`, `app.js`, `style.css`: the website.
  - `config.js`: the Project URL and the publishable key. Both are public and safe to share.
  - `supabase/functions/submit-event/index.ts`: the AI agent. The posting rules and place list are copied inside it.
  - `supabase/migrations/`: the database changes, one file per stage (4, 7, 8).
  - `context/posting-rules.md`, `context/campus-places.md`: the rules and place codes. If you change these, change `index.ts` too, then redeploy the agent.
  - `test/sample-announcements.md`, `test/sample-flyer.png`: the test posts.
  - `AGENTS.md`: the build instructions Claude Code and Codex follow.

## 3. Secrets

- **`ANTHROPIC_API_KEY`:** the AI key the agent uses (model `claude-haiku-5-5`). It's set in Supabase → **Edge Functions** → **Secrets**.
- **Supabase's own keys:** Supabase gives the agent its secret key automatically.

You don't need any of these values to work on the project, and they're never in this repository. Never put a secret key (`sb_secret_...`), the database password, or an AI key in any file here. The moderator password isn't written down anywhere either; ask me if you need to moderate.

## 4. How to test

Paste these on the website (from `test/sample-announcements.md`):

1. **Post E:** "Women in Finance Circle: resume workshop next week! Bring your resume. More details soon." → **Waiting for a moderator**, asking for the date, start time, and place.
2. **Post F:** "Selling my ECON 201 textbook, barely used, $40. DM me if interested!" → **Not posted**, because it's a sale, not an event.
3. **Post C:** the Board Game Guild reminder → **Already posted**, because post A (Game Night, Oct 29, 7 PM, UU) is already on the website.

Then sign in as a moderator, approve a waiting post, and check that it appears in the list.

## 5. What’s next

- **Past events stay on the list.** The optional nightly clean-up in `AGENTS.md` would archive them each night.
- **A Free food filter:** `style.css` already has the button style (`chip`).
- **Clubs aren't told what happened** after a moderator approves or rejects their post.
- **The duplicate check needs an exact match** of date, start time, and place. A post with a slightly different time gets through.
- **Leaked password protection is off.** Supabase's security advisor suggests turning it on in Authentication.
- **The OpenAI backup path is untested:** the agent can use an `OPENAI_API_KEY` if there's no Claude key.

## 6. How we take turns

1. **Before you start:** tell me you're working on it, so we don't change the same files at once.
2. **Download first (pull):** in GitHub Desktop, click **Fetch origin**, then **Pull origin**.
3. **Upload when you stop (push):** commit with a short note on what you changed, then **Push origin**. Tell me you're done.
4. **Database and agent changes:** these happen in Supabase right away, not through GitHub. Tell me before you apply a migration or redeploy the agent, and save the same change in `supabase/` so the repository matches.
