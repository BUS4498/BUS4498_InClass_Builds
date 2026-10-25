// Club Event Radar: the website. It runs in each visitor's browser (GitHub Pages only serves it).
// It reads published events from the database and sends new posts to the AI agent.
// It knows only the project address and the publishable key, so it can do only what the security rules allow.
(function () {
  "use strict";
  var cfg = window.EVENT_RADAR_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };

  if (!cfg.supabaseUrl || /YOUR-PROJECT-REF/.test(cfg.supabaseUrl) || !cfg.publishableKey || /YOUR-KEY/.test(cfg.publishableKey)) {
    $("boardStatus").textContent = "Add your Project URL and publishable key to config.js first.";
    return;
  }
  if (/^sb_secret_/.test(cfg.publishableKey)) {
    $("boardStatus").textContent = "Stop: config.js holds the secret key. Replace it with the publishable key, then create a new secret key in Supabase.";
    return;
  }

  var baseUrl = cfg.supabaseUrl.replace(/\/+$/, "");
  var db = window.supabase.createClient(baseUrl, cfg.publishableKey);
  var AGENT_URL = baseUrl + "/functions/v1/submit-event";
  // The website may read only these columns (the menu), never the raw announcement or moderator notes.
  var PUBLIC_COLUMNS = [
    "id", "title", "club", "event_date", "start_time", "end_time", "place_name", "place_detail", "cost", "free_food", "summary",
    "flyer_url",
  ].join(",");

  /* ---------- small helpers ---------- */
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text; // always textContent: posts are typed by strangers
    return e;
  }
  function fmtDate(d) {
    if (!d) return "Date to be announced";
    var p = d.split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }
  function fmtTime(t) {
    if (!t) return "";
    var p = t.split(":"), h = +p[0], ap = h >= 12 ? "PM" : "AM";
    return (h % 12 || 12) + ":" + p[1] + " " + ap;
  }
  // What the agent looked at before it decided: the club list, the club's earlier posts, the lessons.
  function memo(lines) {
    if (!lines || !lines.length) return null;
    var box = el("div", "memo");
    box.appendChild(el("p", "memo-title", "What the agent looked at"));
    var ul = el("ul");
    lines.forEach(function (l) { ul.appendChild(el("li", null, l)); });
    box.appendChild(ul);
    return box;
  }

  /* ---------- one event card: date badge, details, and (from Stage 7) the flyer ---------- */
  function dateBadge(d) {
    var box = el("div", "date");
    if (!d) { box.className = "date tba"; box.appendChild(el("span", "day", "TBA")); return box; }
    var p = d.split("-"), day = new Date(+p[0], +p[1] - 1, +p[2]);
    box.appendChild(el("span", "mon", day.toLocaleDateString("en-US", { month: "short" })));
    box.appendChild(el("span", "day", String(day.getDate())));
    return box;
  }
  function card(ev, extra) {
    var li = el("li", "event");
    li.appendChild(dateBadge(ev.event_date));
    var body = el("div", "event-body");
    var time = ev.start_time ? " · " + fmtTime(ev.start_time) + (ev.end_time ? " to " + fmtTime(ev.end_time) : "") : "";
    body.appendChild(el("p", "when", fmtDate(ev.event_date) + time));
    body.appendChild(el("h3", null, ev.title || "Untitled event"));
    var where = [ev.place_name, ev.place_detail].filter(Boolean).join(", ");
    var meta = [ev.club, where].filter(Boolean).join(" · ");
    if (meta) body.appendChild(el("p", "meta", meta));
    if (ev.summary) body.appendChild(el("p", "summary", ev.summary));
    var tags = el("p", "tags");
    if (ev.cost) tags.appendChild(el("span", "tag", ev.cost));
    if (ev.free_food) tags.appendChild(el("span", "tag food", "🍕 Free food"));
    if (tags.childNodes.length) body.appendChild(tags);
    if (extra) body.appendChild(extra);
    li.appendChild(body);
    if (ev.flyer_url && ev.flyer_url.indexOf(baseUrl + "/storage/v1/object/public/flyers/") === 0) {
      var img = el("img", "flyer");
      img.src = ev.flyer_url;
      img.alt = "Flyer for " + (ev.title || "this event");
      img.loading = "lazy";
      li.appendChild(img);
    }
    return li;
  }

  /* ---------- the event list: published events only ---------- */
  function loadBoard() {
    $("boardStatus").textContent = "Loading…";
    db.from("events").select(PUBLIC_COLUMNS).eq("status", "published")
      .order("event_date", { ascending: true, nullsFirst: false })
      .order("start_time", { ascending: true, nullsFirst: false })
      .then(function (res) {
        var list = $("board");
        list.textContent = "";
        if (res.error) { $("boardStatus").textContent = "Couldn't load events: " + res.error.message; return; }
        res.data.forEach(function (ev) { list.appendChild(card(ev)); });
        if (!res.data.length) list.appendChild(el("li", "empty", "No events yet. Post the first one!"));
        $("boardStatus").textContent = res.data.length ? res.data.length + (res.data.length === 1 ? " event" : " events") : "";
      });
  }

  /* ---------- posting: send it to the AI agent ---------- */
  var LABELS = { published: "Published", waiting: "Waiting for a moderator", rejected: "Not posted", duplicate: "Already posted", error: "Something went wrong" };
  function showResult(data) {
    var box = $("postResult"), kind = data.ok ? data.status : "error";
    box.hidden = false;
    box.className = "result " + kind;
    box.textContent = "";
    box.appendChild(el("p", "result-label", LABELS[kind] || kind));
    box.appendChild(el("p", null, data.message || ""));
    if (data.reasons && data.reasons.length) {
      var ul = el("ul", "reasons");
      data.reasons.forEach(function (r) { ul.appendChild(el("li", null, r)); });
      box.appendChild(ul);
    }
    if (data.event && data.status !== "rejected") {
      var preview = el("ul", "board preview");
      preview.appendChild(card(data.event));
      box.appendChild(preview);
    }
    var looked = memo(data.looked_at);
    if (looked) box.appendChild(looked);
  }

  $("postForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var form = $("postForm"), btn = $("postBtn");
    var photo = $("flyer").files[0];
    if (photo && photo.size > 5 * 1024 * 1024) { showResult({ ok: false, message: "The photo must be 5 MB or smaller." }); return; }
    btn.disabled = true;
    btn.textContent = "The agent is reading it…";
    // The publishable key goes on the apikey header only (never as an Authorization bearer token).
    fetch(AGENT_URL, { method: "POST", headers: { apikey: cfg.publishableKey }, body: new FormData(form) })
      .then(function (r) {
        return r.json().catch(function () { return { ok: false, message: "The agent didn't answer (" + r.status + "). Is the function deployed?" }; });
      })
      .then(function (data) {
        showResult(data);
        if (data.ok) { form.reset(); loadBoard(); }
      })
      .catch(function () { showResult({ ok: false, message: "Couldn't reach the agent. Check your internet connection and the Project URL in config.js." }); })
      .then(function () { btn.disabled = false; btn.textContent = "Post it"; });
  });
  $("refreshBtn").addEventListener("click", loadBoard);

  // Say who drafts the cards (a quick check that doesn't call the AI).
  fetch(AGENT_URL, { headers: { apikey: cfg.publishableKey } })
    .then(function (r) { return r.json(); })
    .then(function (d) { if (d && d.ai) $("aiNote").textContent = "Event cards are drafted by an AI agent, " + d.ai + ", and checked against the posting rules."; })
    .catch(function () { /* the website still works without this note */ });

  /* ---------- moderator sign-in ---------- */
  var session = null;
  function renderMod() {
    $("signInForm").hidden = Boolean(session);
    $("modArea").hidden = !session;
    if (session) {
      $("modWho").textContent = session.user.email;
      loadWaiting();
      loadLessons();
    }
  }
  function review(ev, status) {
    var stamp = { reviewed_at: new Date().toISOString(), reviewed_by: session.user.email };
    db.from("events")
      .update({ status: status, reviewed_at: stamp.reviewed_at, reviewed_by: stamp.reviewed_by })
      .eq("id", ev.id)
      .then(function (res) {
        if (res.error) { $("waitingStatus").textContent = "Couldn't save that: " + res.error.message; return; }
        // Approving an update retires the post it replaces, so the website never shows both.
        if (status === "published" && ev.updates_id) {
          return db.from("events")
            .update({ status: "replaced", status_reason: "Replaced by a newer post the moderator approved.", reviewed_at: stamp.reviewed_at, reviewed_by: stamp.reviewed_by })
            .eq("id", ev.updates_id).in("status", ["published", "waiting"]);
        }
      })
      .then(function () {
        loadWaiting();
        loadBoard();
      });
  }
  function loadWaiting() {
    $("waitingStatus").textContent = "Loading…";
    db.from("events").select("*").eq("status", "waiting").order("created_at", { ascending: true })
      .then(function (res) {
        var list = $("waitingList");
        list.textContent = "";
        if (res.error) { $("waitingStatus").textContent = "Couldn't load waiting posts: " + res.error.message; return; }
        res.data.forEach(function (ev) {
          var box = el("div", "review");
          if (ev.status_reason) box.appendChild(el("p", "why", "Why it's waiting: " + ev.status_reason));
          box.appendChild(el("p", "original", "Original post: " + ev.announcement));
          var looked = memo(ev.agent_notes);
          if (looked) box.appendChild(looked);
          // Teach the agent while the post is fresh: the lesson is saved with the decision.
          var teachLabel = el("label", "teach-inline");
          teachLabel.appendChild(el("span", null, "Teach the agent something (optional)"));
          var teachInput = el("input");
          teachInput.type = "text"; teachInput.maxLength = 300;
          teachInput.placeholder = "One sentence the agent should remember next time.";
          teachLabel.appendChild(teachInput);
          box.appendChild(teachLabel);
          var approve = el("button", null, "Approve");
          var reject = el("button", "ghost", "Reject");
          approve.type = reject.type = "button";
          function decideThen(status) {
            var lesson = teachInput.value.trim();
            if (lesson) { saveLesson(lesson, ev.id).then(function () { review(ev, status); }); return; }
            review(ev, status);
          }
          approve.addEventListener("click", function () { decideThen("published"); });
          reject.addEventListener("click", function () { decideThen("rejected"); });
          var row = el("p", "actions");
          row.appendChild(approve);
          row.appendChild(reject);
          box.appendChild(row);
          list.appendChild(card(ev, box));
        });
        $("waitingStatus").textContent = res.data.length ? res.data.length + " waiting" : "Nothing is waiting. Nice work.";
      });
  }
  $("signInForm").addEventListener("submit", function (e) {
    e.preventDefault();
    $("signInMsg").textContent = "Signing in…";
    db.auth.signInWithPassword({ email: $("modEmail").value.trim(), password: $("modPassword").value })
      .then(function (res) {
        $("modPassword").value = "";
        // Show Supabase's own reason, such as "Invalid login credentials", so problems are easy to spot.
        $("signInMsg").textContent = res.error ? "Sign-in didn't work: " + res.error.message : "";
      })
      .catch(function () { $("signInMsg").textContent = "Supabase couldn't be reached. Check your internet connection and try again."; });
  });
  $("signOutBtn").addEventListener("click", function () { db.auth.signOut(); });
  db.auth.onAuthStateChange(function (_event, s) { session = s; renderMod(); });
  db.auth.getSession().then(function (res) {
    session = res.data.session;
    if (session) $("modBox").open = true;
    renderMod();
  });

  /* ---------- lessons: what moderators teach the agent ---------- */
  function saveLesson(text, fromPost) {
    return db.from("lessons").insert({ lesson: text.slice(0, 300), created_by: session.user.email, from_post: fromPost || null })
      .then(function (res) {
        $("teachMsg").textContent = res.error ? "Couldn't save the lesson: " + res.error.message : "Saved. The agent reads it with the next post.";
        loadLessons();
      });
  }
  function loadLessons() {
    $("lessonsStatus").textContent = "Loading…";
    db.from("lessons").select("*").order("created_at", { ascending: true })
      .then(function (res) {
        var list = $("lessonsList");
        list.textContent = "";
        if (res.error) { $("lessonsStatus").textContent = "Couldn't load the lessons: " + res.error.message; return; }
        res.data.forEach(function (l) {
          var li = el("li", "lesson" + (l.active ? "" : " off"));
          var sw = el("label", "switch");
          var box = el("input");
          box.type = "checkbox"; box.checked = l.active;
          box.setAttribute("aria-label", (l.active ? "Switch off: " : "Switch on: ") + l.lesson);
          box.addEventListener("change", function () {
            db.from("lessons").update({ active: box.checked }).eq("id", l.id).then(function (r) {
              if (r.error) { $("lessonsStatus").textContent = "Couldn't change that: " + r.error.message; box.checked = !box.checked; return; }
              loadLessons();
            });
          });
          sw.appendChild(box);
          sw.appendChild(el("span", "knob"));
          li.appendChild(sw);
          var body = el("div", "lesson-body");
          body.appendChild(el("p", "lesson-text", l.lesson));
          body.appendChild(el("p", "lesson-meta", (l.active ? "On" : "Off, the agent no longer reads it") + (l.created_by ? " · by " + l.created_by : "") + " · " + new Date(l.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })));
          li.appendChild(body);
          list.appendChild(li);
        });
        var on = res.data.filter(function (l) { return l.active; }).length;
        $("lessonsStatus").textContent = res.data.length ? on + " of " + res.data.length + " lesson" + (res.data.length === 1 ? "" : "s") + " switched on" : "No lessons yet. The agent follows only the posting rules.";
      });
  }
  $("teachForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var text = $("lessonText").value.trim();
    if (!text) return;
    saveLesson(text, null).then(function () { $("lessonText").value = ""; });
  });

  loadBoard();
})();
