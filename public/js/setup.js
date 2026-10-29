import { $, esc, icon, friendlyErr } from "./ui.js";
import { saveProfile } from "./store.js";
import { locFields, mountLoc, resFields, NIGERIA } from "./loc.js";

const SOURCES = ["Instagram", "TikTok", "X (Twitter)", "Facebook", "Google search", "Friend or family", "YouTube", "WhatsApp", "Other"];
const TYPES = [["real-estate","Real estate company / property agency"],["electrical","Electrical services"],["home-automation","Home automation / smart home"],["plumbing","Plumbing"],["tiling","Tiling"],["painting","Painting"],["appliance-repair","Home appliance repair"],["cleaning","Cleaning services"],["carpentry","Carpentry / handyman"],["security","Property security / escort services"],["other","Other home or property service"]];
const age = (v) => { const d=new Date(v); if(!v||Number.isNaN(d.getTime()))return 0; const n=new Date();let a=n.getFullYear()-d.getFullYear();if(n<new Date(n.getFullYear(),d.getMonth(),d.getDate()))a--;return a; };
const field = (id,label,type,ph,attrs="") => '<div class="os-field"><label for="'+id+'">'+label+'</label><input id="'+id+'" name="'+id+'" type="'+type+'" placeholder="'+esc(ph||"")+'" '+attrs+'></div>';
const select = (id,label,opts,ph) => '<div class="os-field"><label for="'+id+'">'+label+'</label><select id="'+id+'" name="'+id+'" required><option value="">'+ph+'</option>'+opts.map(([v,t])=>'<option value="'+esc(v)+'">'+esc(t)+'</option>').join("")+'</select></div>';
const logo = '<a class="os-logo" href="#/" aria-label="Faxton Rentals"><span class="os-mark">FR</span><span><b>Faxton</b> Rentals</span></a>';

export function setupPage(ctx) {
 const p=ctx.S.profile||{}, role=["renter","landlord","agency","agent"].includes(p.role)?p.role:"renter", bizRole=role==="agency", agentRole=role==="agent";
 const biz=p.agency||{}, agent=p.agentInfo||{}, roleName=bizRole?"Business":agentRole?"Real estate agent":role==="landlord"?"Home owner":"Renter";
 const html='<div class="os-page"><header class="os-header">'+logo+'<span class="os-step">ACCOUNT SETUP <b>1 OF 1</b></span></header><main class="os-main">'+
 '<div class="os-intro"><span class="os-eyebrow">'+icon("sparkle",15)+' PERSONALISE YOUR EXPERIENCE</span><h1>Let’s get to know you.</h1><p>A few details help us show you relevant homes, services and opportunities.</p></div>'+
 '<form id="os-form" class="os-card" novalidate><div class="os-card-head"><span class="os-role-icon">'+icon(bizRole?"building":agentRole?"handshake":role==="landlord"?"home":"search",23)+'</span><div><h2>Your '+esc(roleName.toLowerCase())+' profile</h2><p>Signed in as <b>'+esc(ctx.S.user?.email||p.email||"")+'</b></p></div></div>'+
 '<section class="os-section"><h3>First, a little about you</h3>'+select("referralSource","How did you hear about Faxton?",SOURCES.map(x=>[x.toLowerCase(),x]),"Choose where you found us")+
 '<div class="os-field os-location-label"><label>Where are you based?</label><p class="os-hint">Choose your country, state and LGA or city/district.</p></div>'+
 locFields({style:"au",flow:true,ids:{country:"about-country",state:"about-state",lga:"about-lga"},country:p.country||NIGERIA,state:p.state||"",lga:p.lga||p.city||""})+'</section>'+
 (bizRole?'<section class="os-section"><h3>Business details</h3><p class="os-hint">Enter details matching your business records. Website is optional.</p>'+select("businessType","What type of business do you run?",TYPES,"Select your business type")+
 field("businessName","Registered business name","text","e.g. Faxton Properties Ltd",'required maxlength="120" autocomplete="organization"')+
 '<div class="os-grid">'+field("cac","CAC registration number","text","RC 1234567",'required maxlength="40"')+field("registrar","Name of registrar","text","Full name",'required maxlength="120" autocomplete="name"')+'</div>'+
 field("officeAddress","Office address","text","Street, area, city",'required maxlength="220" autocomplete="street-address"')+
 '<div class="os-grid">'+field("supportEmail","Support email","email","support@yourbusiness.com",'required maxlength="120" autocomplete="email"')+field("companyRole","Your role in the company","text","e.g. Director, Manager",'required maxlength="80"')+'</div>'+
 field("website",'Website <span class="os-optional">(optional)</span>',"url","https://yourbusiness.com",'maxlength="180" autocomplete="url"')+'</section>':'')+
 (agentRole?'<section class="os-section"><h3>Agent details</h3><p class="os-hint">Help clients know how to contact you and which areas you cover.</p><div class="os-grid">'+
 field("phone","Phone number","tel","+234 800 000 0000",'required maxlength="30" autocomplete="tel"')+field("experience","Years of experience","number","e.g. 3",'required min="0" max="60" step="1" inputmode="numeric"')+'</div>'+
 field("company",'Agency you work for <span class="os-optional">(optional)</span>',"text","Agency name",'maxlength="120" autocomplete="organization"')+
 field("areas","Areas you cover","text","e.g. Lekki, Ikoyi, Victoria Island",'required maxlength="180"')+
 field("dob","Date of birth","date","",'required autocomplete="bday"')+'</section>':'')+
 '<p class="os-error" id="os-error" role="alert" aria-live="polite"></p><div class="os-actions"><button type="submit" class="os-submit" id="os-submit">Save and continue '+icon("arrow",18,1.9)+'</button><small>By continuing, you confirm these details are accurate.</small></div></form><p class="os-secure">'+icon("shield",16)+' Your information is used to provide Faxton services.</p></main></div>';
 return {full:true,title:"Complete your profile",html,mount(root){
  const form=$("#os-form",root),err=$("#os-error",root),btn=$("#os-submit",root),loc=mountLoc(root,{ids:{country:"about-country",state:"about-state",lga:"about-lga"}});
  const put=(id,v)=>{const el=$("#"+id,root);if(el&&v!=null)el.value=v;};
  [["referralSource",p.referralSource||""],["businessType",biz.businessType||""],["businessName",biz.business||""],["cac",biz.cac||""],["registrar",biz.registrar||""],["officeAddress",biz.address||""],["supportEmail",biz.supportEmail||""],["companyRole",biz.position||""],["website",biz.website||""],["phone",p.phone||agent.phone||""],["experience",agent.experience??""],["company",agent.company||""],["areas",agent.areas||""],["dob",agent.dob||""]].forEach(([k,v])=>put(k,v));
  let busy=false; const fail=(m,id)=>{err.textContent=m;if(id){const el=$("#"+id,root);el?.focus();el?.scrollIntoView?.({block:"center",behavior:"smooth"});}};
  form.onsubmit=async(e)=>{e.preventDefault();if(busy)return;err.textContent="";loc?.commit();
   const country=$("#about-country",root).value.trim(),state=$("#about-state",root).value.trim(),lga=$("#about-lga",root).value.trim(),source=$("#referralSource",root).value;
   if(!source)return fail("Choose how you heard about Faxton.","referralSource");
   if(!country)return fail("Choose your country.","about-country");
   if(country===NIGERIA&&!state)return fail("Choose your state.","about-state");
   if(lga.length<2)return fail(country===NIGERIA?"Choose your local government area (LGA).":"Enter your city or district.","about-lga");
   const place=resFields({country,state,lga,city:country===NIGERIA?state:lga});
   const data={referralSource:source,...place,onboarding:{completed:true,completedAt:Date.now()}};
   if(bizRole){
    const val=id=>$("#"+id,root).value.trim(),type=val("businessType"),name=val("businessName"),cac=val("cac"),registrar=val("registrar"),address=val("officeAddress"),email=val("supportEmail"),position=val("companyRole"),website=val("website");
    if(!type)return fail("Choose the type of business you run.","businessType");
    if(name.length<2)return fail("Enter your registered business name.","businessName");
    if(!/^(RC|BN|IT)?[\s-]?\d{4,12}$/i.test(cac))return fail("Enter a valid CAC number, e.g. RC 1234567.","cac");
    if(registrar.length<3)return fail("Enter the registrar’s full name.","registrar");
    if(address.length<5)return fail("Enter your office address.","officeAddress");
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return fail("Enter a valid support email.","supportEmail");
    if(position.length<2)return fail("Enter your role in the company.","companyRole");
    if(website&&!/^https?:\/\/[^\s]+\.[^\s]+/i.test(website))return fail("Enter a valid website starting with https://","website");
    data.agency={businessType:type,business:name,cac:cac.toUpperCase(),registrar,address,supportEmail:email,position,website,country,state,lga,city:place.city};
    data.verification={status:"pending",kind:"agency",requestedAt:Date.now()};
   }
   if(agentRole){
    const val=id=>$("#"+id,root).value.trim(),phone=val("phone"),exp=val("experience"),company=val("company"),areas=val("areas"),dob=val("dob");
    if(phone.replace(/[^\d]/g,"").length<8)return fail("Enter a valid phone number.","phone");
    if(exp===""||+exp<0||+exp>60||!Number.isInteger(+exp))return fail("Enter your years of experience (0–60).","experience");
    if(areas.length<2)return fail("Tell us the areas you cover.","areas");
    if(!dob||age(dob)<18)return fail("Agents must be at least 18 years old.","dob");
    data.phone=phone;data.agentInfo={phone,experience:+exp,company,areas,dob,country,state,lga,city:place.city};
    data.verification={status:"pending",kind:"agent",requestedAt:Date.now()};
   }
   busy=true;btn.disabled=true;btn.classList.add("loading");btn.innerHTML='<span class="os-spinner"></span> Saving your profile…';
   try{await saveProfile(ctx.S.user.uid,data);ctx.S.profile={...ctx.S.profile,...data};await ctx.refreshUser?.(ctx.S.user);ctx.go("#"+(ctx.dashHome?.()||"/"));}
   catch(e){fail(friendlyErr(e)||"We couldn’t save your details. Please try again.");}
   finally{busy=false;btn.disabled=false;btn.classList.remove("loading");btn.innerHTML='Save and continue '+icon("arrow",18,1.9);}
  };
 }};
}
