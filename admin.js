document.addEventListener("DOMContentLoaded", async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return location.href = "index.html#auth";

  const { data: profile, error } = await supabase.from("profiles").select("name,email,role").eq("id", user.id).maybeSingle();
  if (error || profile?.role !== "admin") {
    document.body.innerHTML = '<main class="dashboard"><div class="admin-card"><h1>Access denied</h1><p>This area is for the studio administrator only.</p><a class="btn btn-primary" href="index.html">Return to website</a></div></main>';
    return;
  }

  document.getElementById("profileInfo").textContent = `${profile.name || "Admin"} • ${profile.email || user.email}`;
  await loadAdminPortfolio();

  document.getElementById("portfolioForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      title: document.getElementById("workTitle").value.trim(),
      description: document.getElementById("workDescription").value.trim(),
      image_url: document.getElementById("workImage").value.trim() || null,
      media_type: document.getElementById("workType").value,
      is_featured: document.getElementById("workFeatured").checked,
      is_published: true
    };
    const { error } = await supabase.from("portfolio_items").insert(payload);
    if (error) return setStatus("portfolioStatus", error.message, true);
    e.target.reset();
    setStatus("portfolioStatus", "Work published.");
    await loadAdminPortfolio();
  });

  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    location.href = "index.html";
  });
});

async function loadAdminPortfolio() {
  const grid = document.getElementById("adminPortfolio");
  if (!grid) return;
  const { data, error } = await supabase.from("portfolio_items").select("id,title,image_url,is_published").order("created_at", { ascending: false });
  if (error || !data?.length) {
    grid.innerHTML = '<div class="empty-state">No portfolio records yet.</div>';
    return;
  }
  grid.innerHTML = data.map(item => `<article class="portfolio-card"><img src="${escapeAttr(item.image_url || "https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=900&q=80")}" alt=""><div class="portfolio-info"><h3>${escapeHtml(item.title)}</h3><p>${item.is_published ? "Published" : "Draft"}</p><button class="text-button delete-work" data-id="${item.id}">Delete</button></div></article>`).join("");
  grid.querySelectorAll(".delete-work").forEach(btn => btn.addEventListener("click", async () => {
    if (!confirm("Delete this work?")) return;
    const { error } = await supabase.from("portfolio_items").delete().eq("id", btn.dataset.id);
    if (error) return alert(error.message);
    loadAdminPortfolio();
  }));
}
