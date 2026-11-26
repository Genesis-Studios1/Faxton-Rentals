import { $, esc, toast } from "./ui.js";
import { apiConfigured } from "./api-client.js";
import { listBackendAdminUsers, setBackendAdminUserStatus, listBackendAdminAuditLogs } from "./api-admin.js";

const date = (value) => {
  const parsed = new Date(value);
  return value && !Number.isNaN(parsed.getTime())
    ? parsed.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })
    : "—";
};
const title = (value) => String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const statusPill = (status) => {
  const good = status === "active";
  return `<span class="rf-pill ${good ? "ok" : "bad"}"><i></i>${good ? "Active" : "Suspended"}</span>`;
};
const message = (value) => String(value || "Something went wrong. Please try again.");

export function accountReviewPage(ctx) {
  if (!ctx.S.isAdmin) return { title: "Account review", html: '<div class="rf" style="max-width:760px;margin:0 auto;padding:24px 16px"><h1 class="rf-h1">Admin access required</h1><p class="rf-sub">You do not have permission to review account status.</p></div>' };
  if (!apiConfigured()) return { title: "Account review", html: '<div class="rf" style="max-width:900px;margin:0 auto;padding:24px 16px"><h1 class="rf-h1">Account review</h1><p class="rf-sub">Connect the Faxton backend to this build to use audited account moderation.</p></div>' };

  return {
    title: "Account review",
    html: `<main class="rf" style="max-width:1120px;margin:0 auto;padding:24px 16px 48px">
      <span class="rf-eyebrow">Administration</span>
      <h1 class="rf-h1">Account review</h1>
      <p class="rf-sub">Review account status and see an audit trail of every suspension or reactivation. Each change requires a reason.</p>
      <section class="rf-card" style="padding:16px;margin:18px 0">
        <form id="accountFilters" style="display:grid;grid-template-columns:minmax(180px,2fr) repeat(2,minmax(130px,1fr)) auto;gap:10px;align-items:end">
          <label style="display:grid;gap:6px">Search accounts<input class="ax-input" name="search" type="search" maxlength="120" placeholder="Name or email"></label>
          <label style="display:grid;gap:6px">Role<select class="ax-input" name="role"><option value="">All roles</option><option>renter</option><option>landlord</option><option>agent</option><option>agency</option><option>support</option><option>admin</option><option>owner</option></select></label>
          <label style="display:grid;gap:6px">Status<select class="ax-input" name="status"><option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option></select></label>
          <button class="btn primary" type="submit">Apply filters</button>
        </form>
      </section>
      <section aria-labelledby="accountResultsHeading">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><h2 class="rf-h2" id="accountResultsHeading">Accounts</h2><span class="rf-muted" id="accountPageLabel"></span></div>
        <div id="accountRows" aria-live="polite">${'<article class="rf-card" style="padding:16px">Loading accounts…</article>'}</div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin:12px 0"><button class="btn" id="accountPrev" type="button" disabled>Previous</button><button class="btn" id="accountNext" type="button" disabled>Next</button></div>
      </section>
      <section style="margin-top:28px" aria-labelledby="accountAuditHeading">
        <h2 class="rf-h2" id="accountAuditHeading">Recent moderation history</h2>
        <div id="accountAuditRows" aria-live="polite"><article class="rf-card" style="padding:16px">Loading audit history…</article></div>
      </section>
      <dialog id="accountReasonDialog" style="border:0;border-radius:16px;padding:0;width:min(520px,calc(100% - 28px));box-shadow:0 20px 70px #0003">
        <form id="accountReasonForm" style="padding:20px;display:grid;gap:12px">
          <h2 class="rf-h2" id="accountReasonTitle">Confirm account change</h2>
          <p class="rf-muted" id="accountReasonDescription"></p>
          <label style="display:grid;gap:6px">Reason (required)<textarea class="ax-input" name="reason" rows="4" minlength="8" maxlength="500" required placeholder="Explain why this account status is changing"></textarea></label>
          <div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn" type="button" id="accountReasonCancel">Cancel</button><button class="btn primary" type="submit">Confirm change</button></div>
          <p id="accountReasonError" role="alert" style="color:var(--danger,#b42318);margin:0"></p>
        </form>
      </dialog>
    </main>`,
    async mount(root) {
      const filters = $("#accountFilters", root), rows = $("#accountRows", root), audit = $("#accountAuditRows", root);
      const pageLabel = $("#accountPageLabel", root), prev = $("#accountPrev", root), next = $("#accountNext", root);
      const dialog = $("#accountReasonDialog", root), reasonForm = $("#accountReasonForm", root);
      let offset = 0, currentUsers = [], pendingChange = null, loading = false;
      const limit = 25;
      const loadAudit = async () => {
        try {
          const logs = await listBackendAdminAuditLogs({ limit: 30 });
          audit.innerHTML = logs.length ? logs.map((entry) => `<article class="rf-card" style="padding:14px;margin:8px 0;display:grid;gap:5px">
            <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><b>${esc(title(entry.action))}</b><span class="rf-muted">${esc(date(entry.created_at || entry.createdAt))}</span></div>
            <p style="margin:0">${esc(entry.reason)}</p><small class="rf-muted">Target: ${esc(entry.target_user_id || entry.targetUserId || "—")} · Actor: ${esc(entry.actor_user_id || entry.actorUserId || "—")}</small>
          </article>`).join("") : '<article class="rf-card" style="padding:16px">No moderation actions have been recorded.</article>';
        } catch (error) {
          audit.innerHTML = `<article class="rf-card" style="padding:16px">${esc(message(error))}</article>`;
        }
      };
      const loadUsers = async () => {
        if (loading) return;
        loading = true; rows.innerHTML = '<article class="rf-card" style="padding:16px">Loading accounts…</article>';
        const form = new FormData(filters);
        try {
          currentUsers = await listBackendAdminUsers({
            search: String(form.get("search") || ""),
            role: String(form.get("role") || ""),
            status: String(form.get("status") || ""),
            limit, offset
          });
          rows.innerHTML = currentUsers.length ? currentUsers.map((user) => {
            const name = user.displayName || user.email || "Account";
            const suspended = user.status === "suspended";
            return `<article class="rf-card" data-account-id="${esc(user.id)}" style="padding:14px;margin:8px 0;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap">
              <div style="min-width:0;flex:1"><b>${esc(name)}</b><div class="rf-muted" style="overflow-wrap:anywhere">${esc(user.email || "")}</div><small class="rf-muted">${esc(title(user.role))} · Joined ${esc(date(user.createdAt || user.created_at))} · Email ${user.emailVerified ? "verified" : "not verified"} · Phone ${user.phoneVerified ? "verified" : "not verified"}</small></div>
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">${statusPill(user.status)}<button type="button" class="btn ${suspended ? "" : "danger"}" data-account-action="${suspended ? "active" : "suspended"}" ${user.id === ctx.S.backendUserId ? "disabled" : ""}>${suspended ? "Reactivate" : "Suspend"}</button></div>
            </article>`;
          }).join("") : '<article class="rf-card" style="padding:16px">No accounts match these filters.</article>';
          pageLabel.textContent = currentUsers.length ? `Showing ${offset + 1}–${offset + currentUsers.length}` : `No results on this page`;
          prev.disabled = offset === 0;
          next.disabled = currentUsers.length < limit;
        } catch (error) {
          currentUsers = [];
          rows.innerHTML = `<article class="rf-card" style="padding:16px">${esc(message(error))}</article>`;
          pageLabel.textContent = "";
          prev.disabled = true; next.disabled = true;
        } finally { loading = false; }
      };
      const openReason = (user, status) => {
        pendingChange = { user, status };
        $("#accountReasonTitle", dialog).textContent = status === "suspended" ? "Suspend this account?" : "Reactivate this account?";
        $("#accountReasonDescription", dialog).textContent = `${user.displayName || user.email || "This account"} will be ${status === "suspended" ? "prevented from signing in" : "allowed to sign in again"}. This action will be recorded in the audit history.`;
        $("#accountReasonError", dialog).textContent = "";
        reasonForm.elements.reason.value = "";
        dialog.showModal();
        reasonForm.elements.reason.focus();
      };
      filters.addEventListener("submit", (event) => { event.preventDefault(); offset = 0; loadUsers(); });
      prev.addEventListener("click", () => { offset = Math.max(0, offset - limit); loadUsers(); });
      next.addEventListener("click", () => { offset += limit; loadUsers(); });
      rows.addEventListener("click", (event) => {
        const button = event.target.closest("[data-account-action]");
        if (!button) return;
        const card = button.closest("[data-account-id]");
        const user = currentUsers.find((item) => item.id === card?.dataset.accountId);
        if (user) openReason(user, button.dataset.accountAction);
      });
      $("#accountReasonCancel", dialog).addEventListener("click", () => dialog.close());
      reasonForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!pendingChange) return;
        const button = reasonForm.querySelector('[type="submit"]');
        button.disabled = true;
        $("#accountReasonError", dialog).textContent = "";
        try {
          await setBackendAdminUserStatus(pendingChange.user.id, pendingChange.status, reasonForm.elements.reason.value);
          dialog.close(); pendingChange = null;
          toast("Account status updated and audit entry recorded.");
          await Promise.all([loadUsers(), loadAudit()]);
        } catch (error) {
          $("#accountReasonError", dialog).textContent = message(error);
        } finally { button.disabled = false; }
      });
      await Promise.all([loadUsers(), loadAudit()]);
    }
  };
}
