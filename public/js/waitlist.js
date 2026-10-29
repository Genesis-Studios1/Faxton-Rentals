import { db } from "./firebase.js";
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import * as AX from "./ax.js";

const { $, esc, pageView, empty, toast } = AX;
const dateOf = (v) => {
  const d = v?.toDate ? v.toDate() : v?.seconds ? new Date(v.seconds * 1000) : v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};
const dateText = (v) => dateOf(v)?.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) || "—";
const csvCell = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
const downloadCsv = (rows) => {
  const fields = ["name", "email", "role", "city", "source", "createdAt"];
  const content = [fields.join(","), ...rows.map(r => fields.map(k => csvCell(k === "createdAt" ? dateText(r[k]) : r[k])).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = "faxton-website-waitlist.csv"; link.click(); URL.revokeObjectURL(url);
};

export function page(ctx) {
  return pageView(ctx, {
    title: "Website waitlist",
    eyebrow: "Growth",
    sub: "People who joined the waitlist from the Faxton Rentals website.",
    what: "the website waitlist",
    cols: [["waitlist", async () => {
      const snap = await getDocs(query(collection(db, "waitlist"), orderBy("createdAt", "desc")));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }]],
    render: ({ waitlist }) => {
      const rows = Array.isArray(waitlist) ? waitlist : [];
      const cities = new Set(rows.map(r => String(r.city || "").trim()).filter(Boolean));
      const roles = new Set(rows.map(r => String(r.role || "").trim()).filter(Boolean));
      const table = rows.length ? `<div class="ax-table-wrap"><table class="ax-table"><thead><tr><th>Name</th><th>Email</th><th>Signup type</th><th>City</th><th>Registered</th></tr></thead><tbody id="waitlistRows">${rows.map(r => `<tr data-search="${esc([r.name,r.email,r.role,r.city].join(" ").toLowerCase())}" data-role="${esc(r.role || "")}" data-city="${esc(r.city || "")}"><td><strong>${esc(r.name || "—")}</strong></td><td>${esc(r.email || "—")}</td><td>${esc(r.role || "—")}</td><td>${esc(r.city || "—")}</td><td>${esc(dateText(r.createdAt))}</td></tr>`).join("")}</tbody></table></div>` : empty({ icon: "users", title: "No website signups yet", hint: "New registrations from the public website will appear here." });
      return { html: `<div class="ax-stack"><div class="ax-grid ax-grid-3"><div class="ax-card ax-stat"><span>Total signups</span><strong>${rows.length.toLocaleString("en-NG")}</strong></div><div class="ax-card ax-stat"><span>Cities represented</span><strong>${cities.size.toLocaleString("en-NG")}</strong></div><div class="ax-card ax-stat"><span>Signup types</span><strong>${roles.size.toLocaleString("en-NG")}</strong></div></div><div class="ax-card" style="padding:16px"><div class="ax-row" style="gap:10px;flex-wrap:wrap;align-items:center"><input id="wlSearch" class="ax-input" style="flex:1;min-width:180px" type="search" placeholder="Search name, email, city or role" aria-label="Search waitlist"><select id="wlRole" class="ax-input" aria-label="Filter by signup type"><option value="">All signup types</option>${[...roles].sort().map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("")}</select><select id="wlCity" class="ax-input" aria-label="Filter by city"><option value="">All cities</option>${[...cities].sort().map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("")}</select><button type="button" class="ax-btn ax-btn-primary" id="wlExport" ${rows.length ? "" : "disabled"}>Export CSV</button></div><p class="ax-muted" id="wlCount" style="margin:12px 0">${rows.length} signup${rows.length === 1 ? "" : "s"}</p>${table}</div></div>`,
        mount(root) {
          const search = $("#wlSearch", root), role = $("#wlRole", root), city = $("#wlCity", root), count = $("#wlCount", root);
          const filter = () => {
            const q = search.value.trim().toLowerCase(); let visible = 0;
            $("#waitlistRows", root)?.querySelectorAll("tr").forEach(tr => {
              const show = (!q || tr.dataset.search.includes(q)) && (!role.value || tr.dataset.role === role.value) && (!city.value || tr.dataset.city === city.value);
              tr.hidden = !show; if (show) visible++;
            });
            count.textContent = visible + " of " + rows.length + " signups";
          };
          search.addEventListener("input", filter); role.addEventListener("change", filter); city.addEventListener("change", filter);
          $("#wlExport", root).addEventListener("click", () => downloadCsv(rows));
        } };
    }
  });
}
