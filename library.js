const SUPABASE_URL="https://iuwmdwbdkegyzkppvngw.supabase.co";
const SUPABASE_KEY="sb_publishable_tXm0KC_lp8lSMh0QkdpCxA_jG_sm1hq";
const supabase=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
let currentUser=null;
async function init(){
 const {data:{user}}=await supabase.auth.getUser(); currentUser=user;
 $("loadingState").classList.add("hidden");
 if(!user){$("loginGate").classList.remove("hidden");return}
 $("libraryContent").classList.remove("hidden");
 await loadLibrary();
}
async function loadLibrary(){
 const [{data:progress,error:pe},{data:bookmarks,error:be}]=await Promise.all([
  supabase.from("novel_reading_progress").select("novel_id,chapter_number,progress_percent,updated_at").eq("user_id",currentUser.id).order("updated_at",{ascending:false}),
  supabase.from("novel_bookmarks").select("novel_id,created_at").eq("user_id",currentUser.id).order("created_at",{ascending:false})
 ]);
 if(pe||be){console.error(pe||be);showEmpty();return}
 const ids=[...new Set([...(progress||[]).map(x=>x.novel_id),...(bookmarks||[]).map(x=>x.novel_id)])];
 if(!ids.length){showEmpty();return}
 const {data:novels,error}=await supabase.from("novels").select("id,title,author_name,cover_url,slug,rating,chapter_count,status").in("id",ids).eq("is_published",true);
 if(error){console.error(error);showEmpty();return}
 const map=new Map((novels||[]).map(n=>[n.id,n]));
 const pRows=(progress||[]).filter(p=>map.has(p.novel_id));
 const bRows=(bookmarks||[]).filter(b=>map.has(b.novel_id));
 $("progressCount").textContent=pRows.length+" saved progress";
 $("bookmarkCount").textContent=bRows.length+" saved";
 renderProgress(pRows,map); renderBookmarks(bRows,map);
 if(!pRows.length)$("continueGrid").innerHTML='<div class="library-state"><p>No reading progress yet. Find a story and start reading.</p></div>';
 if(!bRows.length)$("bookmarkGrid").innerHTML='<div class="library-state"><p>No saved stories yet.</p></div>';
}
function card(n,p){
 const pct=Math.max(0,Math.min(100,Number(p?.progress_percent||0)));
 const ch=p?.chapter_number||1;
 const cover=n.cover_url?'style="background-image:linear-gradient(180deg,transparent 35%,rgba(0,0,0,.88)),url('+encodeURI(n.cover_url)+')"':'';
 return '<article class="library-card"><div class="library-cover" '+cover+'><h3>'+esc(n.title)+'</h3></div><div class="library-info"><strong>'+esc(n.author_name||"Unknown author")+'</strong><div class="library-meta">★ '+Number(n.rating||0).toFixed(1)+' · '+esc(n.status||"ongoing")+'</div>'+(p?'<div class="library-meta">Chapter '+ch+(n.chapter_count?" of "+n.chapter_count:"")+' · '+Math.round(pct)+'%</div><div class="progress-track"><div class="progress-fill" style="width:'+pct+'%"></div></div>':'')+'<div class="card-actions"><a class="primary-btn" href="reader.html?slug='+encodeURIComponent(n.slug)+(p?'&chapter='+ch:'')+'">'+(p?"Continue":"Read")+'</a>'+(!p?'<button data-remove="'+n.id+'">Remove</button>':'')+'</div></div></article>';
}
function renderProgress(rows,map){$("continueGrid").innerHTML=rows.map(p=>card(map.get(p.novel_id),p)).join("");}
function renderBookmarks(rows,map){$("bookmarkGrid").innerHTML=rows.map(b=>card(map.get(b.novel_id)).replace('data-remove="'+b.novel_id+'"','data-remove="'+b.novel_id+'"')).join("");document.querySelectorAll("[data-remove]").forEach(btn=>btn.onclick=()=>removeBookmark(btn.dataset.remove));}
async function removeBookmark(id){await supabase.from("novel_bookmarks").delete().eq("user_id",currentUser.id).eq("novel_id",id);await loadLibrary();}
function showEmpty(){$("libraryContent").classList.remove("hidden");$("emptyLibrary").classList.remove("hidden");$("continueGrid").innerHTML="";$("bookmarkGrid").innerHTML="";}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
$("accountBtn")?.addEventListener("click",async()=>{const {data:{user}}=await supabase.auth.getUser();if(user)await supabase.auth.signOut();location.href="index.html";});
$("menuBtn")?.addEventListener("click",()=>document.querySelector("nav")?.classList.toggle("open"));
init();