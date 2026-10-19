// Club Event Radar: the website's code.
// It reads published events with the publishable key and sends new posts to the AI agent.
// A signed-in moderator can also see waiting posts and approve or reject them.
// All text from posts is shown with textContent, never innerHTML.

(function () {
  const config = window.EVENT_RADAR_CONFIG || {};
  const AGENT_URL = config.supabaseUrl + "/functions/v1/submit-event";
  // Only the columns the website is allowed to read (see the Stage 4 grants).
  const PUBLIC_COLUMNS =
    "id, created_at, status, title, club, event_date, start_time, end_time, place_name, place_detail, cost, free_food, summary, flyer_url";
  // Flyer photos are shown only when they come from this project's flyers bucket.
  const FLYER_PREFIX = config.supabaseUrl + "/storage/v1/object/public/flyers/";
  const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
  const PHOTO_TYPES = ["image/jpeg", "image/png"];

  const eventsList = document.getElementById("events");
  const eventsStatus = document.getElementById("events-status");
  const form = document.getElementById("post-form");
  const textarea = document.getElementById("announcement");
  const flyerInput = document.getElementById("flyer");
  const charCount = document.getElementById("char-count");
  const submitButton = document.getElementById("submit-button");
  const result = document.getElementById("result");
  const resultTitle = document.getElementById("result-title");
  const resultMessage = document.getElementById("result-message");
  const resultReasons = document.getElementById("result-reasons");
  const signInForm = document.getElementById("sign-in-form");
  const emailInput = document.getElementById("mod-email");
  const passwordInput = document.getElementById("mod-password");
  const signInButton = document.getElementById("sign-in-button");
  const signInMessage = document.getElementById("sign-in-message");
  const modArea = document.getElementById("mod-area");
  const modWho = document.getElementById("mod-who");
  const signOutButton = document.getElementById("sign-out-button");
  const waitingList = document.getElementById("waiting");
  const waitingStatus = document.getElementById("waiting-status");

  if (!config.supabaseUrl || !config.publishableKey || !window.supabase) {
    eventsStatus.textContent = "The website isn't set up yet: check config.js and your internet connection.";
    submitButton.disabled = true;
    signInButton.disabled = true;
    return;
  }

  // The moderator's sign-in is remembered in this browser until they sign out.
  const db = window.supabase.createClient(config.supabaseUrl, config.publishableKey);

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

    if (typeof event.flyer_url === "string" && event.flyer_url.startsWith(FLYER_PREFIX)) {
      const link = document.createElement("a");
      link.className = "flyer";
      link.href = event.flyer_url;
      link.target = "_blank";
      link.rel = "noopener";
      const image = document.createElement("img");
      image.src = event.flyer_url;
      image.alt = "Flyer for " + (event.title || "this event");
      image.loading = "lazy";
      link.appendChild(image);
      card.appendChild(link);
    }

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
    const flyer = flyerInput.files[0];
    if (flyer && !PHOTO_TYPES.includes(flyer.type)) {
      showResult("Photo not sent", "bad", "The photo must be a JPG or PNG.", []);
      return;
    }
    if (flyer && flyer.size > MAX_PHOTO_BYTES) {
      showResult("Photo not sent", "bad", "The photo is too big. Please use one under 5 MB.", []);
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "The agent is reading your post…";
    result.hidden = true;

    try {
      const body = new FormData();
      body.append("announcement", announcement);
      if (flyer) body.append("flyer", flyer);
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
        if (answer.status === "published" || answer.status === "waiting") {
          textarea.value = "";
          flyerInput.value = "";
          charCount.textContent = "0 / 2000";
        }
        if (answer.status === "published") loadEvents();
      }
    } catch (error) {
      console.error(error);
      showResult("Something went wrong", "bad", "The agent couldn't be reached. Check your internet connection and try again.", []);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Send to the agent";
    }
  });

  // ---------- Moderator sign-in ----------

  let moderatorEmail = "";

  function waitingCard(post) {
    const card = eventCard(post);
    card.classList.add("waiting-card");

    const details = document.createElement("div");
    details.className = "review-details";
    addText(details, "p", "label", "Why it's waiting");
    addText(details, "p", "", post.status_reason || "No reason was given.");
    if (post.note_for_moderator) {
      addText(details, "p", "label", "Note for the moderator");
      addText(details, "p", "", post.note_for_moderator);
    }
    addText(details, "p", "label", "Original post");
    addText(details, "blockquote", "original", post.announcement);
    card.appendChild(details);

    const buttons = document.createElement("div");
    buttons.className = "review-buttons";
    const approve = document.createElement("button");
    approve.type = "button";
    approve.textContent = "Approve";
    const reject = document.createElement("button");
    reject.type = "button";
    reject.className = "danger";
    reject.textContent = "Reject";
    approve.addEventListener("click", () => review(post, "published", [approve, reject]));
    reject.addEventListener("click", () => review(post, "rejected", [approve, reject]));
    buttons.append(approve, reject);
    card.appendChild(buttons);

    return card;
  }

  async function loadWaiting() {
    const { data, error } = await db
      .from("events")
      .select("*")
      .eq("status", "waiting")
      .order("created_at", { ascending: true });

    waitingList.replaceChildren();
    if (error) {
      console.error(error);
      waitingStatus.textContent = "The waiting posts couldn't be loaded. Please refresh the page.";
      return;
    }
    if (data.length === 0) {
      waitingStatus.textContent = "No posts are waiting. Nice work.";
      return;
    }
    waitingStatus.textContent = data.length === 1 ? "1 post is waiting." : data.length + " posts are waiting.";
    data.forEach((post) => waitingList.appendChild(waitingCard(post)));
  }

  async function review(post, newStatus, buttons) {
    buttons.forEach((button) => { button.disabled = true; });
    const { data, error } = await db
      .from("events")
      .update({ status: newStatus, reviewed_at: new Date().toISOString(), reviewed_by: moderatorEmail })
      .eq("id", post.id)
      .select("id");

    if (error || data.length === 0) {
      console.error(error);
      waitingStatus.textContent = "That change couldn't be saved. Please sign in again and retry.";
      buttons.forEach((button) => { button.disabled = false; });
      return;
    }
    loadWaiting();
    loadEvents();
  }

  function showModerator(session) {
    const signedIn = Boolean(session);
    moderatorEmail = signedIn ? session.user.email || "" : "";
    signInForm.hidden = signedIn;
    modArea.hidden = !signedIn;
    if (signedIn) {
      modWho.textContent = "Signed in as " + moderatorEmail;
      loadWaiting();
    } else {
      waitingList.replaceChildren();
      waitingStatus.textContent = "";
    }
  }

  // Runs on page load and whenever someone signs in or out.
  // The work is deferred so it doesn't run inside the sign-in library's own callback.
  db.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => showModerator(session), 0);
  });

  signInForm.addEventListener("submit", async (submitEvent) => {
    submitEvent.preventDefault();
    signInButton.disabled = true;
    signInMessage.textContent = "Signing in…";
    const { error } = await db.auth.signInWithPassword({
      email: emailInput.value.trim(),
      password: passwordInput.value,
    });
    passwordInput.value = "";
    signInButton.disabled = false;
    signInMessage.textContent = error ? "That email and password didn't work." : "";
  });

  signOutButton.addEventListener("click", async () => {
    await db.auth.signOut();
  });

  loadEvents();
})();
