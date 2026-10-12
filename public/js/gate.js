// New accounts must confirm their email before they can use the app: Firebase mails a verification link, and this screen waits for it.
import { auth } from "./firebase.js";
import { $, esc, icon, toast, logoMark } from "./ui.js";
import { errText } from "./authkit.js";

const CUTOFF = Date.parse("2026-10-09T00:00:00Z"); // accounts made before this keep working as they did
export const needsVerify = (u) => !!u && !u.emailVerified && u.providerData.some((p) => p.providerId === "password") && Date.parse(u.metadata?.creationTime || 0) >= CUTOFF;

export function verifyView(ctx) {
  const email = ctx.S.user.email || "", dom = email.split("@")[1]?.toLowerCase() || "";
  const inbox = /^(gmail|googlemail)\.com$/.test(dom) ? ["Open Gmail", "https://mail.google.com/"] : /^(outlook|hotmail|live|msn)\./.test(dom) ? ["Open Outlook", "https://outlook.live.com/mail/"] : /^yahoo\./.test(dom) ? ["Open Yahoo Mail", "https://mail.yahoo.com/"] : null;
  return { full: true, title: "Verify your email", html: `<div class="vg"><main class="vg-card"><span class="vg-logo"><span class="logo-svg-wrap">${logoMark()}</span><span class="logo-word"><b>Faxton</b> Rentals</span></span><span class="vg-ic">${icon("mail", 30, 1.5)}</span><h1>Check your email</h1>
    <p>We sent a verification link to <b>${esc(email)}</b>.</p>
    <ol class="vg-steps"><li><i>1</i><span>Open the email from Faxton Rentals.</span></li><li><i>2</i><span>Tap the verification link, then come back here.</span></li></ol>
    ${inbox ? `<a class="vg-mail" href="${inbox[1]}" target="_blank" rel="noopener">${inbox[0]} ${icon("arrow", 16, 1.9)}</a>` : ""}
    <p class="vg-msg" id="vgMsg" role="status" aria-live="polite">Waiting for you to confirm…</p>
    <div class="vg-act"><button class="btn primary" id="vgDone">${icon("check", 18)} I’ve verified</button><button class="btn" id="vgResend">Resend the email</button></div>
    <p class="vg-small">Can’t find it? Look in your spam or promotions folder.</p>
    <button class="vg-link" id="vgOut">Use a different email</button></main></div>`,
  mount() {
    const msg = $("#vgMsg"); let busy = false, cool = 0, timer = 0;
    const say = (t, bad) => { msg.textContent = t; msg.classList.toggle("bad", !!bad); };
    const check = async (loud) => {
      if (busy) return; busy = true;
      try { await auth.currentUser.reload(); if (auth.currentUser.emailVerified) { clearInterval(poll); await ctx.refreshUser(); toast("Email verified. Welcome!"); return; } if (loud) say("Not verified yet. Open the link in the email first.", true); }
      catch (e) { if (loud) say(errText(e), true); } finally { busy = false; }
    };
    const poll = setInterval(() => check(false), 4000), onVis = () => { if (!document.hidden) check(false); };
    document.addEventListener("visibilitychange", onVis);
    ctx.S.cleanups.push(() => { clearInterval(poll); clearInterval(timer); document.removeEventListener("visibilitychange", onVis); });
    $("#vgDone").onclick = () => check(true);
    const rs = $("#vgResend");
    rs.onclick = async () => {
      if (cool) return; rs.disabled = true;
      try { await ctx.resendVerification(); say("Sent. Check your inbox."); cool = 60; timer = setInterval(() => { cool--; rs.textContent = cool > 0 ? `Resend in ${cool}s` : "Resend the email"; if (cool <= 0) { clearInterval(timer); rs.disabled = false; } }, 1000); rs.textContent = "Resend in 60s"; }
      catch (e) { say(errText(e), true); rs.disabled = false; }
    };
    $("#vgOut").onclick = async () => { await ctx.logout(); ctx.go("#/signup"); };
  } };
}
