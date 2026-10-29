import { db } from "./firebase.js";
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import * as AX from "./ax.js";

const { $, esc, I, avatar, pageView, empty } = AX;

const dateOf = (v) => {
  const d = v?.toDate ? v.toDate() : v?.seconds != null ? new Date(v.seconds * 1000) : v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};
const dateText = (v) => dateOf(v)?.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) || "—";
const csvCell = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';

const downloadCsv = (rows) => {
  const fields = ["name", "email", "role", "city", "source", "createdAt"];
  const content = [
    fields.join(","),
    ...rows.map((row) => fields.map((key) => csvCell(key === "createdAt" ? dateText(row[key]) : row[key])).join(","))
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "faxton-website-waitlist.csv";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const roleLabel = (role) => ({
  renter: "Renter",
  owner: "Property owner",
  agency: "Agency",
  agent: "Agent",
}[role] || role || "—");

const roleCountLabel = (count) => `${count} signup type${count === 1 ? "" : "s"}`;

export function page(ctx) {
  return pageView(ctx, {
    title: "Website waitlist",
    eyebrow: "Growth",
    sub: "People who joined the waitlist from the Faxton Rentals website.",
    what: "the website waitlist",
    cols: [["waitlist", async () => {
      const snap = await getDocs(query(collection(db, "waitlist"), orderBy("createdAt", "desc")));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }]],
    render: ({ waitlist }) => {
      const rows = Array.isArray(waitlist) ? waitlist : [];
      const cities = [...new Set(rows.map((row) => String(row.city || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
      const roles = [...new Set(rows.map((row) => String(row.role || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
      const roleOptions = roles.map((role) => `<option value="${esc(role)}">${esc(roleLabel(role))}</option>`).join("");
      const cityOptions = cities.map((city) => `<option value="${esc(city)}">${esc(city)}</option>`).join("");

      const table = rows.length ? `
        <div class="ax-wl-table-scroll">
          <table class="ax-table ax-wl-table">
            <thead>
              <tr><th scope="col">Person</th><th scope="col">Signup type</th><th scope="col">City</th><th scope="col">Date joined</th></tr>
            </thead>
            <tbody id="waitlistRows">${rows.map((row) => {
              const name = String(row.name || "Unnamed visitor");
              const email = String(row.email || "—");
              const role = String(row.role || "");
              const city = String(row.city || "—");
              return `<tr data-search="${esc([name, email, roleLabel(role), city].join(" ").toLowerCase())}" data-role="${esc(role)}" data-city="${esc(row.city || "")}">
                <td class="ax-wl-person" data-label="Person">${avatar(name, row.id, 38)}<span class="ax-wl-person-copy"><strong>${esc(name)}</strong><small>${esc(email)}</small></span></td>
                <td data-label="Signup type"><span class="ax-wl-role" data-role="${esc(role)}">${esc(roleLabel(role))}</span></td>
                <td data-label="City"><span class="ax-wl-city">${I("mapPin", 15)}<span>${esc(city)}</span></span></td>
                <td data-label="Date joined"><span class="ax-wl-date">${esc(dateText(row.createdAt))}</span></td>
              </tr>`;
            }).join("")}</tbody>
          </table>
        </div>
        <div class="ax-wl-no-results" id="wlNoResults" hidden>
          <span class="ax-wl-no-results-icon">${I("search", 20)}</span>
          <strong>No signups match those filters</strong>
          <p>Try a different name, email, signup type, or city.</p>
          <button class="ax-btn" data-v="outline" type="button" id="wlClearEmpty">${I("undo", 16)}<span>Clear filters</span></button>
        </div>`
        : empty({ icon: "users", title: "No website signups yet", hint: "New registrations from the public website will appear here once visitors join the waitlist." });

      return {
        html: `
          <div class="ax-wl">
            <section class="ax-wl-overview" aria-labelledby="wlOverviewTitle">
              <div class="ax-wl-overview-head">
                <div>
                  <span class="ax-wl-eyebrow">WAITLIST SNAPSHOT</span>
                  <h2 id="wlOverviewTitle">At a glance</h2>
                  <p>A quick look at the people interested in Faxton Rentals.</p>
                </div>
                <span class="ax-wl-source">${I("checkc", 15)} Website registrations</span>
              </div>
              <div class="ax-wl-stats">
                <article class="ax-card ax-wl-stat">
                  <span class="ax-wl-stat-icon" data-tone="green">${I("users", 20)}</span>
                  <div class="ax-wl-stat-copy"><span>Total signups</span><strong>${rows.length.toLocaleString("en-NG")}</strong><small>All website registrations</small></div>
                </article>
                <article class="ax-card ax-wl-stat">
                  <span class="ax-wl-stat-icon" data-tone="blue">${I("mapPin", 20)}</span>
                  <div class="ax-wl-stat-copy"><span>Cities represented</span><strong>${cities.length.toLocaleString("en-NG")}</strong><small>Distinct locations</small></div>
                </article>
                <article class="ax-card ax-wl-stat">
                  <span class="ax-wl-stat-icon" data-tone="gold">${I("filter", 20)}</span>
                  <div class="ax-wl-stat-copy"><span>Signup types</span><strong>${roles.length.toLocaleString("en-NG")}</strong><small>${esc(roleCountLabel(roles.length))}</small></div>
                </article>
              </div>
            </section>

            <section class="ax-card ax-wl-panel" aria-labelledby="wlListTitle">
              <div class="ax-wl-panel-head">
                <div class="ax-wl-panel-heading">
                  <h2 id="wlListTitle">All website signups</h2>
                  <p>Search, filter, and export your waitlist records.</p>
                </div>
                <span class="ax-wl-count" id="wlCount" aria-live="polite"><strong>${rows.length.toLocaleString("en-NG")}</strong><span>${rows.length === 1 ? "signup" : "signups"}</span></span>
              </div>

              <div class="ax-wl-toolbar">
                <label class="ax-wl-search">
                  <span class="ax-wl-sr-only">Search signups</span>
                  ${I("search", 17)}
                  <input id="wlSearch" class="ax-input" type="search" placeholder="Search name or email" autocomplete="off" aria-label="Search by name, email, signup type or city">
                </label>
                <label class="ax-wl-filter"><span>Signup type</span><select id="wlRole" class="ax-input" aria-label="Filter by signup type"><option value="">All types</option>${roleOptions}</select></label>
                <label class="ax-wl-filter"><span>City</span><select id="wlCity" class="ax-input" aria-label="Filter by city"><option value="">All cities</option>${cityOptions}</select></label>
                <div class="ax-wl-actions">
                  <button class="ax-btn" data-v="ghost" type="button" id="wlReset" disabled>${I("undo", 16)}<span>Clear</span></button>
                  <button class="ax-btn" data-v="primary" type="button" id="wlExport" ${rows.length ? "" : "disabled"}>${I("download", 16)}<span>Export CSV</span></button>
                </div>
              </div>

              <div class="ax-wl-records">
                ${table}
              </div>
              <div class="ax-wl-panel-foot"><span><b id="wlVisibleCount">${rows.length.toLocaleString("en-NG")}</b> of ${rows.length.toLocaleString("en-NG")} records shown</span><span>Newest registrations first</span></div>
            </section>
          </div>`,
        mount(root) {
          const search = $("#wlSearch", root);
          const role = $("#wlRole", root);
          const city = $("#wlCity", root);
          const count = $("#wlCount", root);
          const visibleCount = $("#wlVisibleCount", root);
          const reset = $("#wlReset", root);
          const noResults = $("#wlNoResults", root);
          const allRows = () => $("#waitlistRows", root)?.querySelectorAll("tr") || [];
          const clearFilters = () => {
            search.value = "";
            role.value = "";
            city.value = "";
            filter();
            search.focus();
          };
          const filter = () => {
            const q = search.value.trim().toLowerCase();
            let visible = 0;
            allRows().forEach((tr) => {
              const matches = (!q || tr.dataset.search.includes(q))
                && (!role.value || tr.dataset.role === role.value)
                && (!city.value || tr.dataset.city === city.value);
              tr.hidden = !matches;
              if (matches) visible++;
            });

            const hasFilters = Boolean(q || role.value || city.value);
            reset.disabled = !hasFilters;
            visibleCount.textContent = visible.toLocaleString("en-NG");
            count.innerHTML = `<strong>${visible.toLocaleString("en-NG")}</strong><span>${visible === 1 ? "signup" : "signups"}${hasFilters ? ` <em>of ${rows.length.toLocaleString("en-NG")}</em>` : ""}</span>`;
            if (noResults) noResults.hidden = !(rows.length > 0 && visible === 0);
            const tableScroll = $(".ax-wl-table-scroll", root);
            if (tableScroll) tableScroll.hidden = visible === 0;
          };

          search.addEventListener("input", filter);
          role.addEventListener("change", filter);
          city.addEventListener("change", filter);
          reset.addEventListener("click", clearFilters);
          $("#wlClearEmpty", root)?.addEventListener("click", clearFilters);
          $("#wlExport", root).addEventListener("click", () => downloadCsv(rows));
        }
      };
    }
  });
}
