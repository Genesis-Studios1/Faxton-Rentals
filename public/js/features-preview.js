const form=document.querySelector("#featureDemoForm");
const input=document.querySelector("#featureDemoInput");
const thread=document.querySelector("#featureThread");
if(form&&input&&thread){
 form.addEventListener("submit",(event)=>{
  event.preventDefault();
  const value=input.value.trim();
  if(!value)return;
  const bubble=document.createElement("div");
  bubble.className="feature-demo-sent";
  bubble.textContent=value;
  thread.append(bubble);
  input.value="";
  thread.scrollTop=thread.scrollHeight;
  input.focus();
 });
}
