// Private identity verification and property-ownership evidence.
// Document contents are held in Firebase Storage; only private object paths are saved in Firestore.
import { auth, db, storage } from "./firebase.js";
import { $, esc, icon, toast } from "./ui.js";
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { ref, uploadBytes, getBlob, deleteObject } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

const MAX_FILE = 8 * 1024 * 1024;
const ACCEPT = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const fileProblem = (file, label) => !file ? label + " is required." : !ACCEPT.has(file.type) ? label + " must be a PDF, JPEG, PNG or WebP file." : file.size <= 0 || file.size > MAX_FILE ? label + " must be a non-empty file no larger than 8 MB." : "";
const statusName = (s) => ({ approved: "Verified", pending: "Under review", rejected: "Needs changes" })[s] || "Not submitted";
const statusClass = (s) => s === "approved" ? "ok" : s === "rejected" ? "bad" : "warn";
const isAdmin = (path) => typeof path === "string" && (path.startsWith("verification-docs/") || path.startsWith("property-ownership/"));
function validPrivatePath(path) {
  return typeof path === "string" && (/^verification-docs\/[^/]+\/(identity|address|professional)$/.test(path) || /^property-ownership\/[^/]+\/[^/]+\/proof$/.test(path));
}
async function uploadPrivate(path, file, purpose, uid) {
  const problem = fileProblem(file, purpose);
  if (problem) throw new Error(problem);
  await uploadBytes(ref(storage, path), file, {
    contentType: file.type,
    cacheControl: "private, no-store, max-age=0",
    customMetadata: { ownerUid: uid, purpose }
  });
  return path;
}
export async function getIdentityVerification(uid) {
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, "identityVerifications", uid));
    return snap.exists() ? { ...snap.data(), id: snap.id } : null;
  } catch { return null; }
}
export async function uploadPropertyOwnershipProof(uid, listingId, file) {
  if (!uid || !listingId) throw new Error("Sign in before uploading ownership proof.");
  return uploadPrivate("property-ownership/" + uid + "/" + listingId + "/proof", file, "property ownership proof", uid);
}
export async function removePrivateDocument(path) {
  if (!validPrivatePath(path)) return;
  try { await deleteObject(ref(storage, path)); } catch {}
}
export async function openPrivateDocument(path, label) {
  if (!validPrivatePath(path)) { toast("This private document path is missing or invalid.", { tone: "bad" }); return false; }
  const popup = window.open("about:blank", "_blank");
  if (!popup) { toast("Allow pop-ups to securely preview the document.", { tone: "bad" }); return false; }
  try {
    popup.document.title = label || "Private verification document";
    popup.document.body.innerHTML = "<p style='font:16px system-ui;padding:24px'>Loading private document…</p>";
    const blob = await getBlob(ref(storage, path));
    const url = URL.createObjectURL(blob);
    popup.location.replace(url);
    window.setTimeout(() => URL.revokeObjectURL(url), 30 * 60 * 1000);
    return true;
  } catch (error) {
    try { popup.close(); } catch {}
    console.error("Private document preview failed", error);
    toast("We couldn’t open this private document. Check Storage access and security rules.", { tone: "bad" });
    return false;
  }
}
export async function reviewIdentityVerification(uid, status, reviewNote, reviewedBy) {
  if (!["approved", "rejected"].includes(status)) throw new Error("Choose approve or reject.");
  await updateDoc(doc(db, "identityVerifications", uid), {
    status,
    reviewNote: String(reviewNote || "").slice(0, 500),
    reviewedAt: serverTimestamp(),
    reviewedBy
  });
}
function banner(v) {
  if (!v) return '<div class="iv-status" data-status="missing"><span class="iv-status-ic">' + icon("shield", 21, 1.8) + '</span><div><b>Verification required</b><p>Submit your government-issued ID and proof of address before you post a property. The documents are reviewed privately.</p></div></div>';
  if (v.status === "approved") return '<div class="iv-status" data-status="approved"><span class="iv-status-ic">' + icon("check", 21, 1.8) + '</span><div><b>Your identity is verified</b><p>Your identity and address documents have been reviewed. Every property still needs its own ownership evidence before it can be marked verified.</p></div></div>';
  if (v.status === "rejected") return '<div class="iv-status" data-status="rejected"><span class="iv-status-ic">' + icon("info", 21, 1.8) + '</span><div><b>Updated documents are needed</b><p>' + esc(v.reviewNote || "Please submit clear, current files.") + '</p></div></div>';
  return '<div class="iv-status" data-status="pending"><span class="iv-status-ic">' + icon("clock", 21, 1.8) + '</span><div><b>Your documents are under review</b><p>Listing creation stays locked until the Faxton team approves this submission.</p></div></div>';
}
export async function verificationPage(ctx) {
  const user = ctx.S.user, profile = ctx.S.profile || {}, role = profile.role || ctx.S.role;
  if (!["landlord", "agent", "agency"].includes(role)) {
    return { title: "Identity verification", html: '<div class="rf rf-in"><section class="rf-card"><h1>Identity verification</h1><p>This workflow is for home owners, agents and agencies that want to publish properties.</p><a class="btn" href="#/">Back to home</a></section></div>' };
  }
  let current = await getIdentityVerification(user.uid);
  const editable = !current || current.status === "rejected";
  const proBody = current && current.professionalBody || "not-applicable";
  const proNumber = current && current.professionalNumber || "";
  const html = '<div class="rf rf-in iv-page">' +
    '<header class="rf-ph"><div><span class="rf-eyebrow">Account trust &amp; safety</span><h1 class="rf-h1">Identity verification</h1><p class="rf-sub">A private review of your identity, address and relevant professional credentials.</p></div><div class="rf-ph-a"><span class="rf-pill ' + statusClass(current && current.status) + '"><i></i>' + statusName(current && current.status) + '</span></div></header>' +
    banner(current) +
    '<div class="iv-grid"><section class="rf-card iv-card"><div class="rf-card-h"><div><h3>Documents we need</h3><p>Only you and authorised Faxton reviewers can access the files.</p></div></div>' +
    '<ul class="iv-checks"><li>' + icon("check-circle", 18, 1.8) + ' Government-issued photo ID</li><li>' + icon("check-circle", 18, 1.8) + ' Proof of your current address</li><li>' + icon("check-circle", 18, 1.8) + ' Relevant professional registration, if applicable</li></ul>' +
    '<p class="iv-note">Accepted files: PDF, JPEG, PNG or WebP, up to 8 MB each. Only submit documents you have the right to share.</p></section>' +
    '<section class="rf-card iv-card"><div class="rf-card-h"><div><h3>' + (editable ? (current ? "Resubmit documents" : "Submit your documents") : "Submitted details") + '</h3><p>' + esc(role) + ' · ' + esc(user.email || "") + '</p></div></div>' +
    (editable ?
      '<form id="ivForm" class="iv-form" novalidate>' +
      '<label class="iv-field"><span>ID document type</span><select name="identityType" required><option value="national-id" ' + ((current && current.identityType) === "national-id" ? "selected" : "") + '>National ID / NIN card</option><option value="passport" ' + ((current && current.identityType) === "passport" ? "selected" : "") + '>Passport</option><option value="drivers-license" ' + ((current && current.identityType) === "drivers-license" ? "selected" : "") + '>Driver’s licence</option></select></label>' +
      '<label class="iv-field"><span>Government-issued ID file</span><input name="identityFile" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" required><small data-file-name="identityFile">No file selected · maximum 8 MB.</small></label>' +
      '<label class="iv-field"><span>Proof of address</span><input name="addressFile" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" required><small data-file-name="addressFile">Utility bill, tax notice or another recent document showing your name and address.</small></label>' +
      '<div class="iv-divider"></div><label class="iv-field"><span>Professional registration (where applicable)</span><select name="professionalBody"><option value="not-applicable" ' + (proBody === "not-applicable" ? "selected" : "") + '>Not applicable / no regulated credential</option><option value="ESVARBON" ' + (proBody === "ESVARBON" ? "selected" : "") + '>ESVARBON — Estate Surveyors &amp; Valuers</option><option value="NIESV" ' + (proBody === "NIESV" ? "selected" : "") + '>NIESV membership</option><option value="other" ' + (proBody === "other" ? "selected" : "") + '>Other professional body</option></select><small>ESVARBON applies to registered Estate Surveyors and Valuers; it is not treated as a universal licence for every property agent. Claimed credentials are manually checked against the relevant official registry.</small></label>' +
      '<label class="iv-field"><span>Registration / licence number (if applicable)</span><input name="professionalNumber" maxlength="80" value="' + esc(proNumber) + '" placeholder="Enter the registration number"></label>' +
      '<label class="iv-field"><span>Professional evidence (if applicable)</span><input name="professionalFile" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"><small data-file-name="professionalFile">Required when you select a professional body.</small></label>' +
      '<label class="iv-consent"><input type="checkbox" name="consent" required><span>I confirm these documents are genuine and may be reviewed by authorised Faxton staff for verification.</span></label>' +
      '<p class="iv-error" id="ivError" role="alert" aria-live="polite"></p><button type="submit" class="btn primary" id="ivSubmit">' + icon("shield-check", 18) + ' Submit for review</button></form>'
      : '<dl class="iv-details"><div><dt>ID document type</dt><dd>' + esc(current.identityType || "—") + '</dd></div><div><dt>Professional body</dt><dd>' + esc(current.professionalBody || "Not applicable") + '</dd></div><div><dt>Submitted</dt><dd>' + (current.submittedAt && current.submittedAt.toDate ? current.submittedAt.toDate().toLocaleDateString("en-GB") : "Recently") + '</dd></div></dl><p class="iv-note">' + (current.status === "approved" ? "Your identity review is complete. Contact Faxton support if the record needs correcting." : "You can submit corrected files when the review team asks for changes.") + '</p>') +
    '</section></div>' +
    '<section class="rf-card iv-card iv-ownership"><div class="rf-card-h"><div><h3>Property ownership is checked separately</h3><p>Account verification does not prove ownership of every home.</p></div></div><p>Each property requires its own private evidence, such as a title document, relevant utility/tax record or property-management authorisation. Reviewers must inspect it before a listing can be marked verified and published.</p></section></div>';
  return {
    title: "Identity verification", role: role, html,
    mount(root) {
      const form = $("#ivForm", root);
      if (!form) return;
      ["identityFile", "addressFile", "professionalFile"].forEach((name) => {
        const input = form.elements.namedItem(name);
        input.addEventListener("change", () => {
          const out = form.querySelector('[data-file-name="' + name + '"]'), f = input.files && input.files[0];
          if (out) out.textContent = f ? f.name + " · " + (f.size / 1024 / 1024).toFixed(2) + " MB" : "No file selected · maximum 8 MB.";
        });
      });
      form.onsubmit = async (event) => {
        event.preventDefault();
        const button = $("#ivSubmit", root), err = $("#ivError", root);
        const identityFile = form.elements.namedItem("identityFile").files && form.elements.namedItem("identityFile").files[0];
        const addressFile = form.elements.namedItem("addressFile").files && form.elements.namedItem("addressFile").files[0];
        const professionalFile = form.elements.namedItem("professionalFile").files && form.elements.namedItem("professionalFile").files[0];
        const identityType = form.elements.namedItem("identityType").value;
        const professionalBody = form.elements.namedItem("professionalBody").value;
        const professionalNumber = form.elements.namedItem("professionalNumber").value.trim();
        err.textContent = "";
        let problem = fileProblem(identityFile, "Government-issued ID") || fileProblem(addressFile, "Proof of address");
        if (!problem && professionalBody !== "not-applicable") {
          if (!professionalNumber) problem = "Enter your professional registration number, or choose “Not applicable” if you do not hold a regulated credential.";
          else problem = fileProblem(professionalFile, "Professional registration evidence");
        }
        if (!problem && !form.elements.namedItem("consent").checked) problem = "Please confirm that your submission is accurate and may be reviewed.";
        if (problem) { err.textContent = problem; return; }
        button.disabled = true; button.classList.add("is-busy");
        try {
          const identityPath = "verification-docs/" + user.uid + "/identity";
          const addressPath = "verification-docs/" + user.uid + "/address";
          await uploadPrivate(identityPath, identityFile, "identity", user.uid);
          await uploadPrivate(addressPath, addressFile, "address", user.uid);
          let professionalPath = "";
          if (professionalBody !== "not-applicable") {
            professionalPath = "verification-docs/" + user.uid + "/professional";
            await uploadPrivate(professionalPath, professionalFile, "professional", user.uid);
          } else await removePrivateDocument("verification-docs/" + user.uid + "/professional");
          const data = {
            uid: user.uid, role: role, identityType: identityType,
            identityPath: identityPath, addressPath: addressPath,
            country: String(profile.country || "Nigeria").slice(0, 60),
            professionalBody: professionalBody,
            professionalNumber: professionalBody === "not-applicable" ? "" : professionalNumber,
            professionalPath: professionalPath, status: "pending",
            submittedAt: serverTimestamp(), updatedAt: serverTimestamp()
          };
          await setDoc(doc(db, "identityVerifications", user.uid), data);
          import("./store.js").then((st) => st.notify(user.uid, { kind: "info", title: "Identity documents submitted", body: "Faxton received your private verification documents. Listing creation stays locked until review." })).catch(() => {});
          toast("Your documents were submitted privately for review.");
          ctx.render();
        } catch (error) {
          console.error("Identity verification submission failed", error);
          err.textContent = /permission-denied/.test(error.code || "") ? "We couldn’t save this submission. Check that Storage and the latest security rules are enabled, then try again." : error.message || "We couldn’t submit your documents. Please try again.";
          button.disabled = false; button.classList.remove("is-busy");
        }
      };
    }
  };
}
