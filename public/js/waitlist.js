import { db } from "./firebase.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import * as AX from "./ax.js";

const { $, esc, I, avatar, pageView, copy } = AX;

const dateOf = (value) => {
  const d = value?.toDate ? value.toDate() : value?.seconds != null ? new Date(value.seconds * 1000) : value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};
const dateText = (value) => dateOf(value)?.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) || "—";
const timeOf = (value) => dateOf(value)?.getTime() || 0;
const csvCell = (value) => '"' + String(value ?? "").replace(/"/g, '""') + '"';

function downloadCsv(rows) {
  const fields = ["name", "email", "role", "city", "source", "createdAt"];
  const content = [
    fields.join(","),
    ...rows.map((row) => fields.map((key) => csvCell(key === "createdAt" ? dateText(row[key]) : row[key])).join(","))
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "faxton-waitlist-" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const roleLabels = {
  renter: "Renter",
  owner: "Property owner",
  agency: "Agency",
  agent: "Agent"
};
const roleLabel = (role) => roleLabels[role] || (role ? role.charAt(0).toUpperCase() + role.slice(1) : "Not specified");
const titleCase = (value) => String(value || "").replace(/[_-]+/g, " ").replace(/\b\w/g, (s) => s.toUpperCase());

export function page(ctx) {
  return pageView(ctx, {
    title: "Website waitlist",
    eyebrow: "Insights",
    sub: "Track, search and export people who signed up through the Faxton Rentals website.",
    what: "the website waitlist",
    cols: [["waitlist", async () => {
      // Sort in the browser so older entries without createdAt are not silently excluded by Firestore orderBy().
      const snap = await getDocs(collection(db, "waitlist"));
      return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt));
    }]],
    render: ({ waitlist }) => {
      const rows = (Array.isArray(waitlist) ? waitlist : []).slice().sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt));
      const cities = [...new Set(rows.map((row) => String(row.city || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
      const roles = [...new Set(rows.map((row) => String(row.role || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
      const total = rows.length;
      const renters = rows.filter((row) => row.role === "renter").length;
      const owners = rows.filter((row) => row.role === "owner").length;
      const partners = rows.filter((row) => row.role === "agency" || row.role === "agent").length;
      const since = (days) => rows.filter((row) => {
        const t = timeOf(row.createdAt);
        return t > 0 && t >= Date.now() - days * 86400000;
      }).length;

      const stats = [
        ["users", "green", "Total signups", total, "All website registrations"],
        ["user", "blue", "Renters", renters, total ? Math.round(renters / total * 100) + "% of signups" : "No registrations yet"],
        ["home", "violet", "Property owners", owners, total ? Math.round(owners / total * 100) + "% of signups" : "No registrations yet"],
        ["building", "gold", "Agents & agencies", partners, total ? Math.round(partners / total * 100) + "% of signups" : "No registrations yet"],
        ["mapPin", "teal", "Cities represented", cities.length, "Distinct locations"]
      ];
      const statHtml = stats.map((item) => '<article class="ax-card ax-wl-stat"><span class="ax-wl-stat-icon" data-tone="' + item[1] + '">' + I(item[0], 20) + '</span><div class="ax-wl-stat-copy"><span>' + esc(item[2]) + '</span><strong>' + Number(item[3]).toLocaleString("en-NG") + '</strong><small>' + esc(item[4]) + '</small></div></article>').join("");
      const roleOptions = roles.map((role) => '<option value="' + esc(role) + '">' + esc(roleLabel(role)) + '</option>').join("");
      const cityOptions = cities.map((city) => '<option value="' + esc(city) + '">' + esc(city) + '</option>').join("");

      return {
        html: '<div class="ax-wl">' +
          '<section class="ax-wl-overview" aria-labelledby="wlOverviewTitle">' +
            '<div class="ax-wl-overview-head"><div><span class="ax-wl-eyebrow">WAITLIST OVERVIEW</span><h2 id="wlOverviewTitle">Your early-interest community</h2><p>See who is interested in Faxton Rentals and where they are joining from.</p></div>' +
            '<span class="ax-wl-source">' + I("checkc", 15) + ' Website registrations</span></div>' +
            '<div class="ax-wl-stats">' + statHtml + '</div>' +
            '<div class="ax-wl-activity" aria-label="Recent signup activity"><span class="ax-wl-activity-icon">' + I("calendar", 17) + '</span><span><b>' + since(7).toLocaleString("en-NG") + ' new signups in the last 7 days</b><small>Based on each record’s join date.</small></span></div>' +
          '</section>' +
          '<section class="ax-card ax-wl-panel" aria-labelledby="wlListTitle">' +
            '<div class="ax-wl-panel-head"><div class="ax-wl-panel-heading"><h2 id="wlListTitle">All website signups</h2><p>Search, filter, open an email, or export the matching records.</p></div>' +
              '<span class="ax-wl-count" id="wlCount" aria-live="polite"><strong>' + total.toLocaleString("en-NG") + '</strong><span>' + (total === 1 ? "person" : "people") + '</span></span></div>' +
            '<div class="ax-wl-toolbar">' +
              '<label class="ax-wl-search"><span class="ax-wl-sr-only">Search signups</span>' + I("search", 17) + '<input id="wlSearch" class="ax-input" type="search" placeholder="Search name, email or city" autocomplete="off" aria-label="Search name, email or city"></label>' +
              '<label class="ax-wl-filter"><span>Signup type</span><select id="wlRole" class="ax-input" aria-label="Filter by signup type"><option value="">All types</option>' + roleOptions + '</select></label>' +
              '<label class="ax-wl-filter"><span>City</span><select id="wlCity" class="ax-input" aria-label="Filter by city"><option value="">All cities</option>' + cityOptions + '</select></label>' +
              '<label class="ax-wl-filter"><span>Joined</span><select id="wlPeriod" class="ax-input" aria-label="Filter by join date"><option value="all">Any time</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select></label>' +
              '<div class="ax-wl-actions"><button class="ax-btn" data-v="ghost" type="button" id="wlReset" disabled>' + I("undo", 16) + '<span>Clear</span></button><button class="ax-btn" data-v="primary" type="button" id="wlExport" ' + (total ? "" : "disabled") + '>' + I("download", 16) + '<span>Export filtered CSV</span></button></div>' +
            '</div>' +
            '<div class="ax-wl-records">' +
              '<div class="ax-wl-table-scroll"><table class="ax-table ax-wl-table"><thead><tr><th scope="col">Person</th><th scope="col">Signup type</th><th scope="col">City</th><th scope="col">Source</th><th scope="col">Date joined</th><th scope="col"><span class="ax-wl-sr-only">Actions</span></th></tr></thead><tbody id="wlRows"></tbody></table></div>' +
              '<div class="ax-wl-no-results" id="wlEmpty" hidden><span class="ax-wl-no-results-icon">' + I("search", 20) + '</span><strong id="wlEmptyTitle">No signups found</strong><p id="wlEmptyHint">Try adjusting the filters or clear them to see all records.</p><button class="ax-btn" data-v="outline" type="button" id="wlClearEmpty">' + I("undo", 16) + '<span>Clear filters</span></button></div>' +
            '</div>' +
            '<div class="ax-wl-panel-foot"><span id="wlVisibleCount" aria-live="polite">Showing 0 records</span><div class="ax-wl-pagination"><label for="wlPageSize">Rows</label><select id="wlPageSize" class="ax-input" aria-label="Rows per page"><option value="10">10</option><option value="25">25</option><option value="50">50</option></select><button class="ax-btn" data-v="outline" data-size="sm" type="button" id="wlPrev" aria-label="Previous page">' + I("chev", 15) + '</button><span id="wlPageState" aria-live="polite">1 / 1</span><button class="ax-btn" data-v="outline" data-size="sm" type="button" id="wlNext" aria-label="Next page">' + I("chev", 15) + '</button></div></div>' +
          '</section>' +
        '</div>',
        mount(root) {
          const search = $("#wlSearch", root);
          const role = $("#wlRole", root);
          const city = $("#wlCity", root);
          const period = $("#wlPeriod", root);
          const reset = $("#wlReset", root);
          const exportButton = $("#wlExport", root);
          const body = $("#wlRows", root);
          const tableScroll = $(".ax-wl-table-scroll", root);
          const emptyState = $("#wlEmpty", root);
          const emptyTitle = $("#wlEmptyTitle", root);
          const emptyHint = $("#wlEmptyHint", root);
          const visibleCount = $("#wlVisibleCount", root);
          const pageSizeSelect = $("#wlPageSize", root);
          const prev = $("#wlPrev", root);
          const next = $("#wlNext", root);
          const pageState = $("#wlPageState", root);
          let pageNumber = 1;

          const currentMatches = () => {
            const q = search.value.trim().toLowerCase();
            const selectedRole = role.value;
            const selectedCity = city.value;
            const days = period.value === "all" ? 0 : Number(period.value);
            const cutoff = days ? Date.now() - days * 86400000 : 0;
            return rows.filter((row) => {
              const searchText = [row.name, row.email, roleLabel(row.role), row.city, row.source].join(" ").toLowerCase();
              const joined = timeOf(row.createdAt);
              return (!q || searchText.includes(q))
                && (!selectedRole || String(row.role || "") === selectedRole)
                && (!selectedCity || String(row.city || "") === selectedCity)
                && (!cutoff || (joined > 0 && joined >= cutoff));
            });
          };

          const renderRows = () => {
            const filtered = currentMatches();
            const pageSize = Number(pageSizeSelect.value) || 10;
            const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
            pageNumber = Math.min(Math.max(1, pageNumber), pageCount);
            const start = (pageNumber - 1) * pageSize;
            const shown = filtered.slice(start, start + pageSize);

            body.innerHTML = shown.map((row) => {
              const name = String(row.name || "Unnamed visitor");
              const email = String(row.email || "");
              const roleName = String(row.role || "");
              const cityName = String(row.city || "—");
              const source = row.source ? titleCase(row.source) : "—";
              const emailAction = email
                ? '<button class="ax-ib ax-wl-row-action" type="button" data-wl-copy="' + esc(email) + '" aria-label="Copy email address for ' + esc(name) + '" title="Copy email address">' + I("copy", 16) + '</button>'
                : '<button class="ax-ib ax-wl-row-action" type="button" disabled aria-label="No email address available">' + I("copy", 16) + '</button>';
              return '<tr>' +
                '<td class="ax-wl-person" data-label="Person">' + avatar(name, row.id, 38) + '<span class="ax-wl-person-copy"><strong>' + esc(name) + '</strong><small>' + esc(email || "No email provided") + '</small></span></td>' +
                '<td data-label="Signup type"><span class="ax-wl-role" data-role="' + esc(roleName) + '">' + esc(roleLabel(roleName)) + '</span></td>' +
                '<td data-label="City"><span class="ax-wl-city">' + I("mapPin", 15) + '<span>' + esc(cityName) + '</span></span></td>' +
                '<td data-label="Source"><span class="ax-wl-source-tag">' + esc(source) + '</span></td>' +
                '<td data-label="Date joined"><span class="ax-wl-date">' + esc(dateText(row.createdAt)) + '</span></td>' +
                '<td class="ax-wl-actions-cell" data-label="Actions"><div class="ax-wl-row-actions">' + (email ? '<a class="ax-ib ax-wl-row-action" href="mailto:' + esc(email) + '" aria-label="Email ' + esc(name) + '" title="Email signup">' + I("mail", 16) + '</a>' : '') + emailAction + '</div></td>' +
              '</tr>';
            }).join("");

            const hasFilters = Boolean(search.value.trim() || role.value || city.value || period.value !== "all");
            tableScroll.hidden = shown.length === 0;
            emptyState.hidden = shown.length !== 0;
            emptyTitle.textContent = total === 0 ? "No website signups yet" : "No signups match those filters";
            emptyHint.textContent = total === 0
              ? "When someone joins the Faxton Rentals website waitlist, their details will appear here."
              : "Try a different name, email, city, date range or signup type.";
            $("#wlClearEmpty", root).hidden = total === 0 || !hasFilters;
            reset.disabled = !hasFilters;
            exportButton.disabled = filtered.length === 0;
            $("#wlCount", root).innerHTML = "<strong>" + filtered.length.toLocaleString("en-NG") + "</strong><span>" + (filtered.length === 1 ? "matching person" : "matching people") + "</span>";
            visibleCount.textContent = filtered.length
              ? "Showing " + (start + 1).toLocaleString("en-NG") + "–" + (start + shown.length).toLocaleString("en-NG") + " of " + filtered.length.toLocaleString("en-NG") + (hasFilters ? " matching records" : " records")
              : "Showing 0 records";
            pageState.textContent = pageNumber + " / " + pageCount;
            prev.disabled = pageNumber <= 1 || filtered.length === 0;
            next.disabled = pageNumber >= pageCount || filtered.length === 0;
            pageSizeSelect.disabled = total === 0;
            search.disabled = total === 0;
            role.disabled = total === 0;
            city.disabled = total === 0;
            period.disabled = total === 0;
          };

          const clearFilters = () => {
            search.value = "";
            role.value = "";
            city.value = "";
            period.value = "all";
            pageNumber = 1;
            renderRows();
          };

          search.addEventListener("input", () => { pageNumber = 1; renderRows(); });
          role.addEventListener("change", () => { pageNumber = 1; renderRows(); });
          city.addEventListener("change", () => { pageNumber = 1; renderRows(); });
          period.addEventListener("change", () => { pageNumber = 1; renderRows(); });
          pageSizeSelect.addEventListener("change", () => { pageNumber = 1; renderRows(); });
          reset.addEventListener("click", clearFilters);
          $("#wlClearEmpty", root).addEventListener("click", clearFilters);
          prev.addEventListener("click", () => { pageNumber -= 1; renderRows(); });
          next.addEventListener("click", () => { pageNumber += 1; renderRows(); });
          exportButton.addEventListener("click", () => downloadCsv(currentMatches()));
          root.addEventListener("click", (event) => {
            const copyButton = event.target.closest("[data-wl-copy]");
            if (copyButton && copyButton.dataset.wlCopy) copy(copyButton.dataset.wlCopy, "Email address copied.");
          });

          renderRows();
        }
      };
    }
  });
}
