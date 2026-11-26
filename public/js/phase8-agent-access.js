import { $, esc, toast } from "./ui.js";
import { apiConfigured } from "./api-client.js";
import {
  listBackendAgentAuthorisationHistory,
  inviteBackendAgent,
  acceptBackendAgentInvitation,
  revokeBackendAgentAuthorisation
} from "./api-properties.js";

const date = (value) => {
  const parsed = new Date(value);
  return value && !Number.isNaN(parsed.getTime())
    ? parsed.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })
    : "—";
};
const statusName = (value) => ({ pending: "Awaiting response", accepted: "Active", revoked: "Revoked" }[value] || "Unknown");
const errorMessage = (error) => String(error?.message || "Something went wrong. Please try again.");

export function agentAccessPage(ctx) {
  const role = ctx.S.role;
  const canInvite = ["landlord", "agency"].includes(role);
  const canAccept = ["agent", "agency"].includes(role);
  if (!["landlord", "agency", "agent"].includes(role)) return {
    title: "Agent access",
    html: '<main class="rf" style="max-width:760px;margin:0 auto;padding:24px 16px"><h1 class="rf-h1">Not available</h1><p class="rf-sub">Agent access is available to property owners, agencies and agents.</p></main>'
  };
  if (!apiConfigured()) return {
    title: "Agent access",
    html: '<main class="rf" style="max-width:760px;margin:0 auto;padding:24px 16px"><h1 class="rf-h1">Agent access</h1><p class="rf-sub">Connect the Faxton backend to manage landlord-agent authorisations. Your existing listing workflow remains available.</p></main>'
  };
  return {
    title: "Agent access",
    html: `<main class="rf" style="max-width:960px;margin:0 auto;padding:24px 16px 48px">
      <span class="rf-eyebrow">Property management</span>
      <h1 class="rf-h1">Agent access</h1>
      <p class="rf-sub">Give an agent permission to manage listings for a property you own, or respond to an invitation from a property owner. You can revoke access at any time.</p>
      ${canInvite ? `<section class="rf-card" style="padding:16px;margin:18px 0">
        <h2 class="rf-h2">Invite an agent or agency</h2>
        <p class="rf-muted">Enter the email address used by their active Faxton account.</p>
        <form id="agentInviteForm" style="display:flex;gap:10px;flex-wrap:wrap">
          <label style="flex:1;min-width:220px"><span class="rf-muted">Agent email</span><input class="ax-input" type="email" name="agentEmail" maxlength="254" required autocomplete="email" placeholder="agent@example.com"></label>
          <button class="btn primary" type="submit">Send invitation</button>
        </form>
        <p id="agentInviteError" role="alert" class="rf-muted"></p>
      </section>` : ""}
      <section aria-labelledby="agentAccessListHeading">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><h2 class="rf-h2" id="agentAccessListHeading">Your agent relationships</h2><button class="btn" id="agentAccessRefresh" type="button">Refresh</button></div>
        <div id="agentAccessRows" aria-live="polite"><article class="rf-card" style="padding:16px">Loading relationships…</article></div>
      </section>
    </main>`,
    async mount(root) {
      const rows = $("#agentAccessRows", root);
      const inviteForm = $("#agentInviteForm", root);
      const render = (items) => {
        rows.innerHTML = items.length ? items.map((item) => {
          const owner = item.landlord_name || item.landlordName || item.landlord_email || item.landlordEmail || "Property owner";
          const agent = item.agent_name || item.agentName || item.agent_email || item.agentEmail || "Agent";
          const other = role === "agent" ? owner : agent;
          const id = item.id;
          const status = item.status;
          const actions = [
            canAccept && status === "pending" ? '<button class="btn primary" type="button" data-accept>Accept invitation</button>' : "",
            canInvite && ["pending", "accepted"].includes(status) ? '<button class="btn danger" type="button" data-revoke>Revoke access</button>' : ""
          ].filter(Boolean).join("");
          return `<article class="rf-card" data-authorisation-id="${esc(id)}" style="padding:16px;margin:10px 0;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap">
            <div style="min-width:0;flex:1"><b>${esc(other)}</b><div class="rf-muted">${esc(statusName(status))}</div><small class="rf-muted">Invited ${esc(date(item.invited_at || item.invitedAt))}${item.accepted_at || item.acceptedAt ? " · Accepted " + esc(date(item.accepted_at || item.acceptedAt)) : ""}</small></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">${actions}</div>
          </article>`;
        }).join("") : '<article class="rf-card" style="padding:16px">No agent relationships yet.</article>';
      };
      const load = async () => {
        rows.innerHTML = '<article class="rf-card" style="padding:16px">Loading relationships…</article>';
        try {
          const items = await listBackendAgentAuthorisationHistory();
          render(items);
        } catch (error) {
          rows.innerHTML = `<article class="rf-card" style="padding:16px">${esc(errorMessage(error))}</article>`;
        }
      };
      inviteForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = inviteForm.querySelector('[type="submit"]');
        const error = $("#agentInviteError", root);
        button.disabled = true; error.textContent = "";
        try {
          await inviteBackendAgent(inviteForm.elements.agentEmail.value);
          inviteForm.reset(); toast("Invitation sent.");
          await load();
        } catch (failure) { error.textContent = errorMessage(failure); }
        finally { button.disabled = false; }
      });
      rows.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-accept], [data-revoke]");
        if (!button) return;
        const card = button.closest("[data-authorisation-id]");
        const id = card?.dataset.authorisationId;
        if (!id) return;
        button.disabled = true;
        try {
          if (button.hasAttribute("data-accept")) {
            await acceptBackendAgentInvitation(id);
            toast("Invitation accepted. You can now manage listings for this owner.");
          } else {
            if (!window.confirm("Revoke this agent's access to your listings?")) { button.disabled = false; return; }
            await revokeBackendAgentAuthorisation(id);
            toast("Agent access revoked.");
          }
          await load();
        } catch (error) { toast(errorMessage(error), { tone: "bad" }); button.disabled = false; }
      });
      $("#agentAccessRefresh", root).addEventListener("click", load);
      await load();
    }
  };
}
