const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", async () => {
  $("year") && ($("year").textContent = new Date().getFullYear());

  setTimeout(() => $("loader")?.classList.add("hide"), 650);

  await loadCategories();
  await loadPortfolio();
  await loadServices();
  await refreshAuthUI();

  $("toggleAuth")?.addEventListener("click", toggleAuthMode);
  $("authForm")?.addEventListener("submit", handleAuth);
  $("contactForm")?.addEventListener("submit", handleContact);

  supabase.auth.onAuthStateChange(() => refreshAuthUI());
});

let signupMode = false;

function toggleAuthMode() {
  signupMode = !signupMode;
  $("authTitle").textContent = signupMode ? "Create account" : "Sign in";
  $("authSubtitle").textContent = signupMode ? "Create your Damoma account." : "Sign in to access your Damoma account.";
  $("authSubmit").textContent = signupMode ? "Create account" : "Sign in";
  $("authName").classList.toggle("hidden", !signupMode);
  $("toggleAuth").textContent = signupMode ? "Already have an account? Sign in" : "Create an account";
  $("authStatus").textContent = "";
}

async function handleAuth(e) {
  e.preventDefault();
  const email = $("authEmail").value.trim();
  const password = $("authPassword").value;
  const name = $("authName").value.trim();
  setStatus("authStatus", "Please wait...");

  if (signupMode) {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name } }
    });
    if (error) return setStatus("authStatus", error.message, true);
    setStatus("authStatus", "Account created. Check your email if confirmation is enabled.");
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setStatus("authStatus", error.message, true);
    setStatus("authStatus", "Signed in successfully.");
    setTimeout(() => location.hash = "works", 500);
  }
}

async function refreshAuthUI() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    $("authBtn") && ($("authBtn").textContent = "Sign in");
    $("adminBtn")?.classList.add("hidden");
    return;
  }
  $("authBtn") && ($("authBtn").textContent = "Account");
  try {
    const { data: profile } = await supabase.from("profiles").select("name,role").eq("id", user.id).maybeSingle();
    if (profile?.role === "admin") $("adminBtn")?.classList.remove("hidden");
  } catch (_) {}
}

async function loadCategories() {
  const box = $("filters");
  if (!box) return;
  const { data, error } = await supabase.from("categories").select("id,name,slug").eq("is_active", true).order("sort_order");
  if (error || !data?.length) return;
  box.innerHTML = `<button class="filter active" data-category="all">All</button>` +
    data.map(c => `<button class="filter" data-category="${escapeHtml(c.id)}">${escapeHtml(c.name)}</button>`).join("");
  box.querySelectorAll(".filter").forEach(btn => btn.addEventListener("click", () => {
    box.querySelectorAll(".filter").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
    loadPortfolio(btn.dataset.category);
  }));
}

async function loadPortfolio(categoryId = "all") {
  const grid = $("portfolioGrid");
  if (!grid) return;
  let query = supabase.from("portfolio_items")
    .select("id,title,description,image_url,media_url,media_type,is_featured,category_id")
    .eq("is_published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (categoryId !== "all") query = query.eq("category_id", categoryId);
  const { data, error } = await query;
  if (error) {
    grid.innerHTML = `<div class="empty-state">Your portfolio is ready for its first uploads.</div>`;
    return;
  }
  if (!data?.length) {
    grid.innerHTML = `<div class="empty-state">No published works yet. Add your first work from the admin dashboard.</div>`;
    return;
  }
  grid.innerHTML = data.map(item => {
    const media = item.media_type === "video" && item.media_url
      ? `<video src="${escapeAttr(item.media_url)}" muted loop autoplay playsinline></video>`
      : `<img src="${escapeAttr(item.image_url || item.media_url || "https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=900&q=80")}" alt="${escapeAttr(item.title)}" loading="lazy">`;
    return `<article class="portfolio-card">${media}<div class="portfolio-info"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description || "")}</p></div></article>`;
  }).join("");
}

async function loadServices() {
  const grid = $("servicesGrid");
  if (!grid) return;
  const { data } = await supabase.from("services").select("name,short_description,description").eq("is_active", true).order("created_at");
  if (!data?.length) return;
  grid.innerHTML = data.map((s, i) => `<article class="service-card"><span>${String(i+1).padStart(2,"0")}</span><h3>${escapeHtml(s.name)}</h3><p>${escapeHtml(s.short_description || s.description || "")}</p></article>`).join("");
}

async function handleContact(e) {
  e.preventDefault();
  const { data: { user } } = await supabase.auth.getUser();
  const payload = {
    user_id: user?.id || null,
    name: $("contactName").value.trim(),
    email: $("contactEmail").value.trim(),
    subject: $("contactSubject").value.trim(),
    message: $("contactMessage").value.trim()
  };
  const { error } = await supabase.from("contact_messages").insert(payload);
  if (error) return setStatus("contactStatus", error.message, true);
  e.target.reset();
  setStatus("contactStatus", "Message sent successfully.");
}

function setStatus(id, text, error = false) {
  const el = $(id);
  if (el) {
    el.textContent = text;
    el.classList.toggle("error", error);
  }
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
}
function escapeAttr(value = "") { return escapeHtml(value); }
