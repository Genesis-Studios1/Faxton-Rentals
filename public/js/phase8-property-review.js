import { $, esc, toast } from "./ui.js";
import { apiConfigured } from "./api-client.js";
import { listBackendAdminProperties, setBackendAdminPropertyStatus } from "./api-admin.js";

const date = (value) => {
  const parsed = new Date(value);
  return value && !Number.isNaN(parsed.getTime())
    ? parsed.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })
    : "—";
};
const title = (value) => String(value || "").replaceAll("_", " ").replace(/\\b\\w/g, (letter) => letter.toUpperCase());
const statusLabel = (status) => ({
  draft: "Draft", pending_review: "Pending review", published: "Published",
  paused: "Paused", archived: "Archived"
}[status] || "Unknown");
const statusTone = (status) => status === "published" ? "ok" : status === "archived" ? "bad" : "warn";
const errorText = (error) => String(error?.message || "Something went wrong. Please try again.");
const money = (amount, currency, period) => {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "Price not set";
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency: currency || "NGN", maximumFractionDigits: 0 }).format(value) + (period ? ` / ${period.replaceAll("_", " ")}` : "");
  } catch {
    return `${currency || "NGN"} ${value.toLocaleString("en-NG")}` + (period ? ` / ${period.replaceAll("_", " ")}` : "");
  }
};

export function propertyReviewPage(ctx) {
  if (!ctx.S.isAdmin) return {
    title: "Property review",
    html: '<main class="rf" style="max-width:760px;margin:0 auto;padding:24px 16px"><h1 class="rf-h1">Admin access required</h1><p class="rf-sub">You do not have permission to moderate property listings.</p></main>'
  };
  if (!apiConfigured()) return {
    title: "Property review",
    html: '<main class="rf" style="max-width:900px;margin:0 auto;padding:24px 16px"><h1 class="rf-h1">Property review</h1><p class="rf-sub">Connect the Faxton backend to this build to use backend listing moderation. The existing Firestore listing screen remains available.</p></main>'
  };

  return {
    title: "Property review",
    html: `<main class="rf" style="max-width:1120px;margin:0 auto;padding:24px 16px 48px">
      <span class="rf-eyebrow">Administration</span>
      <h1 class="rf-h1">Property review</h1>
      <p class="rf-sub">Review listings stored in the Faxton backend. Changes here affect backend records only; the current Firestore listing workflow is unchanged.</p>
      <p class="rf-muted" style="margin:10px 0 18px">The current moderation API supports publish, pause and archive. It does not yet record a reasoned property-moderation audit entry, restore archived listings or return listing photos in this queue.</p>
      <section class="rf-card" style="padding:16px;margin:18px 0">
        <form id="propertyFilters" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;align-items:end">
          <label style="display:grid;gap:6px">Listing status
            <select class="ax-input" name="status">
              <option value="">All statuses</option><option value="pending_review">Pending review</option><option value="draft">Draft</option><option value="published">Published</option><option value="paused">Paused</option><option value="archived">Archived</option>
            </select>
          </label>
          <button class="btn primary" type="submit">Apply filter</button>
          <a class="btn" href="#/admin/listings">Open existing listings</a>
        </form>
      </section>
      <section aria-labelledby="propertyRowsHeading">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><h2 class="rf-h2" id="propertyRowsHeading">Backend listings</h2><span class="rf-muted" id="propertyPageLabel"></span></div>
        <div id="propertyRows" aria-live="polite"><article class="rf-card" style="padding:16px">Loading listings…</article></div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin:12px 0"><button class="btn" id="propertyPrev" type="button" disabled>Previous</button><button class="btn" id="propertyNext" type="button" disabled>Next</button></div>
      </section>
    </main>`,
    async mount(root) {
      const filters = $("#propertyFilters", root), rows = $("#propertyRows", root);
      const pageLabel = $("#propertyPageLabel", root), prev = $("#propertyPrev", root), next = $("#propertyNext", root);
      let offset = 0, currentProperties = [], loading = false, actionBusy = false;
      const limit = 20;
      const render = () => {
        rows.innerHTML = currentProperties.length ? currentProperties.map((property) => {
          const status = property.status;
          const actions = status === "archived" ? "" : [
            ...(status !== "published" ? ['<button class="btn primary" type="button" data-property-action="published">Publish</button>'] : []),
            ...(status === "published" ? ['<button class="btn" type="button" data-property-action="paused">Pause</button>'] : []),
            '<button class="btn danger" type="button" data-property-action="archived">Archive</button>'
          ].join("");
          const details = [
            property.beds ? `${property.beds} bed${property.beds === 1 ? "" : "s"}` : "",
            property.baths ? `${property.baths} bath${property.baths === 1 ? "" : "s"}` : "",
            property.sqm ? `${property.sqm.toLocaleString("en-NG")} m²` : "",
            title(property.listingMode)
          ].filter(Boolean).join(" · ");
          return `<article class="rf-card" data-property-id="${esc(property.id)}" style="padding:16px;margin:10px 0;display:grid;gap:12px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
              <div style="min-width:0;flex:1"><h3 class="rf-h2" style="margin:0 0 5px">${esc(property.title || "Untitled listing")}</h3><div class="rf-muted">${esc([property.city, property.state, property.country].filter(Boolean).join(", ") || "Location not supplied")}</div></div>
              <span class="rf-pill ${statusTone(status)}"><i></i>${esc(statusLabel(status))}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
              <div><b>${esc(money(property.price, property.currency, property.pricePeriod))}</b><div class="rf-muted">${esc(details || "Property details not supplied")} · Submitted ${esc(date(property.createdAt))}</div></div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">${actions}</div>
            </div>
            <details><summary style="cursor:pointer">View listing details</summary><div style="display:grid;gap:5px;margin-top:10px">
              <p style="margin:0">${esc(property.desc || "No description supplied.")}</p>
              <small class="rf-muted">Property type: ${esc(title(property.propertyType))} · Owner ID: ${esc(property.ownerUid || "—")} · Listed by ID: ${esc(property.listedByUid || "—")}</small>
              <small class="rf-muted">Updated: ${esc(date(property.updatedAt))}</small>
            </div></details>
          </article>`;
        }).join("") : '<article class="rf-card" style="padding:16px">No backend listings match this filter.</article>';
        pageLabel.textContent = currentProperties.length ? `Showing ${offset + 1}–${offset + currentProperties.length}` : "No results on this page";
        prev.disabled = offset === 0 || loading;
        next.disabled = currentProperties.length < limit || loading;
      };
      const load = async () => {
        if (loading) return;
        loading = true;
        rows.innerHTML = '<article class="rf-card" style="padding:16px">Loading listings…</article>';
        const status = String(new FormData(filters).get("status") || "");
        try {
          currentProperties = await listBackendAdminProperties({ status, limit, offset });
          render();
        } catch (error) {
          currentProperties = [];
          rows.innerHTML = `<article class="rf-card" style="padding:16px">${esc(errorText(error))}</article>`;
          pageLabel.textContent = "";
          prev.disabled = true; next.disabled = true;
        } finally {
          loading = false;
          prev.disabled = offset === 0;
          next.disabled = currentProperties.length < limit;
        }
      };
      filters.addEventListener("submit", (event) => { event.preventDefault(); offset = 0; load(); });
      prev.addEventListener("click", () => { offset = Math.max(0, offset - limit); load(); });
      next.addEventListener("click", () => { offset += limit; load(); });
      rows.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-property-action]");
        if (!button || actionBusy) return;
        const card = button.closest("[data-property-id]");
        const property = currentProperties.find((item) => item.id === card?.dataset.propertyId);
        const status = button.dataset.propertyAction;
        if (!property || !["published", "paused", "archived"].includes(status)) return;
        const actionLabel = status === "published" ? "publish" : status === "paused" ? "pause" : "archive";
        if (!window.confirm(`Are you sure you want to ${actionLabel} “${property.title}”?`)) return;
        actionBusy = true; button.disabled = true;
        try {
          await setBackendAdminPropertyStatus(property.id, status);
          toast(`Listing ${actionLabel}d.`);
          await load();
        } catch (error) {
          toast(errorText(error), { tone: "bad" });
          button.disabled = false;
        } finally { actionBusy = false; }
      });
      await load();
    }
  };
}
