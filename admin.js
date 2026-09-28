const OWNER_ID="4599f9ff-a12a-41b0-a24c-c8c3ffd1e82a";
let currentUser=null, categories=[], editingId=null;

document.addEventListener("DOMContentLoaded",()=>bootAdmin());

async function bootAdmin(){
  try{
    const {data:{user},error}=await supabase.auth.getUser();
    if(error) throw error;
    if(!user){ location.href="index.html#auth"; return; }
    const {data:profile,error:pe}=await supabase.from("profiles").select("name,email,role").eq("id",user.id).maybeSingle();
    if(pe) throw pe;
    if(user.id!==OWNER_ID || profile?.role!=="admin"){ renderDenied(); return; }
    currentUser=user;
    document.getElementById("adminName").textContent=profile.name||"Administrator";
    wireNavigation();
    wirePortfolioForm();
    document.getElementById("dmLogout").addEventListener("click",logout);
    await Promise.all([loadCategories(),refreshAll()]);
  }catch(err){
    console.error(err);
    showAlert("Dashboard could not load: "+(err?.message||"Unknown error"),true);
  }
}

function renderDenied(){
  document.body.innerHTML='<main style="min-height:100vh;display:grid;place-items:center;background:#09070f;color:#fff;padding:24px;font-family:Arial"><div style="max-width:460px;text-align:center;padding:36px;border:1px solid #30283d;border-radius:20px;background:#12101a"><h1>Access denied</h1><p style="color:#aaa;margin:12px 0 22px">This private studio area is restricted to the administrator account.</p><a href="index.html" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#fff;color:#111;text-decoration:none;font-weight:700">Return to website</a></div></main>';
}

function wireNavigation(){
  document.querySelectorAll(".dm-nav").forEach(btn=>btn.addEventListener("click",()=>openView(btn.dataset.view)));
  document.querySelectorAll("[data-go]").forEach(btn=>btn.addEventListener("click",()=>openView(btn.dataset.go)));
  document.getElementById("dmMenu").addEventListener("click",()=>document.getElementById("dmSidebar").classList.toggle("open"));
}

function openView(view){
  document.querySelectorAll(".dm-nav").forEach(x=>x.classList.toggle("active",x.dataset.view===view));
  document.querySelectorAll(".dm-view").forEach(x=>x.classList.toggle("active",x.dataset.panel===view));
  const titles={overview:"Overview",portfolio:"Portfolio",requests:"Project Requests",messages:"Messages",services:"Services & Pricing"};
  document.getElementById("viewTitle").textContent=titles[view]||"Overview";
  document.getElementById("dmSidebar").classList.remove("open");
  if(view==="portfolio") loadPortfolio();
  if(view==="requests") loadRequests();
  if(view==="messages") loadMessages();
  if(view==="services") loadServicesAdmin();
}

async function refreshAll(){
  await Promise.all([loadStats(),loadPortfolio(),loadRequests(true),loadMessages(true),loadServicesAdmin(true)]);
}

async function loadStats(){
  const [p,r,m]=await Promise.all([
    supabase.from("portfolio_items").select("id,is_published,is_featured"),
    supabase.from("project_requests").select("id,status,created_at").order("created_at",{ascending:false}),
    supabase.from("contact_messages").select("id,status,created_at").order("created_at",{ascending:false})
  ]);
  if(p.error) throw p.error;
  const rows=p.data||[];
  setText("statPortfolio",rows.length);
  setText("statPublished",rows.filter(x=>x.is_published).length);
  setText("statFeatured",rows.filter(x=>x.is_featured).length);
  setText("statRequests",(r.data||[]).length);
  setText("requestBadge",(r.data||[]).filter(x=>x.status==="new").length);
  setText("messageBadge",(m.data||[]).filter(x=>x.status==="new").length);
  renderRecentRequests((r.data||[]).slice(0,5));
}

async function loadCategories(){
  const {data,error}=await supabase.from("categories").select("id,name").eq("is_active",true).order("sort_order");
  if(error) throw error;
  categories=data||[];
  const select=document.getElementById("workCategory");
  select.innerHTML='<option value="">Select category</option>'+categories.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join("");
}

async function loadPortfolio(){
  const {data,error}=await supabase.from("portfolio_items").select("id,title,description,image_url,category_id,is_published,is_featured,created_at").order("created_at",{ascending:false});
  if(error){showAlert(error.message,true);return;}
  const rows=data||[];
  const lib=document.getElementById("portfolioLibrary");
  lib.innerHTML=rows.length?rows.map(item=>portfolioItem(item)).join(""):'<div class="dm-empty">No portfolio work yet. Upload your first design.</div>';
  lib.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>startEdit(b.dataset.edit));
  lib.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>deleteWork(b.dataset.delete));
  lib.querySelectorAll("[data-publish]").forEach(b=>b.onclick=()=>togglePublished(b.dataset.publish,b.dataset.value==="true"));
  lib.querySelectorAll("[data-feature]").forEach(b=>b.onclick=()=>toggleFeatured(b.dataset.feature,b.dataset.value==="true"));
  const recent=document.getElementById("recentPortfolio");
  recent.innerHTML=rows.slice(0,5).map(item=>'<div class="dm-mini-row"><img src="'+esc(item.image_url||"")+'" alt=""><div><strong>'+esc(item.title)+'</strong><small>'+esc(item.is_published?"Published":"Draft")+'</small></div></div>').join("")||'<div class="dm-empty">No work uploaded yet.</div>';
}

function portfolioItem(item){
  const cat=categories.find(c=>c.id===item.category_id)?.name||"Uncategorized";
  return '<article class="dm-library-item"><img src="'+esc(item.image_url||"")+'" alt="'+esc(item.title)+'"><div class="dm-library-info"><div><strong>'+esc(item.title)+'</strong><small>'+esc(cat)+' · '+esc(item.is_published?"Published":"Draft")+(item.is_featured?" · Featured":"")+'</small></div><div class="dm-actions"><button data-edit="'+item.id+'">Edit</button><button data-publish="'+item.id+'" data-value="'+item.is_published+'">'+(item.is_published?"Unpublish":"Publish")+'</button><button data-feature="'+item.id+'" data-value="'+item.is_featured+'">'+(item.is_featured?"Unfeature":"Feature")+'</button><button class="danger" data-delete="'+item.id+'">Delete</button></div></div></article>';
}

function wirePortfolioForm(){
  const input=document.getElementById("workImage"),zone=document.getElementById("uploadZone"),preview=document.getElementById("imagePreview");
  input.addEventListener("change",()=>showPreview(input.files?.[0]));
  ["dragenter","dragover"].forEach(e=>zone.addEventListener(e,x=>{x.preventDefault();zone.classList.add("dragging")}));
  ["dragleave","drop"].forEach(e=>zone.addEventListener(e,x=>{x.preventDefault();zone.classList.remove("dragging")}));
  zone.addEventListener("drop",e=>{const f=e.dataTransfer.files?.[0];if(!f)return;const dt=new DataTransfer();dt.items.add(f);input.files=dt.files;showPreview(f)});
  document.getElementById("portfolioForm").addEventListener("submit",publishWork);
  document.getElementById("cancelEdit").addEventListener("click",resetForm);
}
function showPreview(file){
  const img=document.getElementById("imagePreview");
  if(!file){img.removeAttribute("src");img.classList.remove("show");return;}
  if(!file.type.startsWith("image/")){showFormStatus("Please choose an image file.",true);return;}
  if(file.size>10*1024*1024){showFormStatus("Maximum file size is 10MB.",true);return;}
  img.src=URL.createObjectURL(file);img.classList.add("show");
}
async function publishWork(e){
  e.preventDefault();
  const file=document.getElementById("workImage").files?.[0],title=document.getElementById("workTitle").value.trim();
  if(!title)return showFormStatus("Enter a title.",true);
  if(!editingId&&!file)return showFormStatus("Choose an image first.",true);
  if(file&&(file.size>10*1024*1024||!file.type.startsWith("image/")))return showFormStatus("Use a JPG, PNG, WEBP or GIF under 10MB.",true);
  const btn=document.getElementById("publishBtn");btn.disabled=true;btn.textContent=editingId?"Saving…":"Uploading…";
  try{
    const payload={title,description:document.getElementById("workDescription").value.trim()||null,category_id:document.getElementById("workCategory").value||null,is_featured:document.getElementById("workFeatured").checked};
    if(file){
      const ext=(file.name.split(".").pop()||"jpg").toLowerCase(),safe=title.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,50)||"work";
      const path=OWNER_ID+"/"+Date.now()+"-"+safe+"."+ext;
      const up=await supabase.storage.from("portfolio").upload(path,file,{upsert:false,contentType:file.type,cacheControl:"3600"});
      if(up.error)throw new Error("Upload failed: "+up.error.message);
      payload.image_url=supabase.storage.from("portfolio").getPublicUrl(path).data.publicUrl;
    }
    let result;
    if(editingId) result=await supabase.from("portfolio_items").update(payload).eq("id",editingId).select("id").single();
    else result=await supabase.from("portfolio_items").insert({...payload,is_published:true,media_type:"image"}).select("id").single();
    if(result.error)throw new Error("Database save failed: "+result.error.message);
    showFormStatus(editingId?"✓ Work updated.":"✓ Work published successfully.");
    resetForm();await refreshAll();
  }catch(err){console.error(err);showFormStatus(err.message||"Something went wrong.",true)}
  finally{btn.disabled=false;btn.textContent="Publish work"}
}
function startEdit(id){
  supabase.from("portfolio_items").select("id,title,description,category_id,is_featured,image_url").eq("id",id).single().then(({data,error})=>{
    if(error||!data)return showAlert(error?.message||"Work not found",true);
    editingId=id;document.getElementById("formTitle").textContent="Edit work";document.getElementById("publishBtn").textContent="Save changes";document.getElementById("cancelEdit").classList.remove("hidden");
    document.getElementById("workTitle").value=data.title||"";document.getElementById("workDescription").value=data.description||"";document.getElementById("workCategory").value=data.category_id||"";document.getElementById("workFeatured").checked=!!data.is_featured;showPreview(null);
    const img=document.getElementById("imagePreview");if(data.image_url){img.src=data.image_url;img.classList.add("show")}
    openView("portfolio");window.scrollTo({top:0,behavior:"smooth"});
  });
}
function resetForm(){
  editingId=null;document.getElementById("portfolioForm").reset();document.getElementById("formTitle").textContent="Add new work";document.getElementById("publishBtn").textContent="Publish work";document.getElementById("cancelEdit").classList.add("hidden");document.getElementById("imagePreview").removeAttribute("src");document.getElementById("imagePreview").classList.remove("show");showFormStatus("");
}
async function deleteWork(id){
  if(!confirm("Delete this portfolio work? This cannot be undone."))return;
  const {data:item,error:getErr}=await supabase.from("portfolio_items").select("image_url").eq("id",id).single();
  if(getErr)return showAlert(getErr.message,true);
  const {error}=await supabase.from("portfolio_items").delete().eq("id",id);
  if(error)return showAlert(error.message,true);
  if(item?.image_url){const marker="/storage/v1/object/public/portfolio/";const i=item.image_url.indexOf(marker);if(i>=0)await supabase.storage.from("portfolio").remove([decodeURIComponent(item.image_url.slice(i+marker.length))])}
  showAlert("Portfolio work deleted.");await refreshAll();
}
async function togglePublished(id,current){const {error}=await supabase.from("portfolio_items").update({is_published:!current}).eq("id",id);if(error)return showAlert(error.message,true);await refreshAll()}
async function toggleFeatured(id,current){const {error}=await supabase.from("portfolio_items").update({is_featured:!current}).eq("id",id);if(error)return showAlert(error.message,true);await refreshAll()}

async function loadRequests(silent=false){
  const {data,error}=await supabase.from("project_requests").select("id,name,contact,service,details,status,created_at").order("created_at",{ascending:false});
  if(error){if(!silent)showAlert(error.message,true);return}
  const box=document.getElementById("requestsList");box.innerHTML=data?.length?data.map(r=>'<article class="dm-request"><div><strong>'+esc(r.name)+'</strong><small>'+esc(r.contact)+' · '+esc(r.service)+'</small><p>'+esc(r.details)+'</p><time>'+dateText(r.created_at)+'</time></div><select data-request="'+r.id+'"><option '+(r.status==="new"?"selected":"")+" value="new">New</option><option '+(r.status==="contacted"?"selected":"")+" value="contacted">Contacted</option><option '+(r.status==="completed"?"selected":"")+" value="completed">Completed</option></select></article>').join(""):'<div class="dm-empty">No project requests yet.</div>';
  box.querySelectorAll("[data-request]").forEach(s=>s.onchange=async()=>{const {error}=await supabase.from("project_requests").update({status:s.value}).eq("id",s.dataset.request);if(error)showAlert(error.message,true);else await loadStats()});
  renderRecentRequests((data||[]).slice(0,5));
}
function renderRecentRequests(rows){const box=document.getElementById("recentRequests");if(!box)return;box.innerHTML=rows.length?rows.map(r=>'<div class="dm-mini-row"><span class="dm-dot"></span><div><strong>'+esc(r.name)+' · '+esc(r.service)+'</strong><small>'+esc(r.status)+' · '+dateText(r.created_at)+'</small></div></div>').join(""):'<div class="dm-empty">No requests yet.</div>'}

async function loadMessages(silent=false){
  const {data,error}=await supabase.from("contact_messages").select("id,name,email,subject,message,status,created_at").order("created_at",{ascending:false});
  if(error){if(!silent)showAlert(error.message,true);return}
  const box=document.getElementById("messagesList");box.innerHTML=data?.length?data.map(m=>'<article class="dm-request"><div><strong>'+esc(m.subject||"New message")+'</strong><small>'+esc(m.name)+' · '+esc(m.email)+'</small><p>'+esc(m.message)+'</p><time>'+dateText(m.created_at)+'</time></div><select data-message="'+m.id+'"><option '+(m.status==="new"?"selected":"")+" value="new">New</option><option '+(m.status==="read"?"selected":"")+" value="read">Read</option><option '+(m.status==="replied"?"selected":"")+" value="replied">Replied</option></select></article>').join(""):'<div class="dm-empty">No messages yet.</div>';
  box.querySelectorAll("[data-message]").forEach(s=>s.onchange=async()=>{const {error}=await supabase.from("contact_messages").update({status:s.value}).eq("id",s.dataset.message);if(error)showAlert(error.message,true);else await loadStats()});
}
async function loadServicesAdmin(silent=false){
  const {data,error}=await supabase.from("services").select("id,name,short_description,price,currency,delivery_days,is_active,is_featured").order("created_at");
  if(error){if(!silent)showAlert(error.message,true);return}
  document.getElementById("servicesList").innerHTML=data?.length?data.map(s=>'<article class="dm-service"><div><span>'+esc(s.is_active?"ACTIVE":"INACTIVE")+'</span><h3>'+esc(s.name)+'</h3><p>'+esc(s.short_description||"")+'</p></div><strong>'+esc(s.currency||"NGN")+" "+Number(s.price||0).toLocaleString()+"</strong><small>"+esc(String(s.delivery_days||0))+" day(s)</small></article>").join(""):'<div class="dm-empty">No services found.</div>';
}

async function logout(){await supabase.auth.signOut();location.href="index.html"}
function setText(id,v){const e=document.getElementById(id);if(e)e.textContent=String(v)}
function showAlert(msg,error=false){const e=document.getElementById("dmAlert");e.textContent=msg;e.className="dm-alert show"+(error?" error":"");clearTimeout(showAlert.t);showAlert.t=setTimeout(()=>e.className="dm-alert",4500)}
function showFormStatus(msg,error=false){const e=document.getElementById("portfolioStatus");e.textContent=msg;e.className="dm-form-status"+(error?" error":"")}
function dateText(v){try{return new Date(v).toLocaleString("en-NG",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}catch{return ""}}
function esc(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
