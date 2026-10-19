// Club Event Radar: the website's code.
// It reads published events with the publishable key and sends new posts to the AI agent.
// All text from posts is shown with textContent, never innerHTML.

(function () {
  const config = window.EVENT_RADAR_CONFIG || {};
  const AGENT_URL = config.supabaseUrl + "/functions/v1/submit-event";
  // Only the columns the website is allowed to read (see the Stage 4 grants).
  const PUBLIC_COLUMNS =
    "id, created_at, status, title, club, event_date, start_time, end_time, place_name, place_detail, cost, free_food, summary";

  const eventsList = document.getElementById("events");
  const eventsStatus = document.getElementById("events-status");
  const form = document.getElementById("post-form");
  const textarea = document.getElementById("announcement");
  const charCount = document.getElementById("char-count");
  const submitButton = document.getElementById("submit-button");
  const result = document.getElementById("result");
  const resultTitle = document.getElementById("result-title");
  const resultMessage = document.getElementById("result-message");
  const resultReasons = document.getElementById("result-reasons");

  if (!config.supabaseUrl || !config.publishableKey || !window.supabase) {
    eventsStatus.textContent = "The website isn't set up yet: check config.js and your internet connection.";
    submitButton.disabled = true;
    return;
  }

  const db = window.supabase.createClient(config.supabaseUrl, config.publishableKey, {
    auth: { persistSession: false },
  });

  // ---------- Showing events ----------

  // Today's date in Pacific time, as YYYY-MM-DD.
  function pacificToday() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
  }

  function formatDate(value) {
    if (!value) return "";
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric",
    });
  }

  function formatTime(value) {
    if (!value) return "";
    const [hours, minutes] = value.split(":").map(Number);
    const suffix = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    return hour12 + ":" + String(minutes).padStart(2, "0") + " " + suffix;
  }

  function addText(parent, tag, className, text) {
    if (!text) return null;
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    parent.appendChild(element);
    return element;
  }

  function eventCard(event) {
    const card = document.createElement("li");
    card.className = "event-card";

    addText(card, "h3", "", event.title || "Untitled event");
    addText(card, "p", "club", event.club);

    let when = formatDate(event.event_date);
    if (event.start_time) when += ", " + formatTime(event.start_time);
    if (event.end_time) when += " to " + formatTime(event.end_time);
    addText(card, "p", "when", when);

    const where = [event.place_name, event.place_detail].filter(Boolean).join(", ");
    addText(card, "p", "where", where);

    addText(card, "p", "summary", event.summary);

    const tags = document.createElement("div");
    tags.className = "tags";
    addText(tags, "span", "tag", event.cost);
    if (event.free_food) addText(tags, "span", "tag", "Free food");
    if (tags.children.length > 0) card.appendChild(tags);

    return card;
  }

  async function loadEvents() {
    const { data, error } = await db
      .from("events")
      .select(PUBLIC_COLUMNS)
      .eq("status", "published")
      .gte("event_date", pacificToday())
      .order("event_date", { ascending: true })
      .order("start_time", { ascending: true });

    eventsList.replaceChildren();
    if (error) {
      console.error(error);
      eventsStatus.textContent = "The events couldn't be loaded right now. Please refresh the page.";
      return;
    }
    if (data.length === 0) {
      eventsStatus.textContent = "No upcoming events yet. Be the first to post one below.";
      return;
    }
    eventsStatus.textContent = data.length === 1 ? "1 upcoming event" : data.length + " upcoming events";
    data.forEach((event) => eventsList.appendChild(eventCard(event)));
  }

  // ---------- Sending a post to the agent ----------

  const ANSWERS = {
    published: { title: "Published", tone: "good" },
    waiting: { title: "Waiting for a moderator", tone: "wait" },
    rejected: { title: "Not posted", tone: "bad" },
    duplicate: { title: "Already posted", tone: "wait" },
  };

  function showResult(title, tone, message, reasons) {
    result.hidden = false;
    result.className = "result " + tone;
    resultTitle.textContent = title;
    resultMessage.textContent = message || "";
    resultReasons.replaceChildren();
    (reasons || []).forEach((reason) => addText(resultReasons, "li", "", reason));
  }

  textarea.addEventListener("input", () => {
    charCount.textContent = textarea.value.length + " / 2000";
  });

  form.addEventListener("submit", async (submitEvent) => {
    submitEvent.preventDefault();
    const announcement = textarea.value.trim();
    if (!announcement) {
      showResult("Nothing to send", "bad", "Please paste an announcement first.", []);
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "The agent is reading your post…";
    result.hidden = true;

    try {
      const body = new FormData();
      body.append("announcement", announcement);
      const response = await fetch(AGENT_URL, {
        method: "POST",
        headers: { apikey: config.publishableKey },
        body,
      });
      const answer = await response.json();

      if (!answer.ok) {
        showResult("Something went wrong", "bad", answer.message || "Please try again.", []);
      } else {
        const shown = ANSWERS[answer.status] || { title: answer.status, tone: "wait" };
        const reasons = answer.status === "published" ? [] : answer.reasons;
        showResult(shown.title, shown.tone, answer.message, reasons);
        if (answer.status === "published") {
          textarea.value = "";
          charCount.textContent = "0 / 2000";
          loadEvents();
        }
      }
    } catch (error) {
      console.error(error);
      showResult("Something went wrong", "bad", "The agent couldn't be reached. Check your internet connection and try again.", []);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Send to the agent";
    }
  });

  loadEvents();
})();
