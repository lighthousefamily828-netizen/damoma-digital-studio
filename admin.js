document.addEventListener("DOMContentLoaded", async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return location.href = "index.html#auth";

  const { data: profile, error } = await supabase.from("profiles").select("name,email,role").eq("id", user.id).maybeSingle();
  if (error || profile?.role !== "admin") {
    document.body.innerHTML = '<main class="dashboard"><div class="admin-card"><h1>Access denied</h1><p>This area is for the studio administrator only.</p><a class="btn btn-primary" href="index.html">Return to website</a></div></main>';
    return;
  }

  const adminEmail = document.getElementById("adminEmail");
  if (adminEmail) adminEmail.textContent = profile.email || user.email || "Administrator";
  const adminStatus = document.getElementById("adminStatus");
  if (adminStatus) adminStatus.textContent = profile.name || "Administrator";
  setupImagePreview();
  setupAdminUploadButton();
  await loadAdminStats();
  await loadAdminPortfolio();

  document.getElementById("portfolioForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = e.target.querySelector('button[type="submit"]');
    const file = document.getElementById("workImage").files?.[0];

    if (!file) return setStatus("portfolioStatus", "Please choose a portfolio picture.", true);
    if (!file.type.startsWith("image/")) return setStatus("portfolioStatus", "Please choose an image file.", true);
    if (file.size > 10 * 1024 * 1024) return setStatus("Image is too large. Maximum size is 10MB.", true);

    button.disabled = true;
    button.textContent = "Uploading…";

    try {
      const title = document.getElementById("workTitle").value.trim();
      const description = document.getElementById("workDescription").value.trim();
      const featured = document.getElementById("workFeatured").checked;
      const categoryName = document.getElementById("workCategory")?.value || "";
      let category_id = null;
      if (categoryName) {
        const { data: category } = await supabase.from("categories").select("id").eq("name", categoryName).maybeSingle();
        category_id = category?.id || null;
      }
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const safeTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "portfolio";
      const filePath = `${user.id}/${Date.now()}-${safeTitle}.${ext}`;

      const { error: uploadError } = await supabase.storage.from("portfolio").upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type
      });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("portfolio").getPublicUrl(filePath);
      const imageUrl = publicUrlData?.publicUrl;
      if (!imageUrl) throw new Error("Could not create the public image URL.");

      const { error: insertError } = await supabase.from("portfolio_items").insert({
        title,
        description,
        image_url: imageUrl,
        category_id,
        media_type: document.getElementById("workType").value,
        is_featured: featured,
        is_published: true
      });
      if (insertError) {
        await supabase.storage.from("portfolio").remove([filePath]);
        throw insertError;
      }

      e.target.reset();
      document.getElementById("imagePreview").innerHTML = "";
      setStatus("portfolioStatus", "Picture uploaded and published successfully.");
      await loadAdminStats();
      await loadAdminPortfolio();
    } catch (error) {
      setStatus("portfolioStatus", error.message || "Upload failed. Please try again.", true);
    } finally {
      button.disabled = false;
      button.textContent = "Publish work";
    }
  });

  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    location.href = "index.html";
  });
});

function setupImagePreview() {
  const input = document.getElementById("workImage");
  const preview = document.getElementById("imagePreview");
  if (!input || !preview) return;
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) {
      preview.innerHTML = "";
      return;
    }
    const url = URL.createObjectURL(file);
    preview.innerHTML = `<img src="${escapeAttr(url)}" alt="Selected portfolio preview">`;
  });
}

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


function setupAdminUploadButton() {
  const input = document.getElementById("workImage");
  const button = document.getElementById("chooseFileButton");
  const zone = document.querySelector(".professional-upload");
  if (!input) return;
  // The label is linked directly to the file input, which is more reliable on Android/iOS.
  // Keep the upload zone clickable as well.
  zone?.addEventListener("click", (event) => {
    if (event.target.closest("label") || event.target === input) return;
    input.click();
  });
  zone?.addEventListener("dragover", event => {
    event.preventDefault();
    zone.classList.add("dragging");
  });
  zone?.addEventListener("dragleave", () => zone.classList.remove("dragging"));
  zone?.addEventListener("drop", event => {
    event.preventDefault();
    zone.classList.remove("dragging");
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function loadAdminStats() {
  const [portfolio, requests] = await Promise.all([
    supabase.from("portfolio_items").select("id,is_published,is_featured"),
    supabase.from("project_requests").select("id", { count: "exact", head: true })
  ]);
  const rows = portfolio.data || [];
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  set("portfolioCount", rows.length);
  set("publishedCount", rows.filter(x => x.is_published).length);
  set("featuredCount", rows.filter(x => x.is_featured).length);
  set("requestCount", requests.count || 0);
  set("requestBadge", requests.count || 0);
  const email = document.getElementById("adminEmail");
  if (email && !email.textContent) email.textContent = "Administrator";
}


document.getElementById("adminMenuToggle")?.addEventListener("click", () => {
  document.getElementById("adminSidebar")?.classList.toggle("open");
});
document.querySelectorAll(".admin-nav-item").forEach(link => {
  link.addEventListener("click", () => document.getElementById("adminSidebar")?.classList.remove("open"));
});
