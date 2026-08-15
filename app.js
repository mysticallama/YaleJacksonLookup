// JacksonLookup app. Hash routing: "#/" home, "#/person/<slug>" profile.

const app = document.getElementById("app");

const state = {
  policy: new Set(),
  regions: new Set(),
  query: "",
  wildcardSlug: null, // sticky until selection changes or shuffle
};

const AVATAR_COLORS = [
  "#00356b", "#286dc0", "#bd5319", "#5f712d", "#8b2332",
  "#4a5568", "#6b46c1", "#0e7490", "#a16207", "#9d174d",
];

function avatarColor(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

// ---------- Matching ----------

function scoreStudent(s) {
  const policyHits = s.policy.filter((t) => state.policy.has(t));
  const regionHits = s.regions.filter((t) => state.regions.has(t));
  return { student: s, policyHits, regionHits, score: policyHits.length * 2 + regionHits.length };
}

function getMatches() {
  const scored = STUDENTS.map(scoreStudent);
  const top = scored
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || a.student.name.localeCompare(b.student.name));
  const wildcardPool = scored.filter((m) => m.score === 0);
  return { top, wildcardPool };
}

function pickWildcard(pool) {
  if (pool.length === 0) return null;
  const existing = pool.find((m) => m.student.slug === state.wildcardSlug);
  if (existing) return existing;
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  state.wildcardSlug = chosen.student.slug;
  return chosen;
}

// ---------- Rendering ----------

function tagHtml(tag, matched, isRegion) {
  return `<span class="tag${isRegion ? " region" : ""}${matched ? " match" : ""}">${esc(tag)}</span>`;
}

function avatarHtml(s, large) {
  const img = s.photo
    ? `<img src="${esc(s.photo)}" alt="" loading="lazy" onerror="this.remove()">`
    : "";
  return `<div class="avatar${large ? " lg" : ""}" style="background:${avatarColor(s.name)}">${esc(initials(s.name))}${img}</div>`;
}

function cardHtml(match, opts = {}) {
  const s = match.student;
  const shared = match.policyHits.length + match.regionHits.length;
  const matchNote =
    !opts.wildcard && shared > 0
      ? `<div class="match-note">${shared} shared interest${shared === 1 ? "" : "s"}</div>`
      : "";
  return `
    <a class="person-card${opts.wildcard ? " wildcard-card" : ""}" href="#/person/${esc(s.slug)}">
      ${opts.wildcard ? `<span class="wildcard-label">🎲 Someone new</span>` : ""}
      <div class="card-top">
        ${avatarHtml(s, false)}
        <div>
          <div class="person-name">${esc(s.name)}</div>
          <div class="person-program">${esc(s.program)}</div>
        </div>
      </div>
      ${matchNote}
      <div class="tag-row">
        ${s.policy.map((t) => tagHtml(t, match.policyHits.includes(t), false)).join("")}
        ${s.regions.map((t) => tagHtml(t, match.regionHits.includes(t), true)).join("")}
      </div>
    </a>`;
}

function dropdownHtml(id, label, tags, selectedSet) {
  const count = selectedSet.size;
  return `
    <div class="dropdown" id="${id}">
      <button class="dropdown-btn" type="button">
        ${label}
        ${count ? `<span class="count">${count}</span>` : ""}
        <span class="caret">▾</span>
      </button>
      <div class="dropdown-panel">
        <div class="chip-grid">
          ${tags
            .map(
              (t) =>
                `<button type="button" class="chip-toggle${selectedSet.has(t) ? " on" : ""}" data-tag="${esc(t)}">${esc(t)}</button>`
            )
            .join("")}
        </div>
        <button type="button" class="clear-btn">Clear</button>
      </div>
    </div>`;
}

function searchHaystack(s) {
  return [s.name, s.program, s.blurb, ...s.policy, ...s.regions, ...s.specifics]
    .join(" ")
    .toLowerCase();
}

function renderHome() {
  app.innerHTML = `
    <section class="hero">
      <h1>Find Jacksonites with your policy interests</h1>
      <p>Search Jackson MPP students by policy area and region.</p>
    </section>
    <section class="filters">
      ${dropdownHtml("dd-policy", "Policy interests", POLICY_TAGS, state.policy)}
      ${dropdownHtml("dd-regions", "Regions", REGION_TAGS, state.regions)}
      <div class="search-wrap">
        <input id="search" type="search" placeholder="Search names, employers, interests..." value="${esc(state.query)}" autocomplete="off">
      </div>
    </section>
    <div class="browse-all-row"><a class="browse-all" href="#/all">or browse all ${STUDENTS.length} students →</a></div>
    <section class="results" id="results"></section>`;

  wireDropdown("dd-policy", state.policy);
  wireDropdown("dd-regions", state.regions);
  document.getElementById("search").addEventListener("input", (e) => {
    state.query = e.target.value;
    renderResults();
  });
  renderResults();
}

function renderResults() {
  const container = document.getElementById("results");
  const hasTags = state.policy.size > 0 || state.regions.size > 0;
  const q = state.query.trim().toLowerCase();

  if (!hasTags && !q) {
    container.innerHTML = `<div class="empty-note">Pick a policy area or a region, or type in the search bar.</div>`;
    return;
  }

  let scored = STUDENTS.map(scoreStudent);
  if (q) scored = scored.filter((m) => searchHaystack(m.student).includes(q));

  let html;
  if (hasTags) {
    const top = scored
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score || a.student.name.localeCompare(b.student.name));
    const wildcard = q ? null : pickWildcard(scored.filter((m) => m.score === 0));
    html = `
      ${
        top.length
          ? `<div class="results-heading">${top.length} match${top.length === 1 ? "" : "es"}</div>
             <div class="card-grid">${top.map((m) => cardHtml(m)).join("")}</div>`
          : `<div class="empty-note">No matches for that combination.</div>`
      }
      ${
        wildcard
          ? `<div class="wildcard-section">
               <div class="wildcard-row">
                 ${cardHtml(wildcard, { wildcard: true })}
                 <button type="button" class="shuffle-btn" id="shuffle">↻ Surprise me again</button>
               </div>
             </div>`
          : ""
      }`;
  } else {
    html = scored.length
      ? `<div class="results-heading">${scored.length} result${scored.length === 1 ? "" : "s"}</div>
         <div class="card-grid">${scored.map((m) => cardHtml(m)).join("")}</div>`
      : `<div class="empty-note">No one matches that search.</div>`;
  }

  container.innerHTML = html;

  const shuffle = document.getElementById("shuffle");
  if (shuffle) {
    shuffle.addEventListener("click", () => {
      state.wildcardSlug = null;
      renderResults();
      document.querySelector(".wildcard-section")?.scrollIntoView({ block: "center" });
    });
  }
}

function renderAll() {
  const zero = (s) => ({ student: s, policyHits: [], regionHits: [], score: 0 });
  app.innerHTML = `
    <section class="results">
      <a class="back-link" href="#/">← Back to search</a>
      <div class="results-heading">All ${STUDENTS.length} students</div>
      <div class="card-grid">${STUDENTS.map((s) => cardHtml(zero(s))).join("")}</div>
    </section>`;
}

function wireDropdown(id, selectedSet) {
  const dd = document.getElementById(id);
  const btn = dd.querySelector(".dropdown-btn");
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasOpen = dd.classList.contains("open");
    closeAllDropdowns();
    if (!wasOpen) dd.classList.add("open");
  });
  dd.querySelector(".dropdown-panel").addEventListener("click", (e) => e.stopPropagation());
  dd.querySelectorAll(".chip-toggle").forEach((chip) => {
    chip.addEventListener("click", () => {
      const tag = chip.dataset.tag;
      selectedSet.has(tag) ? selectedSet.delete(tag) : selectedSet.add(tag);
      state.wildcardSlug = null;
      rerenderKeepingDropdown(id);
    });
  });
  dd.querySelector(".clear-btn").addEventListener("click", () => {
    selectedSet.clear();
    state.wildcardSlug = null;
    rerenderKeepingDropdown(id);
  });
}

function rerenderKeepingDropdown(id) {
  renderHome();
  document.getElementById(id)?.classList.add("open");
}

function closeAllDropdowns() {
  document.querySelectorAll(".dropdown.open").forEach((d) => d.classList.remove("open"));
}
document.addEventListener("click", closeAllDropdowns);

function renderProfile(slug) {
  const s = STUDENTS.find((x) => x.slug === slug);
  if (!s) {
    app.innerHTML = `<div class="profile"><a class="back-link" href="#/">← Back to search</a><p>Person not found.</p></div>`;
    return;
  }
  app.innerHTML = `
    <div class="profile">
      <a class="back-link" href="#/">← Back to search</a>
      <div class="profile-card">
        <div class="profile-head">
          ${avatarHtml(s, true)}
          <div>
            <h2>${esc(s.name)}</h2>
            <div class="person-program">${esc(s.program)}</div>
          </div>
        </div>
        <p class="profile-blurb">${esc(s.blurb)}</p>
        ${
          s.summer
            ? `<div class="summer-box">
                 <div class="summer-label">☀ What ${esc(s.name.split(" ")[0])} did this summer</div>
                 <div>${esc(s.summer)}</div>
               </div>`
            : ""
        }
        ${
          s.groups
            ? `<div class="groups-box">
                 <div class="groups-label">👥 Clubs and fellowships</div>
                 <div>${esc(s.groups)}</div>
               </div>`
            : ""
        }
        <div class="profile-section-label">Policy interests</div>
        <div class="tag-row">${s.policy.map((t) => tagHtml(t, false, false)).join("") || "none listed"}</div>
        <div class="profile-section-label">Regions</div>
        <div class="tag-row">${s.regions.map((t) => tagHtml(t, false, true)).join("") || "none listed"}</div>
        ${
          s.specifics.length
            ? `<div class="profile-section-label">Key phrases from bio</div>
               <div class="tag-row">${s.specifics.map((t) => tagHtml(t, false, false)).join("")}</div>`
            : ""
        }
        <div class="profile-actions">
          <a class="bio-link" href="https://jackson.yale.edu/person/${esc(s.slug)}/" target="_blank" rel="noopener">Full Jackson Bio ↗</a>
          ${s.email ? `<a class="bio-link contact" href="mailto:${esc(s.email)}">✉ ${esc(s.email)}</a>` : ""}
          ${s.linkedin ? `<a class="bio-link contact" href="${esc(s.linkedin)}" target="_blank" rel="noopener"><svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.55C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.72C24 .77 23.2 0 22.22 0z"/></svg>LinkedIn ↗</a>` : ""}
          ${s.whatsapp ? `<a class="bio-link contact" href="https://wa.me/${esc(s.whatsapp.replace(/\D/g, ""))}" target="_blank" rel="noopener"><svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413"/></svg>WhatsApp ↗</a>` : ""}
        </div>
      </div>
    </div>`;
}

// ---------- Router ----------

function route() {
  const hash = location.hash || "#/";
  const personMatch = hash.match(/^#\/person\/([a-z0-9-]+)/);
  if (personMatch) {
    renderProfile(personMatch[1]);
    window.scrollTo(0, 0);
  } else if (hash.startsWith("#/all")) {
    renderAll();
    window.scrollTo(0, 0);
  } else {
    renderHome();
  }
}

// ---------- Contact form ----------

const contactForm = document.getElementById("contact-form");
if (contactForm) {
  contactForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = document.getElementById("contact-status");
    const btn = document.getElementById("contact-submit");
    const email = document.getElementById("contact-email").value.trim();
    const message = document.getElementById("contact-message").value.trim();
    btn.disabled = true;
    status.textContent = "Sending...";
    try {
      const res = await fetch("https://formsubmit.co/ajax/kevin.chen.kc2593@yale.edu", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          email: email,
          message: message,
          _replyto: email,
          _subject: "JacksonLookup message",
          _captcha: "false",
        }),
      });
      if (!res.ok) throw new Error("send failed");
      status.textContent = "Sent! Thanks for the note.";
      contactForm.reset();
    } catch (err) {
      status.textContent = "Something went wrong. Please email kevin.chen.kc2593@yale.edu directly.";
    }
    btn.disabled = false;
  });
}

window.addEventListener("hashchange", route);
route();
