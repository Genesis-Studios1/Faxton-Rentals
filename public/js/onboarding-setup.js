// Required setup after account creation. Verification files stay in private Storage; Firestore stores metadata only.
import { $, $$, esc, icon, toast } from "./ui.js";
import { db, storage } from "./firebase.js";
import { doc, updateDoc, setDoc, getDoc, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { ref as storageRef, uploadBytes, deleteObject } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";
import { locFields, mountLoc, resFields } from "./loc.js";

const BUSINESS_TYPES = [["real-estate","Real estate company"],["electricals","Electricals"],["home-automation","Home automation"],["plumbing","Plumbing"],["tiling","Tiling"],["painting","Painting"],["appliance-repair","Home appliance repair"],["other","Other"]];
const SOURCES = ["Instagram","TikTok","X","Facebook","Google Search","WhatsApp","Friend or family","Real estate agent","Event or outdoor advert","Other"];
const MAX_FILE = 10 * 1024 * 1024;
const MIME = new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
const EMAIL_RE = /^[^@\s]+@[^@\s]+\\.[^@\s]+$/;
const digits = (s) => String(s || "").replace(/\D/g,"");
const safeName = (s) => String(s || "document").normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/^-+|-+$/g,"").slice(-90) || "document";
const age = (iso) => { const d=new Date(iso); if(!iso || Number.isNaN(+d)) return 0; const n=new Date(); let a=n.getFullYear()-d.getFullYear(); if(n<new Date(n.getFullYear(),d.getMonth(),d.getDate()))a--; return a; };
const value = (root,id) => root.querySelector("#"+CSS.escape(id))?.value?.trim() || "";
const field = (id,label,o={}) => {
  const type=o.type||"text", placeholder=o.placeholder||"", required=o.required!==false, val=o.value||"", attrs=o.attrs||"";
  return '<label class="os-field" for="'+id+'"><span>'+label+(required?' <i aria-hidden="true">*</i>':' <small>Optional</small>')+'</span><input class="os-input" id="'+id+'" name="'+id+'" type="'+type+'" placeholder="'+esc(placeholder)+'" value="'+esc(val)+'" '+(required?"required":"")+' '+attrs+'></label>';
};
const select = (id,label,options,selected="") => '<label class="os-field" for="'+id+'"><span>'+label+' <i aria-hidden="true">*</i></span><select class="os-input" id="'+id+'" name="'+id+'" required>'+options.map(x=>'<option value="'+esc(x)+'" '+(x===selected?"selected":"")+'>'+esc(x||"Choose one")+'</option>').join("")+'</select></label>';
const docField = (id,title,help,required=true) => '<label class="os-doc" for="doc-'+id+'"><span class="os-doc-ic">'+icon("fileCheck",21,1.8)+'</span><span class="os-doc-text"><b>'+title+(required?' <i>*</i>':' <small>Optional</small>')+'</b><small>'+help+'</small><span class="os-file-name" id="file-name-'+id+'">PDF, JPG, PNG or WEBP · max 10 MB</span></span><span class="os-file-btn">Choose file</span><input class="os-file-input" id="doc-'+id+'" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" data-doc="'+id+'" '+(required?"required":"")+'></label>';
const typesMarkup = (selected=[]) => '<fieldset class="os-field os-types"><legend>What type of business do you run? <i>*</i></legend><p class="os-help">Select all that apply.</p><div class="os-type-grid">'+BUSINESS_TYPES.map(([id,label])=>'<label class="os-type"><input type="checkbox" name="businessTypes" value="'+id+'" '+(selected.includes(id)?"checked":"")+'><span>'+esc(label)+'</span></label>').join("")+'</div><div id="osTypeOtherWrap" '+(selected.includes("other")?"":"hidden")+'>'+field("businessTypeOther","Describe your business",{required:selected.includes("other"),placeholder:"e.g. Roofing and waterproofing"})+'</div></fieldset>';

export function setupPage(ctx) {
  const profile=ctx.S.profile||{}, user=ctx.S.user;
  if(!user){ctx.go("#/signup");return null;}
  const role=["renter","landlord","agent","agency"].includes(profile.role)?profile.role:"renter";
  const agency=profile.agency||{}, agent=profile.agentInfo||{}, verifying=role!=="renter";
  const roleLabel={renter:"Renter",landlord:"Home owner",agent:"Real estate agent",agency:"Business"}[role];
  const sourceOptions=["",...SOURCES];
  let html='<div class="os-page"><header class="os-header"><a class="os-brand" href="#/" aria-label="Faxton Rentals"><span class="os-mark">F</span><span><b>Faxton</b> Rentals</span></a><span class="os-step">ACCOUNT SETUP <b>01 / 01</b></span></header><main class="os-main" aria-labelledby="os-title"><div class="os-intro"><span class="os-eyebrow">'+icon("shieldCheck",16,2)+' PERSONALISE YOUR EXPERIENCE</span><h1 id="os-title">Let’s get you set up.</h1><p>Just a few details to tailor Faxton Rentals to you. You can review them later in your profile.</p><div class="os-progress" aria-hidden="true"><span></span></div></div><form class="os-form" id="os-form" novalidate>';
  html+='<section class="os-section"><div class="os-section-head"><span class="os-section-no">01</span><div><h2>A little about you</h2><p>Tell us how you found Faxton and where you’re based.</p></div></div><div class="os-grid">'+select("os-source","How did you hear about us?",sourceOptions)+'<div id="osSourceOtherWrap" hidden>'+field("os-source-other","Where did you hear about us?",{required:false,placeholder:"Tell us where"})+'</div></div><div class="os-location"><h3>Your location</h3><p class="os-help">We use this to show relevant homes and service providers. We don’t track your device location.</p>'+locFields({style:"field",flow:true,ids:{country:"os-country",state:"os-state",lga:"os-lga"},country:profile.country||"Nigeria",state:profile.state||"",lga:profile.lga||""})+'</div></section>';
  if(role==="agency"){
    html+='<section class="os-section"><div class="os-section-head"><span class="os-section-no">02</span><div><h2>Business details</h2><p>These help us identify the company and route customers to the right team.</p></div></div>'+typesMarkup(agency.businessTypes||[])+'<div class="os-grid">'+field("os-business","Registered business name",{placeholder:"e.g. Faxton Properties Ltd",value:agency.business||""})+field("os-cac","CAC registration number",{placeholder:"e.g. RC 1234567",value:agency.cac||"",attrs:'autocapitalize="characters"'})+field("os-registrar","Registrar / responsible person’s full name",{placeholder:"Full legal name",value:agency.registrar||user.displayName||""})+field("os-position","Your role in the company",{placeholder:"e.g. Managing Director",value:agency.position||""})+field("os-support-email","Business support email",{type:"email",placeholder:"support@company.com",value:agency.supportEmail||""})+field("os-business-phone","Business phone number",{type:"tel",placeholder:"+234 …",value:agency.phone||""})+field("os-office-address","Office address",{placeholder:"Street, area and city",value:agency.address||""})+field("os-website","Business website",{type:"url",placeholder:"https://example.com",required:false,value:agency.website||""})+'</div><p class="os-help">Select all services your business provides. Professional or CAC checks will be reviewed by Faxton staff.</p></section>';
  } else if(role==="agent"){
    html+='<section class="os-section"><div class="os-section-head"><span class="os-section-no">02</span><div><h2>Agent profile</h2><p>Help property owners understand your experience and coverage.</p></div></div><div class="os-grid">'+field("os-agent-phone","Phone number",{type:"tel",placeholder:"+234 …",value:agent.phone||profile.phone||""})+field("os-experience","Years of experience",{type:"number",placeholder:"e.g. 3",value:agent.experience??"",attrs:'min="0" max="70" step="1"'})+field("os-agency","Agency you work for",{placeholder:"Agency name (if applicable)",required:false,value:agent.company||""})+field("os-dob","Date of birth",{type:"date",value:agent.dob||"",attrs:'max="'+new Date().toISOString().slice(0,10)+'"'})+field("os-areas","Areas you cover",{placeholder:"e.g. Lekki, Ajah, Ikeja",value:agent.areas||""})+field("os-reg-body","Professional registration body",{placeholder:"If registered (optional)",required:false,value:agent.registrationBody||""})+field("os-reg-number","Professional registration / licence number",{placeholder:"If applicable (optional)",required:false,value:agent.licence||""})+'</div><p class="os-help">Where a regulator has a public register, Faxton staff can review it manually. No automated regulator connection is configured yet.</p></section>';
  } else if(role==="landlord"){
    html+='<section class="os-section"><div class="os-section-head"><span class="os-section-no">02</span><div><h2>Home owner details</h2><p>Confirm your contact details so we can review your account.</p></div></div><div class="os-grid">'+field("os-owner-phone","Phone number",{type:"tel",placeholder:"+234 …",value:profile.phone||""})+'</div></section>';
  }
  if(verifying){
    html+='<section class="os-section"><div class="os-section-head"><span class="os-section-no">'+(role==="renter"?"02":"03")+'</span><div><h2>Identity & verification</h2><p>Your documents are private and visible only to you and authorised Faxton reviewers.</p></div></div><div class="os-notice">'+icon("lock",19,1.8)+'<span>Accepted formats: PDF, JPG, PNG or WEBP. Each file must be 10 MB or smaller. Your account remains pending until a reviewer checks these documents.</span></div><div class="os-doc-list">'+docField("governmentId","Government-issued ID","National ID, international passport or driver’s licence.")+docField("proofOfAddress","Proof of address","Recent utility bill or official document showing your address.")+(role==="landlord"?docField("ownershipProof","Proof of property ownership","Land title, ownership document, matching utility bill or property tax receipt."):"")+(role==="agency"?docField("cacCertificate","CAC registration certificate","Upload the company’s certificate or registration document."):"")+(role==="agent"?docField("professionalRegistration","Professional ID / licence","Optional, if registered with an applicable professional body.",false):"")+'</div><label class="os-consent"><input type="checkbox" id="os-consent"><span>I confirm these details are accurate and allow Faxton Rentals to review the submitted documents for identity, account and listing verification.</span></label></section>';
  }
  html+='<div class="os-error" id="os-error" role="alert" aria-live="assertive" hidden></div><div class="os-submit-row"><p>'+(verifying?"Your account will remain pending until the review is complete.":"You can change your preferences later.")+'</p><button class="os-submit" type="submit" id="os-submit"><span>Complete setup</span>'+icon("arrow",18,1.9)+'</button></div></form><p class="os-foot">Your information is handled according to the Faxton Rentals Privacy Policy. <a href="#/privacy">Read our policy</a>.</p></main></div>';
  return {full:true,title:"Complete your account setup",html,mount(root){
    const form=$("#os-form",root),err=$("#os-error",root),submit=$("#os-submit",root),source=$("#os-source",root),files=new Map();
    const loc=mountLoc(root,{ids:{country:"os-country",state:"os-state",lga:"os-lga"}});
    const say=(m)=>{err.textContent=m||"";err.hidden=!m;};
    const refreshSource=()=>{const show=source.value==="Other";$("#osSourceOtherWrap",root).hidden=!show;$("#os-source-other",root).required=show;};
    source.addEventListener("change",refreshSource);refreshSource();
    const typeChecks=()=>$$('input[name="businessTypes"]',root);
    const refreshOther=()=>{const checked=typeChecks().some(x=>x.value==="other"&&x.checked),wrap=$("#osTypeOtherWrap",root);if(wrap){wrap.hidden=!checked;const input=$("#businessTypeOther",root);if(input)input.required=checked;}};
    typeChecks().forEach(x=>x.addEventListener("change",refreshOther));refreshOther();
    $$("input[data-doc]",form).forEach(input=>input.addEventListener("change",()=>{
      const f=input.files?.[0],label=$("#file-name-"+input.dataset.doc,root);
      if(!f){files.delete(input.dataset.doc);if(label)label.textContent="PDF, JPG, PNG or WEBP · max 10 MB";return;}
      if(!MIME.has(f.type)||f.size>MAX_FILE){files.delete(input.dataset.doc);input.value="";if(label)label.textContent="PDF, JPG, PNG or WEBP · max 10 MB";say("Choose a PDF, JPG, PNG or WEBP file under 10 MB.");return;}
      files.set(input.dataset.doc,f);if(label)label.textContent=f.name;say("");
    }));
    form.addEventListener("submit",async(e)=>{
      e.preventDefault();say("");if(submit.disabled)return;
      const location=loc?.commit()||{};
      if(!source.value){source.focus();return say("Choose how you heard about Faxton Rentals.");}
      if(source.value==="Other"&&!value(root,"os-source-other"))return say("Tell us where you heard about Faxton Rentals.");
      if(!location.country)return say("Choose your country.");
      if(location.country==="Nigeria"&&(!location.state||!location.lga))return say("Choose your state and local government area.");
      const data={},missing=[];
      const required=(id,label)=>{data[id]=value(root,id);if(!data[id])missing.push(label);};
      if(role==="agency"){
        const labels={"os-business":"registered business name","os-cac":"CAC registration number","os-registrar":"registrar / responsible person's full name","os-position":"your role in the company","os-support-email":"business support email","os-business-phone":"business phone number","os-office-address":"office address"};
        Object.keys(labels).forEach(id=>required(id,labels[id]));
        if(data["os-cac"]&&!/^(RC|BN|IT)?[\s-]?\d{4,12}$/i.test(data["os-cac"]))missing.push("a valid CAC number");
        if(data["os-support-email"]&&!EMAIL_RE.test(data["os-support-email"]))missing.push("a valid business support email");
        if(!typeChecks().some(x=>x.checked))missing.push("at least one business type");
        if(typeChecks().some(x=>x.value==="other"&&x.checked)&&!value(root,"businessTypeOther"))missing.push("a description of your business type");
        const website=value(root,"os-website");if(website&&!/^https?:\/\//i.test(website))missing.push("a website starting with https://");
        data.agency={business:value(root,"os-business"),cac:value(root,"os-cac").toUpperCase(),registrar:value(root,"os-registrar"),position:value(root,"os-position"),supportEmail:value(root,"os-support-email"),phone:value(root,"os-business-phone"),address:value(root,"os-office-address"),website,businessTypes:typeChecks().filter(x=>x.checked).map(x=>x.value),businessTypeOther:value(root,"businessTypeOther")};
      }else if(role==="agent"){
        const labels={"os-agent-phone":"phone number","os-experience":"years of experience","os-dob":"date of birth","os-areas":"areas you cover"};
        Object.keys(labels).forEach(id=>required(id,labels[id]));
        if(data["os-agent-phone"]&&digits(data["os-agent-phone"]).length<8)missing.push("a valid phone number");
        if(data["os-experience"]&&(Number(data["os-experience"])<0||Number(data["os-experience"])>70))missing.push("years of experience between 0 and 70");
        if(data["os-dob"]&&age(data["os-dob"])<18)missing.push("a date of birth showing you are at least 18");
        data.agentInfo={phone:value(root,"os-agent-phone"),experience:Number(value(root,"os-experience")),dob:value(root,"os-dob"),company:value(root,"os-agency"),areas:value(root,"os-areas"),registrationBody:value(root,"os-reg-body"),licence:value(root,"os-reg-number")};
      }else if(role==="landlord"){
        required("os-owner-phone","phone number");
        if(data["os-owner-phone"]&&digits(data["os-owner-phone"]).length<8)missing.push("a valid phone number");
        data.phone=value(root,"os-owner-phone");
      }
      if(missing.length)return say("Please check: "+[...new Set(missing)].join(", ")+".");
      if(verifying&&!$("#os-consent",root).checked)return say("Please confirm the document review consent.");
      if(verifying){
        const needed=["governmentId","proofOfAddress",...(role==="landlord"?["ownershipProof"]:[]),...(role==="agency"?["cacCertificate"]:[])];
        if(needed.some(k=>!files.has(k)))return say("Please attach all required verification documents.");
      }
      submit.disabled=true;submit.classList.add("is-busy");submit.querySelector("span").textContent="Saving your details…";
      const uploaded=[];
      try{
        const documents={};
        for(const [kind,file] of files.entries()){
          const path="verificationDocs/"+user.uid+"/"+kind+"/"+Date.now()+"_"+safeName(file.name);
          await uploadBytes(storageRef(storage,path),file,{contentType:file.type,customMetadata:{ownerUid:user.uid,documentKind:kind}});
          uploaded.push(path);documents[kind]={path,name:file.name,type:file.type,size:file.size};
        }
        const locationFields=resFields({country:location.country,state:location.state,lga:location.lga,city:location.city});
        const onboarding={completed:true,source:source.value,sourceOther:source.value==="Other"?value(root,"os-source-other"):"",completedAt:serverTimestamp(),version:1};
        const update={...locationFields,onboarding,...(role==="agency"?{agency:data.agency,phone:data.agency.phone}:{}),...(role==="agent"?{agentInfo:data.agentInfo,phone:data.agentInfo.phone}:{}),...(role==="landlord"?{phone:data.phone}:{})};
        const resubmitting=verifying&&profile.verification?.status==="rejected";
        if(resubmitting)update.verification={status:"pending",kind:role==="agency"?"agency":role,requestedAt:Date.now()};
        if(verifying){
          const userRef=doc(db,"users",user.uid),requestRef=doc(db,"verificationRequests",user.uid),existing=await getDoc(requestRef);
          if(existing.exists()&&existing.data().status!=="rejected")throw new Error("A verification request is already being reviewed. Contact Faxton support if you need help.");
          const request={uid:user.uid,role,status:"pending",documents,submittedAt:serverTimestamp(),updatedAt:serverTimestamp()};
          const batch=writeBatch(db);
          batch.update(userRef,update);
          batch.set(requestRef,request);
          await batch.commit();
        }else await updateDoc(doc(db,"users",user.uid),update);
        try{sessionStorage.removeItem("signupDraft");}catch{}
        toast(verifying?"Setup complete. Your documents are waiting for review.":"Setup complete. Welcome to Faxton Rentals.");
        ctx.S.profile={...(ctx.S.profile||{}),...update};ctx.go("#/");
      }catch(e){
        for(const path of uploaded){try{await deleteObject(storageRef(storage,path));}catch{}}
        console.error("Onboarding save failed",e);
        say(e?.code==="storage/unauthorized"?"We couldn’t upload your documents. Private verification storage may not be enabled yet. Please try again or contact Faxton support.":e?.message||"We couldn’t save your setup. Please try again.");
      }finally{submit.disabled=false;submit.classList.remove("is-busy");submit.querySelector("span").textContent="Complete setup";}
    });
  }};
}
