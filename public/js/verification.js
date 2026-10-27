// KYC and property-proof workflow. Documents are private and admins make all verification decisions.
import { $, esc, icon, toast, naira } from "./ui.js";
import * as st from "./store.js";
import { shrinkImage, readSmallFile } from "./fx.js";

const roles=["landlord","agent","agency"];
const regs=[["not-applicable","Not applicable"],["ESVARBON","ESVARBON (Nigeria, where applicable)"],["PPRA","PPRA (South Africa, where applicable)"],["other","Other local regulator"]];
const proofs=[["land-title","Land title / deed / certificate"],["utility-bill","Utility bill matching the property address"],["tax-receipt","Property tax receipt"],["other-official","Other official property document"]];
const options=(list,value)=>list.map(([k,label])=>`<option value="${{k}" ${{value===k?"selected":""}>${{label}</option>`).join("");
const pill=(s)=>`<span class="rf-vstatus ${{s==="verified"?"ok":s==="rejected"?"bad":"pending"}">${{s==="verified"?"Verified":s==="rejected"?"Changes needed":s==="pending"?"In review":"Not submitted"}</span>`;
const fileField=(id,title,help)=>`<label class="rf-fl">${{title}<span class="rf-help">${{help}</span><input id="${{id}" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required><span class="rf-vfile" id="${{id}Name">No document selected</span></label>`;
function errorText(e){if(String(e?.code||"").includes("permission-denied"))return "Faxton could not save this submission. Check the selected document and try again.";if(e?.userMessage)return e.userMessage;return navigator.onLine?"We could not finish this submission. Check your connection and try again.":"You appear to be offline. Reconnect and try again."}
async function pack(file){
 if(!file)throw Object.assign(new Error("missing"),{userMessage:"Choose all required documents."});
 const pdf=file.type==="application/pdf";
 if(!pdf&&!/^image\/(jpeg|png|webp)$/i.test(file.type))throw Object.assign(new Error("type"),{userMessage:"Choose a JPG, PNG, WebP image or PDF."});
 const data=pdf?await readSmallFile(file,360000):await shrinkImage(file,{max:1400,bytes:360000});
 if(data.length>=680000)throw Object.assign(new Error("large"),{userMessage:"That file is too large after compression. Choose a smaller file."});
 return {data,contentType:pdf?"application/pdf":"image/jpeg",name:String(file.name||"document").slice(0,150),size:data.length};
}
const verified=(p)=>p?.verified===true&&p?.verification?.status==="verified";

export async function verificationPage(ctx){
 const uid=ctx.S.user.uid,profile=ctx.S.profile||await st.getProfile(uid)||{},role=ctx.S.role||profile.role||"renter";
 if(!roles.includes(role))return{title:"Identity & property verification",html:`<div class="rf"><header class="rf-ph"><div><span class="rf-eyebrow">Trust & safety</span><h1 class="rf-h1">Identity & property verification</h1><p class="rf-sub">This check is for property owners, agents and agencies.</p></div></header><div class="rf-card"><h2>This account does not post listings</h2><p class="rf-muted">Renter accounts do not need landlord or agent KYC documents. If your account type is wrong, contact support.</p><a class="btn" href="#/help">Contact support</a></div></div>`};
 const listings=await st.ownedDocs("listings",uid).catch(()=>[]),v=profile.verification||{},isVerified=verified(profile),state=v.status||"not-submitted";
 const banner=`<div class="rf-note ${{state==="rejected"?"warn":"info"}">${{icon(isVerified?"check":"shield",20)}<div><b>${{isVerified?"Identity verified":state==="rejected"?"Changes needed":"Identity verification required"}</b><p>${{state==="rejected"?esc(v.reason||"Review the note and submit updated documents."):isVerified?"Your identity and address were approved. Each property needs a separate ownership review.":"Submit government-issued ID and proof of address. Uploading documents does not make you verified."}</p></div></div>`;
 const propertyCard=(l)=>{
  const ov=l.ownershipVerification||{},s=ov.status||"not-submitted";
  return `<article class="rf-card rf-vproperty" data-property="${{esc(l.id)}"><div class="rf-vproperty-head"><div><h3>${{esc(l.title||"Untitled property")}</h3><p>${{esc([l.area,l.city].filter(Boolean).join(", ")||"Address not set")}</p><span class="rf-vmeta">${{naira(l.price)} / year</span></div>${{pill(s)}</div>
   ${{ov.reason?`<p class="rf-vreason">Review note: ${{esc(ov.reason)}</p>`:""}
   ${{s==="verified"?`<div class="rf-note info">${{icon("check",18)}<div><b>Ownership proof reviewed</b><p>The Faxton team approved the evidence for this property.</p></div></div>`:isVerified?`<form class="rf-form rf-own-form" data-own-form="${{esc(l.id)}" novalidate><label class="rf-fl">Proof type<select data-proof-type>${{options(proofs,ov.proofType||"land-title")}</select></label>${{fileField("own-file-"+l.id,"Property ownership proof","Land title/deed, address-matched utility bill, tax receipt or other official evidence.")}<p class="rf-verror" role="alert"></p><div class="rf-actions"><button class="btn primary" type="submit" data-submit-owner="${{esc(l.id)}">${{icon("upload",17)} Submit for review</button></div></form>`:`<div class="rf-note warn">${{icon("lock",18)}<div><b>Verify your account first</b><p>Once identity and address are approved, you can submit ownership evidence for this property.</p></div></div>`}
  </article>`;
 };
 const html=`<div class="rf rf-verification"><header class="rf-ph"><div><span class="rf-eyebrow">Trust & safety</span><h1 class="rf-h1">Identity & property verification</h1><p class="rf-sub">Private identity review and separate ownership checks for each listing.</p></div></header>
  ${{banner}<div class="rf-grid rf-verification-grid"><section class="rf-col">
   <form id="rfKycForm" class="rf-card rf-form" novalidate><div class="rf-card-h"><div><h2>1. Verify your identity</h2><p>Required before you can post new property listings.</p></div>${{pill(isVerified?"verified":state)}</div>
    <div class="rf-note">${{icon("lock",18)}<div><b>Private document review</b><p>Documents are visible only to you and authorised Faxton administrators. Do not upload bank-card details or unrelated documents.</p></div></div>
    <label class="rf-fl">Government-issued ID type<select id="rfIdType" required><option value="">Choose ID type</option><option value="national-id" ${{v.idType==="national-id"?"selected":""}>National identity card</option><option value="passport" ${{v.idType==="passport"?"selected":""}>Passport</option><option value="drivers-license" ${{v.idType==="drivers-license"?"selected":""}>Driver’s licence</option></select></label>
    ${{fileField("rfIdFile","Government-issued ID","A clear image or PDF showing identifying details.")}${{fileField("rfAddressFile","Proof of address","A recent utility bill or other official proof matching your address.")}
    <hr class="rf-hr"><div><h3>Professional registration <span class="rf-optl">(when applicable)</span></h3><p class="rf-muted">Checks are manual for now; an automatic official registry lookup is not connected.</p></div>
    <label class="rf-fl">Registration body<select id="rfRegBody">${{options(regs,v.professionalBody||"not-applicable")}</select></label>
    <label class="rf-fl">Registration / licence number <span class="rf-help">Required if you choose a regulator.</span><input id="rfRegNumber" maxlength="100" value="${{esc(v.professionalNumber||"")}" placeholder="Registration number" autocomplete="off"></label>
    ${{fileField("rfProfessionalFile","Registration certificate / licence","Optional supporting file if your regulator issues one.")}
    <p class="rf-verror" id="rfKycError" role="alert"></p><div class="rf-actions"><button type="submit" class="btn primary" id="rfKycSubmit">${{icon("shield",18)} Submit identity documents</button></div>
   </form>
   <section class="rf-card"><div class="rf-card-h"><div><h2>2. Verify property ownership</h2><p>Each listing is reviewed separately.</p></div></div><div class="rf-note">${{icon("fileCheck",20)}<div><b>Acceptable evidence</b><p>Land titles/deeds, utilities matching the property address, tax receipts or other official property documents. A document upload never auto-approves a listing.</p></div></div><div class="rf-vproperties">${{listings.length?listings.map(propertyCard).join(""):`<div class="rf-vempty"><span>${{icon("home",25)}</span><b>No owned listings yet</b><p>Your owned listings will appear here for ownership review.</p><a class="btn" href="${{role==="agent"?"#/agent-dashboard/listings":role==="agency"?"#/agency":"#/portfolio"}">Open your dashboard</a></div>`}</div></section>
  </section><aside class="rf-col"><section class="rf-card"><h2>What happens next?</h2><ol class="rf-vsteps"><li><span>1</span><div><b>Submit your documents</b><p>ID and proof of address.</p></div></li><li><span>2</span><div><b>Identity review</b><p>Faxton reviews documents and applicable professional details.</p></div></li><li><span>3</span><div><b>Property evidence</b><p>Submit separate proof for each property.</p></div></li><li><span>4</span><div><b>Ownership review</b><p>The badge appears only after approval.</p></div></li></ol></section><section class="rf-card"><h3>Important</h3><p class="rf-muted">Requirements differ by jurisdiction. Regulator checks are manual for now. No automatic official registry lookup is connected yet.</p></section></aside></div></div>`;

 return{title:"Identity & property verification",html,mount(root){
  const form=$("#rfKycForm",root),error=$("#rfKycError",root),submit=$("#rfKycSubmit",root);
  const show=(el,t)=>{if(el)el.textContent=t||"";},getFile=(id)=>$("#"+id,root)?.files?.[0]||null;
  ["rfIdFile","rfAddressFile","rfProfessionalFile",...listings.map(l=>"own-file-"+l.id)].forEach(id=>$("#"+id,root)?.addEventListener("change",()=>{const label=$("#"+id+"Name",root),input=$("#"+id,root);if(label)label.textContent=input.files?.[0]?.name||"No document selected";}));
  form.onsubmit=async(e)=>{
   e.preventDefault();show(error,"");const idType=$("#rfIdType",root).value,body=$("#rfRegBody",root).value,number=$("#rfRegNumber",root).value.trim();
   if(!idType)return show(error,"Choose your ID type.");
   if(!getFile("rfIdFile")||!getFile("rfAddressFile"))return show(error,"Upload both your government-issued ID and proof of address.");
   if(body!=="not-applicable"&&!number)return show(error,"Enter the registration number or choose Not applicable.");
   submit.disabled=true;submit.classList.add("is-busy");
   try{
    const identity=await pack(getFile("rfIdFile")),address=await pack(getFile("rfAddressFile"));
    const identityDocId=await st.addVerificationFile(ctx.S.user,{...identity,purpose:"identity",label:idType});
    const addressDocId=await st.addVerificationFile(ctx.S.user,{...address,purpose:"address",label:"proof-of-address"});
    let professionalDocId="";if(getFile("rfProfessionalFile"))professionalDocId=await st.addVerificationFile(ctx.S.user,{...await pack(getFile("rfProfessionalFile")),purpose:"professional",label:body});
    const verification={status:"pending",kind:role,requestedAt:Date.now(),idType,identityDocId,addressDocId,professionalBody:body,professionalNumber:number,...(professionalDocId?{professionalDocId}:{})};
    await st.saveProfile(uid,{verified:false,verification});
    await st.syncPublic(uid,{name:profile.name||ctx.S.user.displayName||"User",role,photo:profile.photo||"",city:profile.city||"",verified:false});
    ctx.S.profile={...ctx.S.profile,verified:false,verification};toast("Identity documents submitted for review.");ctx.render();
   }catch(x){show(error,errorText(x));}finally{submit.disabled=false;submit.classList.remove("is-busy");}
  };
  root.querySelectorAll("[data-own-form]").forEach(form0=>form0.addEventListener("submit",async(e)=>{
   e.preventDefault();const listingId=form0.dataset.ownForm,listing=listings.find(l=>l.id===listingId),input=$("input[type=file]",form0),type=$("[data-proof-type]",form0).value,button=$("[data-submit-owner]",form0),feedback=$(".rf-verror",form0);
   if(!listing||!input?.files?.[0])return show(feedback,"Choose a property document to submit.");
   show(feedback,"");button.disabled=true;
   try{const documentId=await st.addVerificationFile(ctx.S.user,{...await pack(input.files[0]),purpose:"ownership",proofType:type,listingId});
    const ownershipVerification={status:"pending",documentId,proofType:type,submittedAt:Date.now()};
    await st.patch("listings",listingId,{ownershipVerification});listing.ownershipVerification=ownershipVerification;toast("Property proof submitted for review.");ctx.render();
   }catch(x){show(feedback,errorText(x));}finally{button.disabled=false;}
  }));
 }};
}
