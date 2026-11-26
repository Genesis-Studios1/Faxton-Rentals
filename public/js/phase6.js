import { $, esc, icon, toast } from "./ui.js";
import { apiConfigured } from "./api-client.js";
import { listMyBackendProperties } from "./api-properties.js";
import * as st from "./store.js";
import {
  uploadBackendVerificationDocument, submitBackendVerification, listBackendVerifications,
  listBackendVerificationQueue, getBackendVerificationCase, reviewBackendVerification,
  createBackendSupportCase, listBackendSupportCases, listBackendAdminSupportCases,
  getBackendSupportCase, listBackendSupportCaseEvents, sendBackendSupportMessage,
  updateBackendSupportCase
} from "./api-verification-support.js";

const uuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || ""));
const titleCase = (v) => String(v || "").replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
const date = (v) => { const d = new Date(v); return v && !Number.isNaN(d.getTime()) ? d.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "—"; };
const pill = (status) => {
  const good = ["approved", "verified", "resolved", "closed"].includes(String(status).toLowerCase());
  const bad = ["rejected", "failed"].includes(String(status).toLowerCase());
  return `<span class="rf-pill ${good ? "ok" : bad ? "bad" : "warn"}"><i></i>${esc(titleCase(status))}</span>`;
};
const card = (body) => `<article class="rf-card" style="padding:16px;margin:12px 0">${body}</article>`;
const empty = (text) => card(`<p class="rf-muted" style="margin:0">${esc(text)}</p>`);
const errText = (e) => e?.message || "Something went wrong. Please try again.";
const roleStaff = (ctx) => ["admin", "owner", "support"].includes(ctx.S.role) || ctx.S.isAdmin;
const safeUrl = (value) => { try { const u = new URL(value); return u.protocol === "https:" ? u.href : ""; } catch { return ""; } };

export function verificationPage(ctx) {
  return {
    title: "Account verification",
    html: `<div class="rf" style="max-width:900px;margin:0 auto;padding:24px 16px">
      <span class="rf-eyebrow">Trust & safety</span><h1 class="rf-h1">Account verification</h1>
      <p class="rf-sub">Submit private documents for manual review. Faxton never displays your verification documents publicly.</p>
      <div id="verificationHistory">${card("Loading your verification history…")}</div>
      <section class="rf-card" style="padding:18px;margin-top:20px">
        <h2 class="rf-h2">Start a verification request</h2>
        <form id="verificationForm" style="display:grid;gap:14px">
          <label>What do you want to verify?
            <select name="subjectType" class="ax-input" required>
              <option value="identity">My identity</option>
              ${["agency"].includes(ctx.S.role) ? '<option value="business">My business</option>' : ""}
              ${["landlord","agency"].includes(ctx.S.role) ? '<option value="property_ownership">Property ownership</option>' : ""}
            </select>
          </label>
          <label id="verificationPropertyWrap" hidden>Property
            <select name="propertyId" class="ax-input"><option value="">Choose one of your properties</option></select>
          </label>
          <div id="verificationDocuments"></div>
          <p class="rf-muted" style="font-size:12px;margin:0">Accepted: PDF, JPG or PNG, maximum 10 MB per document. Only upload documents you are authorised to provide. Do not send passwords or payment card details.</p>
          <button class="btn primary" type="submit">Upload documents and submit</button>
          <p id="verificationFormStatus" class="rf-muted" aria-live="polite"></p>
        </form>
      </section>
    </div>`,
    async mount(root) {
      const history = $("#verificationHistory", root), form = $("#verificationForm", root);
      const type = form.elements.subjectType, propWrap = $("#verificationPropertyWrap", form), prop = form.elements.propertyId;
      const docs = $("#verificationDocuments", form), status = $("#verificationFormStatus", form), submit = form.querySelector('[type="submit"]');
      let properties = [];
      try { properties = await listMyBackendProperties(); } catch { /* identity verification remains usable */ }
      prop.innerHTML = '<option value="">Choose one of your properties</option>' + properties.map(p => `<option value="${esc(p.id)}">${esc(p.title || p.area || "Property")}</option>`).join("");
      const definitions = {
        identity: [["government_id","Government-issued ID"],["proof_of_address","Proof of address"]],
        business: [["business_registration","Business registration evidence"],["business_address","Business address evidence (optional)"]],
        property_ownership: [["ownership_proof","Property ownership evidence"]]
      };
      const paintFields = () => {
        const subject = type.value;
        propWrap.hidden = subject !== "property_ownership";
        prop.required = subject === "property_ownership";
        docs.innerHTML = (definitions[subject] || []).map(([kind,label],i) => `<label style="display:grid;gap:6px">${esc(label)} ${i===0 || subject==="identity" ? '<span aria-hidden="true">*</span>' : '<small class="rf-muted">Optional</small>'}
          <input class="ax-input" type="file" name="${kind}" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" ${i===0 || subject==="identity" ? "required" : ""}>
        </label>`).join("");
      };
      type.addEventListener("change", paintFields); paintFields();
      const loadHistory = async () => {
        try {
          const rows = await listBackendVerifications();
          history.innerHTML = '<h2 class="rf-h2">Your requests</h2>' + (rows.length ? rows.map(v => card(`<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><b>${esc(titleCase(v.subjectType))}</b>${pill(v.status)}</div><p class="rf-muted" style="margin:8px 0 0">Submitted ${esc(date(v.submittedAt))}</p>${v.reviewReason ? '<p style="margin:8px 0 0">' + esc(v.reviewReason) + '</p>' : ""}`)).join("") : empty("You have not submitted a verification request yet."));
        } catch (e) { history.innerHTML = empty(errText(e)); }
      };
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const subjectType = type.value, propertyId = prop.value;
        if (subjectType === "property_ownership" && !uuid(propertyId)) return toast("Choose one of your properties.");
        const required = definitions[subjectType] || [];
        const chosen = required.map(([documentType]) => ({ documentType, file: form.elements[documentType]?.files?.[0] })).filter(x => x.file);
        if (subjectType === "identity" && chosen.length !== 2) return toast("Upload both your ID and proof of address.");
        if (!chosen.length) return toast("Choose the required document.");
        submit.disabled = true; status.textContent = "Uploading documents securely…";
        try {
          const documents = [];
          for (const item of chosen) {
            const upload = await uploadBackendVerificationDocument(item.file);
            documents.push({ uploadId: upload.uploadId, documentType: item.documentType });
          }
          await submitBackendVerification({ subjectType, propertyId, documents });
          status.textContent = "Your request has been submitted for manual review.";
          form.reset(); paintFields(); await loadHistory();
          toast("Verification request submitted.");
        } catch (e) { status.textContent = errText(e); toast(errText(e)); }
        finally { submit.disabled = false; }
      });
      await loadHistory();
    }
  };
}

export function verificationAdminPage(ctx) {
  return {
    title: "Verification review",
    html: `<div class="rf" style="max-width:1100px;margin:0 auto;padding:24px 16px"><span class="rf-eyebrow">Admin console</span><h1 class="rf-h1">Verification review</h1><p class="rf-sub">Review private evidence and record a reasoned decision.</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin:16px 0"><select id="verificationFilter" class="ax-input"><option value="pending">Pending</option><option value="needs_resubmission">Needs resubmission</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select><select id="verificationSubject" class="ax-input"><option value="">All types</option><option value="identity">Identity</option><option value="business">Business</option><option value="property_ownership">Property ownership</option></select><button class="btn" id="verificationRefresh">Refresh</button></div><div id="verificationQueue">${empty("Loading review queue…")}</div><div id="verificationDetail"></div></div>`,
    async mount(root) {
      const queue=$("#verificationQueue",root), detail=$("#verificationDetail",root), filter=$("#verificationFilter",root), subject=$("#verificationSubject",root);
      const load=async()=>{queue.innerHTML=empty("Loading…");detail.innerHTML="";try{const rows=await listBackendVerificationQueue({status:filter.value,subjectType:subject.value||undefined});queue.innerHTML=rows.length?rows.map(v=>card(`<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><b>${esc(v.subjectName||v.subjectEmail||"Account")}</b><p class="rf-muted" style="margin:4px 0">${esc(titleCase(v.subjectType))} · ${esc(v.propertyTitle||"")}</p><small>${esc(date(v.submittedAt))}</small></div><div>${pill(v.status)} <button class="btn" data-case="${esc(v.id)}">Review</button></div></div>`)).join(""):empty("No cases match this filter.");}catch(e){queue.innerHTML=empty(errText(e));}};
      $("#verificationRefresh",root).addEventListener("click",load);filter.addEventListener("change",load);subject.addEventListener("change",load);
      queue.addEventListener("click",async e=>{const b=e.target.closest("[data-case]");if(!b)return;b.disabled=true;try{const v=await getBackendVerificationCase(b.dataset.case);detail.innerHTML=card(`<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><h2 class="rf-h2">${esc(v.subjectName||v.subjectEmail||"Verification case")}</h2>${pill(v.status)}</div><p>${esc(titleCase(v.subjectType))} · ${esc(v.propertyTitle||"")}</p><h3>Private documents</h3>${(v.documents||[]).map(d=>{const url=safeUrl(d.downloadUrl);return `<p><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(titleCase(d.documentType))} · ${esc(d.contentType)} · ${Math.round(d.byteSize/1024)} KB</a></p>`;}).join("")||"<p>No documents attached.</p>"}<h3>Review history</h3><ul>${(v.events||[]).map(x=>`<li>${esc(titleCase(x.eventType))} · ${esc(date(x.createdAt))}${x.reason?" — "+esc(x.reason):""}</li>`).join("")}</ul><form id="verificationDecision" style="display:grid;gap:10px"><label>Decision<select class="ax-input" name="decision"><option value="approved">Approve</option><option value="rejected">Reject</option><option value="needs_resubmission">Request new documents</option></select></label><label>Reason<textarea class="ax-input" name="reason" minlength="8" maxlength="1000" required></textarea></label><button class="btn primary">Record decision</button></form>`);
          const form=$("#verificationDecision",detail);form.addEventListener("submit",async ev=>{ev.preventDefault();const b2=form.querySelector("button"),reason=form.elements.reason.value.trim();if(reason.length<8)return toast("Please enter a clear reason.");b2.disabled=true;try{await reviewBackendVerification(v.id,{status:form.elements.decision.value,reason});toast("Verification decision recorded.");await load();}catch(err){toast(errText(err));b2.disabled=false;}});
        }catch(err){detail.innerHTML=empty(errText(err));}finally{b.disabled=false;}});
      await load();
    }
  };
}

export function supportCasesPage(ctx) {
  return {
    title: "Help, reports and disputes",
    html: `<div class="rf" style="max-width:1000px;margin:0 auto;padding:24px 16px"><span class="rf-eyebrow">Help centre</span><h1 class="rf-h1">Help, reports & disputes</h1><p class="rf-sub">Contact the support team, report a property or raise a dispute connected to a rental application.</p>
      <section class="rf-card" style="padding:18px"><h2 class="rf-h2">Create a case</h2><form id="supportCreate" style="display:grid;gap:12px"><label>Case type<select class="ax-input" name="caseType"><option value="support">General support</option><option value="property_report">Report a property</option><option value="rental_dispute">Rental dispute</option></select></label><label>Subject<input class="ax-input" name="subject" minlength="5" maxlength="160" required></label><label id="supportPropertyWrap" hidden>Property<select class="ax-input" name="propertyId"><option value="">Choose a property</option></select></label><label id="supportApplicationWrap" hidden>Rental application<select class="ax-input" name="applicationId"><option value="">Choose an application</option></select></label><label>Describe the issue<textarea class="ax-input" name="description" minlength="10" maxlength="5000" rows="5" required></textarea></label><button class="btn primary">Submit case</button></form></section>
      <h2 class="rf-h2" style="margin-top:22px">Your cases</h2><div id="supportCaseList">${empty("Loading cases…")}</div><div id="supportCaseDetail"></div></div>`,
    async mount(root) {
      const form=$("#supportCreate",root), type=form.elements.caseType, pw=$("#supportPropertyWrap",form), aw=$("#supportApplicationWrap",form), list=$("#supportCaseList",root), detail=$("#supportCaseDetail",root);
      let props=[],apps=[];
      try{props=await listMyBackendProperties();}catch{}
      try{apps=await st.myApplications(ctx.S.user);}catch{}
      form.elements.propertyId.innerHTML='<option value="">Choose a property</option>'+props.map(p=>`<option value="${esc(p.id)}">${esc(p.title||p.area||"Property")}</option>`).join("");
      form.elements.applicationId.innerHTML='<option value="">Choose an application</option>'+apps.map(a=>`<option value="${esc(a.id)}">${esc(a.title||a.listingTitle||"Rental application")} · ${esc(a.status||"")}</option>`).join("");
      const fields=()=>{pw.hidden=type.value!=="property_report";aw.hidden=type.value!=="rental_dispute";form.elements.propertyId.required=type.value==="property_report";form.elements.applicationId.required=type.value==="rental_dispute";};
      type.addEventListener("change",fields);fields();
      const load=async()=>{try{const rows=await listBackendSupportCases();list.innerHTML=rows.length?rows.map(c=>card(`<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><b>${esc(c.subject)}</b><p class="rf-muted" style="margin:4px 0">${esc(titleCase(c.caseType))} · ${esc(date(c.updatedAt||c.createdAt))}</p></div><div>${pill(c.status)} <button class="btn" data-open-case="${esc(c.id)}">Open</button></div></div>`)).join(""):empty("You have not opened a support case yet.");}catch(e){list.innerHTML=empty(errText(e));}};
      form.addEventListener("submit",async e=>{e.preventDefault();const button=form.querySelector("button");button.disabled=true;try{await createBackendSupportCase({caseType:type.value,subject:form.elements.subject.value,description:form.elements.description.value,propertyId:form.elements.propertyId.value||undefined,applicationId:form.elements.applicationId.value||undefined});form.reset();fields();toast("Your case has been submitted.");await load();}catch(err){toast(errText(err));}finally{button.disabled=false;}});
      list.addEventListener("click",async e=>{const b=e.target.closest("[data-open-case]");if(!b)return;b.disabled=true;try{await renderCaseDetail(detail,b.dataset.openCase,false,load);}catch(err){detail.innerHTML=empty(errText(err));}finally{b.disabled=false;}});
      await load();
    }
  };
}

async function renderCaseDetail(host,id,isStaff,refresh) {
  const [result,events]=await Promise.all([getBackendSupportCase(id),listBackendSupportCaseEvents(id)]);
  const c=result.data||result, messages=result.messages||[];
  host.innerHTML=card(`<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><h2 class="rf-h2">${esc(c.subject||"Support case")}</h2>${pill(c.status)}</div><p class="rf-muted">${esc(titleCase(c.case_type||c.caseType))} · ${esc(date(c.created_at||c.createdAt))}</p><p>${esc(c.description||"")}</p><h3>Conversation</h3>${messages.map(m=>`<div style="padding:10px 0;border-bottom:1px solid var(--border)"><b>${esc(m.sender_user_id===c.created_by_user_id?"You":"Support team")}</b><p style="white-space:pre-wrap">${esc(m.body)}</p><small class="rf-muted">${esc(date(m.created_at))}</small></div>`).join("")||'<p class="rf-muted">No replies yet.</p>'}<form id="supportReply" style="display:grid;gap:8px;margin-top:14px"><label>Reply<textarea class="ax-input" name="body" rows="3" maxlength="5000" required></textarea></label><button class="btn primary">Send reply</button></form>${isStaff?'<form id="supportStaffUpdate" style="display:grid;gap:8px;margin-top:16px;border-top:1px solid var(--border);padding-top:16px"><h3>Staff update</h3><label>Status<select class="ax-input" name="status"><option value="in_review">In review</option><option value="waiting_for_user">Waiting for user</option><option value="resolved">Resolved</option><option value="closed">Closed</option><option value="open">Open</option></select></label><label>Priority<select class="ax-input" name="priority"><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option><option value="low">Low</option></select></label><label>Resolution summary (required to resolve/close)<textarea class="ax-input" name="resolution" maxlength="2000"></textarea></label><label>Reason for this update<textarea class="ax-input" name="reason" minlength="8" maxlength="500" required></textarea></label><button class="btn">Save case update</button></form>':''}<h3>Case history</h3><ul>${events.map(e=>`<li>${esc(titleCase(e.event_type||e.eventType))} · ${esc(date(e.created_at||e.createdAt))}${e.reason?" — "+esc(e.reason):""}</li>`).join("")}</ul>`);
  $("#supportReply",host).addEventListener("submit",async e=>{e.preventDefault();const form=e.currentTarget,b=form.querySelector("button");b.disabled=true;try{await sendBackendSupportMessage(id,form.elements.body.value);await renderCaseDetail(host,id,isStaff,refresh);await refresh();toast("Reply sent.");}catch(err){toast(errText(err));b.disabled=false;}});
  const staffForm=$("#supportStaffUpdate",host);
  if(staffForm)staffForm.addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget,b=f.querySelector("button");b.disabled=true;const status=f.elements.status.value,changes={status,priority:f.elements.priority.value,reason:f.elements.reason.value,...(["resolved","closed"].includes(status)?{resolution:f.elements.resolution.value}:{})};try{await updateBackendSupportCase(id,changes);await renderCaseDetail(host,id,true,refresh);await refresh();toast("Case updated.");}catch(err){toast(errText(err));b.disabled=false;}});
}

export function supportAdminPage(ctx) {
  return {
    title: "Support case queue",
    html: `<div class="rf" style="max-width:1100px;margin:0 auto;padding:24px 16px"><span class="rf-eyebrow">Staff console</span><h1 class="rf-h1">Support & disputes</h1><p class="rf-sub">Triage support requests, property reports and rental disputes. Case history is visible only to the reporter and authorised support staff.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><select class="ax-input" id="supportQueueStatus"><option value="">All statuses</option><option value="open">Open</option><option value="in_review">In review</option><option value="waiting_for_user">Waiting for user</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select><button class="btn" id="supportQueueRefresh">Refresh</button></div><div id="supportQueue" style="margin-top:14px">${empty("Loading support cases…")}</div><div id="supportAdminDetail"></div></div>`,
    async mount(root) {
      const queue=$("#supportQueue",root),detail=$("#supportAdminDetail",root),filter=$("#supportQueueStatus",root);
      const load=async()=>{try{const rows=await listBackendAdminSupportCases({status:filter.value||undefined});queue.innerHTML=rows.length?rows.map(c=>card(`<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><b>${esc(c.subject)}</b><p class="rf-muted" style="margin:4px 0">${esc(titleCase(c.case_type))} · ${esc(c.created_by_user_id)}</p><small>${esc(date(c.created_at))}</small></div><div>${pill(c.status)} <button class="btn" data-staff-case="${esc(c.id)}">Open case</button></div></div>`)).join(""):empty("No support cases in this queue.");}catch(e){queue.innerHTML=empty(errText(e));}};
      $("#supportQueueRefresh",root).addEventListener("click",load);filter.addEventListener("change",load);
      queue.addEventListener("click",async e=>{const b=e.target.closest("[data-staff-case]");if(!b)return;b.disabled=true;try{await renderCaseDetail(detail,b.dataset.staffCase,true,load);}catch(err){detail.innerHTML=empty(errText(err));}finally{b.disabled=false;}});
      await load();
    }
  };
}
