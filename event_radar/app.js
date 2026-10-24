// Club Event Radar: the website's code.
// Reads published events with supabase-js and sends new posts to the AI agent.
// All text from posts is shown with textContent, never innerHTML.

(function () {
  const config = window.EVENT_RADAR_CONFIG;
  const db = window.supabase.createClient(config.supabaseUrl, config.publishableKey);
  const AGENT_URL = config.supabaseUrl + "/functions/v1/submit-event";

  // Only the columns the website is allowed to read (see the Stage 4 and Stage 7 grants).
  const PUBLIC_COLUMNS =
    "id, created_at, status, title, club, event_date, start_time, end_time, place_name, place_detail, cost, free_food, summary, flyer_url";

  // Flyers are shown only if they come from this project's flyers bucket.
  const FLYER_PREFIX = config.supabaseUrl + "/storage/v1/object/public/flyers/";
  const MAX_FLYER_BYTES = 5 * 1024 * 1024;

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const board = document.getElementById("board");
  const form = document.getElementById("post-form");
  const textarea = document.getElementById("announcement");
  const flyerInput = document.getElementById("flyer");
  const postButton = document.getElementById("post-button");
  const result = document.getElementById("result");
  const refreshButton = document.getElementById("refresh");

  // Small helper: make an element with a class and text.
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // "2026-10-29" -> a local Date (no time-zone shift).
  function parseDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  // "19:00:00" -> "7:00 PM"
  function formatTime(time) {
    if (!time) return "";
    const [h, m] = time.split(":").map(Number);
    const hour = h % 12 === 0 ? 12 : h % 12;
    return hour + ":" + String(m).padStart(2, "0") + (h < 12 ? " AM" : " PM");
  }

  function whenText(event) {
    const parts = [];
    if (event.event_date) {
      const date = parseDate(event.event_date);
      parts.push(WEEKDAYS[date.getDay()] + ", " + MONTHS[date.getMonth()] + " " + date.getDate());
    }
    if (event.start_time) {
      let times = formatTime(event.start_time);
      if (event.end_time) times += " to " + formatTime(event.end_time);
      parts.push(times);
    }
    return parts.join(" · ") || "Date to be announced";
  }

  function eventCard(event) {
    const li = el("li", "event");

    // 1. The date block
    if (event.event_date) {
      const date = parseDate(event.event_date);
      const box = el("div", "date");
      box.append(el("span", "mon", MONTHS[date.getMonth()]), el("span", "day", String(date.getDate())));
      li.append(box);
    } else {
      const box = el("div", "date tba");
      box.append(el("span", "day", "TBA"));
      li.append(box);
    }

    // 2. The event details
    const body = el("div", "event-body");
    body.append(el("p", "when", whenText(event)));
    body.append(el("h3", "", event.title || "Untitled event"));

    const place = [event.place_name, event.place_detail].filter(Boolean).join(", ");
    const meta = [event.club, place].filter(Boolean).join(" · ");
    if (meta) body.append(el("p", "meta", meta));
    if (event.summary) body.append(el("p", "summary", event.summary));

    const tags = el("p", "tags");
    if (event.cost) tags.append(el("span", "tag", event.cost));
    if (event.free_food) tags.append(el("span", "tag food", "🍕 Free food"));
    if (tags.childElementCount > 0) body.append(tags);

    li.append(body);

    // 3. The flyer photo (Stage 7)
    if (event.flyer_url && event.flyer_url.startsWith(FLYER_PREFIX)) {
      const img = el("img", "flyer");
      img.src = event.flyer_url;
      img.alt = "Flyer for " + (event.title || "this event");
      img.loading = "lazy";
      li.append(img);
    }

    return li;
  }

  function showBoardMessage(text) {
    board.replaceChildren(el("li", "empty", text));
  }

  async function loadEvents() {
    refreshButton.disabled = true;
    const { data, error } = await db
      .from("events")
      .select(PUBLIC_COLUMNS)
      .eq("status", "published")
      .order("event_date", { ascending: true, nullsFirst: false })
      .order("start_time", { ascending: true, nullsFirst: false });
    refreshButton.disabled = false;

    if (error) {
      console.error(error);
      showBoardMessage("Couldn’t load events right now. Please try Refresh.");
      return;
    }
    if (!data || data.length === 0) {
      showBoardMessage("No events yet. Post the first one!");
      return;
    }
    board.replaceChildren(...data.map(eventCard));
  }

  const LABELS = {
    published: "Published",
    waiting: "Waiting for a moderator",
    rejected: "Not posted",
    duplicate: "Already posted",
    error: "Something went wrong",
  };

  function showResult(kind, message, reasons) {
    result.className = "result " + kind;
    result.replaceChildren(el("p", "result-label", LABELS[kind] || LABELS.error), el("p", "", message));
    if (reasons && reasons.length > 0) {
      const list = el("ul", "reasons");
      reasons.forEach(function (reason) { list.append(el("li", "", reason)); });
      result.append(list);
    }
    result.hidden = false;
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const text = textarea.value.trim();
    if (!text) {
      showResult("error", "Please paste an announcement first.");
      return;
    }
    const flyer = flyerInput.files[0];
    if (flyer && !["image/jpeg", "image/png"].includes(flyer.type)) {
      showResult("error", "The photo must be a JPG or PNG.");
      return;
    }
    if (flyer && flyer.size > MAX_FLYER_BYTES) {
      showResult("error", "The photo is too big. Please use a JPG or PNG under 5 MB.");
      return;
    }

    postButton.disabled = true;
    postButton.textContent = "The agent is reading your post…";
    result.hidden = true;

    try {
      const body = new FormData();
      body.append("announcement", text);
      if (flyer) body.append("flyer", flyer);
      // The publishable key goes on the apikey header only (no Authorization header).
      const response = await fetch(AGENT_URL, {
        method: "POST",
        headers: { apikey: config.publishableKey },
        body: body,
      });
      const answer = await response.json();

      if (!answer.ok) {
        showResult("error", answer.message || "The agent couldn’t handle that post.");
      } else {
        showResult(answer.status, answer.message, answer.reasons);
        if (answer.status === "published" || answer.status === "waiting") {
          textarea.value = "";
          flyerInput.value = "";
        }
        if (answer.status === "published") loadEvents();
      }
    } catch (err) {
      console.error(err);
      showResult("error", "Couldn’t reach the agent. Check your internet connection and try again.");
    } finally {
      postButton.disabled = false;
      postButton.textContent = "Send to the agent";
    }
  });

  refreshButton.addEventListener("click", loadEvents);

  loadEvents();
})();
