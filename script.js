const apiUrl = "https://easyhome-ayu6.onrender.com";

//─────────────────────────────────────────────────────
// “Ev Sahibi ile İletişime Geç” formunun submit handler’ı
//─────────────────────────────────────────────────────
async function handleAddListing(e) {
  e.preventDefault();

  // 1) Kullanıcı girişli mi kontrol et
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  if (!currentUser || !currentUser._id) {
    alert("İlan eklemek için öncelikle giriş yapmalısınız.");
    return;
  }

  // 2) Form verilerini al
  const title = document.getElementById("listing-title").value.trim();
  const price = Number(document.getElementById("listing-price").value);
  const area = Number(document.getElementById("listing-area").value);
  const bedrooms = Number(document.getElementById("listing-bedrooms").value);
  const bathrooms = Number(document.getElementById("listing-bathrooms").value);
  const city = document.getElementById("listing-city").value.trim();
  const district = document.getElementById("listing-district").value.trim();
  const location = document.getElementById("listing-location").value.trim();
  const furnished = document.getElementById("listing-furnished").checked;
  const petFriendly = document.getElementById("listing-petFriendly").checked;
  const featuresRaw = document.getElementById("listing-features").value.trim();
  const description = document
    .getElementById("listing-description")
    .value.trim();

  // 3) “features” dizisini oluştur
  const features = featuresRaw
    ? featuresRaw
        .split(",")
        .map((f) => f.trim())
        .filter((f) => f.length)
    : [];

  // 4) “images” dizisini oluştur (şimdilik tek URL)
  //    Eğer birden fazla resim yükleme yapacaksanız, onları input.files ile okuyup bir dizi haline getirmelisiniz.
  const images = [];
  const imageFiles = document.getElementById("listing-images").files;
  if (imageFiles && imageFiles.length) {
    // Örnek: sadece frontend’de gösterim için base64’e çeviriyoruz (butona tıkladıktan sonra backend’e URL yerine base64 göndermek isterseniz)
    for (let i = 0; i < imageFiles.length && i < 5; i++) {
      const file = imageFiles[i];
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject("Resim okunamadı");
        reader.readAsDataURL(file);
      });
      images.push(dataUrl);
    }
  }

  // 5) Yeni ilan objesini hazırla
  const newListing = {
    title,
    price,
    area,
    bedrooms,
    bathrooms,
    city,
    district,
    location,
    furnished,
    petFriendly,
    features,
    images,
    description,
    landlord: {
      name: currentUser.name,
      _id: currentUser._id,
      avatar: currentUser.avatar || "",
      rating: currentUser.rating || 0,
    },
  };

  try {
    // 6) API isteğini gönder (örnek URL, kendi backend’inize göre değiştirin)
    const response = await fetch(apiUrl + "/api/listings/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newListing),
    });

    if (!response.ok) {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const errData = await response.json();
        alert("İlan eklenemedi:\n" + (errData.error || "Bilinmeyen hata"));
      } else {
        const htmlText = await response.text();
        alert("Sunucudan beklenmeyen çıktı:\n" + htmlText);
      }
      return;
    }

    // 7) Başarılıysa kullanıcıyı uyar, formu resetle
    const data = await response.json();
    alert("İlanınız başarıyla eklendi!");
    document.getElementById("add-listing-form").reset();

    // 8) “İlanlar” sayfasına geç ve güncel listeyi çek
    navigateToPage("listings");
    await fetchProperties();
  } catch (err) {
    console.error("İlan ekleme sırasında hata:", err);
    alert("Sunucuya bağlanırken hata oluştu:\n" + err.message);
  }
}

let selectedAvatarFile = null;
let currentPage = "home";
let currentPropertyPage = 1;
const propertiesPerPage = 12;
let properties = [];
let favorites = JSON.parse(localStorage.getItem("favorites")) || [];
let currentFilters = {
  city: "",
  district: "",
  priceMin: 0,
  priceMax: 50000,
  rooms: "",
  furnished: false,
  petFriendly: false,
  sortBy: "newest",
};

// --------------------------------------------------
// LOCAL STORAGE: FAVORİLER
// --------------------------------------------------
function loadFavorites() {
  const user = JSON.parse(localStorage.getItem("currentUser"));
  const storageKey = user ? `favorites_${user.email}` : "favorites_guest";
  favorites = JSON.parse(localStorage.getItem(storageKey)) || [];
}

function saveFavorites() {
  const user = JSON.parse(localStorage.getItem("currentUser"));
  const storageKey = user ? `favorites_${user.email}` : "favorites_guest";
  localStorage.setItem(storageKey, JSON.stringify(favorites));
}

// --------------------------------------------------
// UYGULAMA BAŞLATMA
// --------------------------------------------------
function initializeApp() {
  loadFavorites();
  updateUserUI();
  updateFavoritesCount();
  updateNavigation(); // ← burayı renderNavigation() yerine updateNavigation() yapın
  updateDistrictOptions();
  updatePriceRange();
  navigateToPage("home");
}

// --------------------------------------------------
// NAVIGATION & SAYFA GEÇİŞLERİ
// --------------------------------------------------
function navigateToPage(page) {
  currentPage = page;
  showPage(page);
  updateNavigation();
  history.pushState({ page }, null, "#" + page);

  if (page === "listings") {
    renderProperties();
  } else if (page === "favorites") {
    renderFavorites();
  } else if (page === "contact") {
    return;
  }
}

function showPage(page) {
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  const targetPage = document.getElementById(page);
  if (targetPage) {
    targetPage.classList.add("active");
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateNavigation() {
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.remove("active");
    if (link.getAttribute("data-page") === currentPage) {
      link.classList.add("active");
    }
  });
}

// --------------------------------------------------
// VIEW BUTONLARI (GRID / LIST)
// --------------------------------------------------
function toggleView(view) {
  const listingsGrid = document.getElementById("listings-grid");
  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.classList.remove("active");
    if (btn.getAttribute("data-view") === view) btn.classList.add("active");
  });
  if (listingsGrid) {
    if (view === "list") listingsGrid.classList.add("list-view");
    else listingsGrid.classList.remove("list-view");
  }
}

// --------------------------------------------------
// FAVORİ İŞLEMLERİ
// --------------------------------------------------
function toggleFavorite(propertyId, btnElement) {
  const index = favorites.indexOf(propertyId);
  if (index > -1) {
    favorites.splice(index, 1);
    btnElement.classList.remove("active");
  } else {
    favorites.push(propertyId);
    btnElement.classList.add("active");
  }
  saveFavorites();
  updateFavoritesCount();
  if (currentPage === "favorites") renderFavorites();
}

function updateFavoritesCount() {
  const countSpan = document.querySelector(".favorites-count");
  if (countSpan) countSpan.textContent = favorites.length.toString();
}

function renderFavorites() {
  const favoritesGrid = document.getElementById("favorites-grid");
  const favoritesCountText = document.getElementById("favorites-count-text");
  if (!favoritesGrid) return;

  const favoriteProperties = properties.filter((property) =>
    favorites.includes(property._id)
  );

  if (favoritesCountText) {
    if (favoriteProperties.length === 0) {
      favoritesCountText.textContent = "Henüz favori ilan eklenmemiş";
    } else {
      favoritesCountText.textContent = `${favoriteProperties.length} favori ilan`;
    }
  }

  favoritesGrid.innerHTML = "";

  if (favoriteProperties.length === 0) {
    favoritesGrid.innerHTML = `
      <div class="empty-favorites">
        <i class="fas fa-heart"></i>
        <h3>Henüz favori ilan yok</h3>
        <p>Beğendiğiniz ilanları favorilerinize ekleyerek buradan kolayca erişebilirsiniz</p>
        <button class="cta-btn primary" onclick="navigateToPage('listings')">İlanları Görüntüle</button>
      </div>
    `;
    return;
  }

  favoriteProperties.forEach((property) => {
    const propertyCard = createPropertyCard(property);
    favoritesGrid.appendChild(propertyCard);
  });

  animatePropertyCards();
}

// --------------------------------------------------
// BACKEND’DEN İLANLARI ÇEKME
// --------------------------------------------------
async function fetchProperties() {
  try {
    const response = await fetch(apiUrl + "/api/listings");
    if (!response.ok)
      throw new Error("İlanları çekerken hata: " + response.status);

    const data = await response.json();
    if (Array.isArray(data)) {
      properties = data;
    } else {
      properties = [data];
    }

    renderProperties();
  } catch (err) {
    console.error("fetchProperties hatası:", err);
    const listingsGrid = document.getElementById("listings-grid");
    if (listingsGrid) {
      listingsGrid.innerHTML = `
        <div class="no-results">
          <i class="fas fa-exclamation-triangle"></i>
          <h3>İlanlar yüklenemedi.</h3>
          <p>Lütfen daha sonra tekrar deneyin.</p>
        </div>`;
    }
  }
}

// --------------------------------------------------
// İLANLARI RENDER ETME
// --------------------------------------------------
function renderProperties() {
  const listingsGrid = document.getElementById("listings-grid");
  if (!listingsGrid) return;

  let filtered = filterProperties();
  filtered = sortProperties(filtered);

  const startIndex = (currentPropertyPage - 1) * propertiesPerPage;
  const endIndex = startIndex + propertiesPerPage;
  const paginated = filtered.slice(startIndex, endIndex);

  const totalListings = document.getElementById("total-listings");
  if (totalListings) {
    totalListings.textContent = filtered.length.toLocaleString("tr-TR");
  }

  listingsGrid.innerHTML = "";

  if (paginated.length === 0) {
    listingsGrid.innerHTML = `
      <div class="no-results">
        <i class="fas fa-search"></i>
        <h3>Arama kriterlerinize uygun ilan bulunamadı</h3>
        <p>Filtrelerinizi değiştirerek tekrar deneyin</p>
        <button class="cta-btn primary" onclick="clearFilters()">Filtreleri Temizle</button>
      </div>
    `;
    return;
  }

  paginated.forEach((property) => {
    const propertyCard = createPropertyCard(property);
    listingsGrid.appendChild(propertyCard);
  });

  updatePagination(filtered.length);
  animatePropertyCards();
}

function updatePagination(totalProperties) {
  const totalPages = Math.ceil(totalProperties / propertiesPerPage);
  const currentPageElement = document.getElementById("current-page");
  const totalPagesElement = document.getElementById("total-pages");
  if (currentPageElement) currentPageElement.textContent = currentPropertyPage;
  if (totalPagesElement) totalPagesElement.textContent = totalPages;
}

function changePage(direction) {
  const total = filterProperties().length;
  const totalPages = Math.ceil(total / propertiesPerPage);
  const newPage = currentPropertyPage + direction;
  if (newPage >= 1 && newPage <= totalPages) {
    currentPropertyPage = newPage;
    renderProperties();
    const listingsMain = document.querySelector(".listings-main");
    if (listingsMain) listingsMain.scrollIntoView({ behavior: "smooth" });
  }
}

// --------------------------------------------------
// FİLTRELEME VE SIRALAMA
// --------------------------------------------------
function filterProperties() {
  return properties.filter((property) => {
    // Şehir filtresi
    if (
      currentFilters.city &&
      property.city.toLowerCase() !== currentFilters.city.toLowerCase()
    ) {
      return false;
    }
    // İlçe filtresi varsa — ama anasayfada şu an yalnızca şehir seçiliyor
    if (
      currentFilters.district &&
      property.district.toLowerCase() !== currentFilters.district.toLowerCase()
    ) {
      return false;
    }
    // Fiyat filtresi
    if (
      property.price < currentFilters.priceMin ||
      property.price > currentFilters.priceMax
    ) {
      return false;
    }
    // Oda sayısı filtresi
    if (
      currentFilters.rooms &&
      property.bedrooms !== Number.parseInt(currentFilters.rooms)
    ) {
      return false;
    }
    // Eşyalı ve pet filtresi … (kusura bakmayın, anasayfada bu iki filtre yok)
    if (currentFilters.furnished && !property.furnished) {
      return false;
    }
    if (currentFilters.petFriendly && !property.petFriendly) {
      return false;
    }
    return true;
  });
}

function sortProperties(array) {
  const sorted = [...array];
  switch (currentFilters.sortBy) {
    case "price-low":
      return sorted.sort((a, b) => a.price - b.price);
    case "price-high":
      return sorted.sort((a, b) => b.price - a.price);
    case "newest":
      // Eğer API’den id yerine createdAt gibi bir tarih alanı dönüyorsa
      // onu kullanmak daha doğru olur; burada id üzerinden kıyaslıyoruz:
      return sorted.sort((a, b) => b._id.localeCompare(a._id));
    default:
      return sorted;
  }
}

// --------------------------------------------------
// İLAN KARTI OLUŞTURMA & DETAY SAYFASINA GEÇİŞ
// --------------------------------------------------
function createPropertyCard(property) {
  const isFav = favorites.includes(property._id);
  const card = document.createElement("div");
  card.className = "property-card";
  card.onclick = () => {
    showPropertyDetail(property._id);
    navigateToPage("detail");
  };
  card.innerHTML = `
    <div class="property-image">
      <img src="${
        property.images?.[0] || "https://via.placeholder.com/400x300"
      }" alt="${property.title}">
      <button class="favorite-btn ${isFav ? "active" : ""}"
        onclick="event.stopPropagation(); toggleFavorite('${
          property._id
        }', this)">
        <i class="fas fa-heart"></i>
      </button>
    </div>
    <div class="property-info">
      <h3 class="property-title">${property.title}</h3>
      <p class="property-location"><i class="fas fa-map-marker-alt"></i> ${
        property.location
      }</p>
      <p class="property-price">${property.price.toLocaleString(
        "tr-TR"
      )} TL/ay</p>
    </div>
  `;
  return card;
}

function showPropertyDetail(propertyId) {
  const property = properties.find((p) => p._id === propertyId);
  if (!property) return;
  const detailContainer = document.getElementById("property-detail");
  if (!detailContainer) return;

  // Resimler varsa kullan, yoksa fallback
  const images = property.images?.length
    ? property.images
    : [
        "https://cdn.pixabay.com/photo/2016/03/27/20/58/home-1284469_960_720.jpg",
      ];

  detailContainer.innerHTML = `
    <!-- ─────────── “Geri” Butonu ─────────── -->
    <button class="btn-secondary back-btn" onclick="navigateToPage('listings')">
      ← Geri
    </button>

    <div class="property-detail-header">
      <h1 class="property-detail-title">${property.title}</h1>
      <p class="property-detail-location">
        <i class="fas fa-map-marker-alt"></i> ${property.location}
      </p>
      <p class="property-detail-price">${property.price.toLocaleString(
        "tr-TR"
      )} TL/ay</p>
    </div>

    <div class="property-detail-content">
      <div class="property-main">
        <div class="property-gallery">
          <img
            src="${images[0]}"
            alt="${property.title}"
            class="main-image"
            id="main-image"
          >
          <div class="thumbnail-grid">
            ${images
              .map(
                (img, idx) => `
              <img
                src="${img}"
                alt="${property.title}"
                class="thumbnail ${idx === 0 ? "active" : ""}"
                onclick="changeMainImage('${img}', this)"
              >
            `
              )
              .join("")}
          </div>
        </div>

        <div class="property-details">
          <h3>Özellikler</h3>
          <div class="detail-grid">
            <div class="detail-item">
              <i class="fas fa-bed"></i>
              <span>${property.bedrooms} Yatak Odası</span>
            </div>
            <div class="detail-item">
              <i class="fas fa-bath"></i>
              <span>${property.bathrooms} Banyo</span>
            </div>
            <div class="detail-item">
              <i class="fas fa-ruler-combined"></i>
              <span>${property.area} m²</span>
            </div>
            <div class="detail-item">
              <i class="fas fa-couch"></i>
              <span>${property.furnished ? "Eşyalı" : "Eşyasız"}</span>
            </div>
            <div class="detail-item">
              <i class="fas fa-paw"></i>
              <span>${
                property.petFriendly
                  ? "Evcil Hayvan Dostu"
                  : "Evcil Hayvan Yasak"
              }</span>
            </div>
          </div>

          <h3>Açıklama</h3>
          <p>${property.description}</p>

          <button
  class="cta-btn primary full-width"
  onclick="openContactModal()"
>
  Mesaj Gönder
</button>

        </div>
      </div>

      <!-- Sağdaki sidebar -->
      <div class="property-sidebar">
        <div class="contact-landlord">
          <h3>Ev Sahibi ile İletişime Geç</h3>
          <div class="landlord-info">
            <img
              src="${property.landlord.avatar}"
              alt="${property.landlord.name}"
              class="landlord-avatar"
            >
            <div class="landlord-name">${property.landlord.name}</div>
            <div class="landlord-rating">
              ${"★".repeat(Math.floor(property.landlord.rating))}${"☆".repeat(
    5 - Math.floor(property.landlord.rating)
  )} ${property.landlord.rating}
            </div>
          </div>
       <button
  class="cta-btn primary full-width"
  onclick="openContactModal()"
>
  Mesaj Gönder
</button>
        </div>

        <div class="property-features-sidebar">
          <h3>Özellikler</h3>
          <ul class="features-list">
            ${property.features
              .map((f) => `<li><i class="fas fa-check"></i> ${f}</li>`)
              .join("")}
          </ul>
        </div>
      </div>
    </div>

    <!-- Harita Bölümü -->
    <div class="property-map">
      <h3>Konum</h3>
      <iframe
        class="map-embed"
        src="https://maps.google.com/maps?q=${encodeURIComponent(
          property.location
        )}&z=15&output=embed"
        allowfullscreen=""
        loading="lazy"
      ></iframe>
    </div>
  `;
}

// --------------------------------------------------
// GALLERY’DEKİ ANA RESMİ DEĞİŞTİRME
// --------------------------------------------------
function changeMainImage(newSrc, thumbnail) {
  const mainImage = document.getElementById("main-image");
  if (mainImage) mainImage.src = newSrc;
  document
    .querySelectorAll(".thumbnail")
    .forEach((t) => t.classList.remove("active"));
  if (thumbnail) thumbnail.classList.add("active");
}

// --------------------------------------------------
// MODAL AÇMA / KAPAMA
// --------------------------------------------------
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("active");
    document.body.style.overflow = "auto";
  }
}

// --------------------------------------------------
// AUTH (GİRİŞ / KAYIT) FORM İŞLEMLERİ
// --------------------------------------------------
function switchTab(tab) {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const forms = document.querySelectorAll(".auth-form");
  const modalTitle = document.getElementById("modal-title");
  tabBtns.forEach((btn) => btn.classList.remove("active"));
  forms.forEach((f) => f.classList.remove("active"));
  const activeBtn = document.querySelector(`[onclick="switchTab('${tab}')"]`);
  const activeForm = document.getElementById(`${tab}-form`);
  if (activeBtn) activeBtn.classList.add("active");
  if (activeForm) activeForm.classList.add("active");
  if (modalTitle)
    modalTitle.textContent = tab === "login" ? "Giriş Yap" : "Kayıt Ol";
}

// ────────────────────────────────────────────────────
// handleLogout: “Çıkış Yap” butonuna tıklandığında çağrılır
// ────────────────────────────────────────────────────
function handleLogout() {
  localStorage.removeItem("currentUser");
  updateUserUI();
  navigateToPage("home");
}

async function handleRegister(e) {
  e.preventDefault();

  // 0) Avatar seçilmiş mi kontrolü
  const avatarInput = document.getElementById("register-avatar");
  if (!avatarInput || !avatarInput.files || avatarInput.files.length === 0) {
    alert("Lütfen önce avatar olarak bir profil fotoğrafı seçin!");
    return;
  }
  // Global değişkene kaydediyoruz (isteğe bağlı)
  selectedAvatarFile = avatarInput.files[0];

  // 1) Form alanlarından değerleri oku
  const name = document.getElementById("registerName").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const phone = document.getElementById("registerPhone").value.trim();
  const password = document.getElementById("registerPassword").value;
  const passwordConfirm = document.getElementById(
    "registerPasswordConfirm"
  ).value;

  if (!name || !email || !phone || !password || !passwordConfirm) {
    alert("Lütfen tüm alanları doldurun.");
    return;
  }
  if (password !== passwordConfirm) {
    alert("Şifreler eşleşmiyor!");
    return;
  }

  // 2) Avatar dosyasını base64'e çevir
  let avatarDataUrl;
  try {
    avatarDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject("Avatar okunamadı");
      reader.readAsDataURL(selectedAvatarFile);
    });
  } catch (err) {
    alert(err);
    return;
  }

  // 3) Kayıt isteğini gönder
  try {
    const response = await fetch(apiUrl + "/api/users/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, password }),
    });
    const data = await response.json();

    if (!response.ok) {
      // Hata varsa ekrana yazdır
      return alert(data.error || "Kayıt başarısız!");
    }

    // 4) Başarılıysa localStorage'a kaydet
    const userObj = {
      _id: data.user._id,
      name: data.user.name,
      email: data.user.email,
      avatar: avatarDataUrl,
      rating: data.user.rating || 0,
    };
    localStorage.setItem("currentUser", JSON.stringify(userObj));

    // 5) UI güncelle, modal kapat, uyarı
    updateUserUI();
    closeModal("registerModal");
    alert(`Kayıt başarılı! Hoş geldin, ${userObj.name}`);

    // 6) Formu sıfırla
    e.target.reset();
    selectedAvatarFile = null;
  } catch (err) {
    console.error("handleRegister hata:", err);
    alert("Kayıt sırasında hata oluştu. Lütfen tekrar deneyin.");
  }
}

/* script.js */

// ────────────────────────────────────────────────────
// updateUserUI: Navbar’daki kullanıcı bilgisi / avatar ve ana sayfadaki register-button gizleme
// ────────────────────────────────────────────────────
// ────────────────────────────────────────────────────
// updateUserUI: Navbar’daki durum ve “Ücretsiz Kayıt Ol” butonunu kontrol eder
// ────────────────────────────────────────────────────
function updateUserUI() {
  const user = JSON.parse(localStorage.getItem("currentUser"));
  const authArea = document.getElementById("auth-area");
  if (!authArea) return;

  if (user && user.name) {
    // Eğer base64 avatar varsa <img> ekleyelim, yoksa sadece isim
    const avatarImg = user.avatar
      ? `<img src="${user.avatar}" alt="${user.name}" class="user-avatar" style="width:32px; height:32px; border-radius:50%; margin-right:8px;" />`
      : "";

    authArea.innerHTML = `
      ${avatarImg}
      <span id="user-name" style="font-weight:bold; margin-right:10px;">Hoşgeldin, ${user.name}</span>
      <button id="logout-button" class="login-btn" onclick="handleLogout()">Çıkış Yap</button>
    `;
  } else {
    // Giriş yapılmamışsa sadece “Giriş Yap” butonu
    authArea.innerHTML = `
      <button id="login-button" class="login-btn" onclick="openModal('loginModal')">Giriş Yap</button>
    `;
  }
}

/**
 * openContactModal:
 * - Eğer kullanıcı girişli değilse, login modal'ı açar.
 * - Eğer girişli ise, contact modal'ı açar.
 */
function openContactModal() {
  const user = JSON.parse(localStorage.getItem("currentUser"));
  if (!user || !user.name) {
    openModal("loginModal");
  } else {
    openModal("contactModal");
  }
}

// searchHomes()
// -------------------------------
//  XX) Anasayfadan Arama (search) Fonksiyonu
// -------------------------------
function searchHomes() {
  // 1) Anasayfadaki filtre elemanlarının değerlerini oku
  const citySelect = document.getElementById("hero-city");
  const roomsSelect = document.getElementById("hero-rooms");
  const priceSelect = document.getElementById("hero-price");

  if (!citySelect || !roomsSelect || !priceSelect) {
    // Eğer bu elementler bulunamazsa, doğrudan İlanlar sayfasına yönlendir
    navigateToPage("listings");
    return;
  }

  const selectedCity = citySelect.value; // örn: "istanbul"
  const selectedRooms = roomsSelect.value; // örn: "2"
  const selectedPrice = priceSelect.value; // örn: "5000-10000"

  // 2) global currentFilters nesnesini güncelle
  currentFilters.city = selectedCity || "";
  currentFilters.rooms = selectedRooms || "";
  if (selectedPrice) {
    // "0-5000" veya "5000-10000" gibi bir string ise, min ve max değerleri ayıkla
    if (selectedPrice.includes("-")) {
      const [minP, maxP] = selectedPrice.split("-").map((s) => Number(s));
      currentFilters.priceMin = minP;
      currentFilters.priceMax = maxP;
    } else if (selectedPrice.endsWith("+")) {
      // "20000+" gibi bir seçenek varsa
      currentFilters.priceMin = Number(selectedPrice.replace("+", ""));
      currentFilters.priceMax = Infinity;
    } else {
      currentFilters.priceMin = 0;
      currentFilters.priceMax = Infinity;
    }
  } else {
    // Fiyat seçilmemişse
    currentFilters.priceMin = 0;
    currentFilters.priceMax = 50000;
  }

  // Eğer oda sayısını da number’a çevirmeniz gerekiyorsa:
  // currentFilters.rooms = selectedRooms ? Number(selectedRooms) : "";
  // (Script’in önceki versiyonuna göre rooms zaten string olarak alınıyor;
  // filterProperties() içinde Number.parseInt ile karşılaştırılıyor.)

  // 3) İlanlar sayfasına geçiş yap
  navigateToPage("listings");
  // Not: navigateToPage içinde, page === "listings" => renderProperties() çağrılıyor;
  // renderProperties() kodu da filterProperties()’ı kullanıyor ve global currentFilters ile filtreleme yapıyor.
}

// --------------------------------------------------
// İLANLAR İÇİN MOCK VERİLER (ÖRNEK SHOWCASE)
// --------------------------------------------------
// Gerçek backend kullanmak için bu bloğu silip fetchProperties()'i çağırabilirsiniz.
(function loadSampleProperties() {
  /*properties = [
    {
      _id: "1",
      title: "Lüks 3+1 Daire",
      location: "Kadıköy, İstanbul",
      price: 15000,
      bedrooms: 3,
      bathrooms: 2,
      area: 120,
      images: [
        "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80",
      ],
      description:
        "Kadıköy'ün merkezinde, deniz manzaralı, modern ve ferah 3+1 daire. Tüm odalar geniş ve aydınlık. Metro ve otobüs duraklarına yürüme mesafesinde.",
      features: ["Eşyalı", "Balkon", "Asansör", "Güvenlik", "Otopark"],
      furnished: true,
      petFriendly: true,
      city: "istanbul",
      district: "kadikoy",
      landlord: {
        name: "Ahmet Yılmaz",
        rating: 4.8,
        avatar:
          "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80",
      },
      coordinates: "40.9903,29.0253",
    },
    {
      _id: "2",
      title: "Modern 2+1 Stüdyo",
      location: "Çankaya, Ankara",
      price: 8500,
      bedrooms: 2,
      bathrooms: 1,
      area: 85,
      images: [
        "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=800&q=80",
      ],
      description:
        "Çankaya'da yeni yapılmış modern komplekste 2+1 daire. Merkezi konumda, alışveriş merkezlerine yakın.",
      features: ["Eşyalı", "Klima", "Güvenlik", "Spor Salonu"],
      furnished: true,
      petFriendly: false,
      city: "ankara",
      district: "cankaya",
      landlord: {
        name: "Fatma Demir",
        rating: 4.5,
        avatar:
          "https://images.unsplash.com/photo-1494790108755-2616b612b786?auto=format&fit=crop&w=150&q=80",
      },
      coordinates: "39.9208,32.8541",
    },
    {
      _id: "3",
      title: "Deniz Manzaralı Villa",
      location: "Konak, İzmir",
      price: 25000,
      bedrooms: 4,
      bathrooms: 3,
      area: 200,
      images: [
        "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1505843513577-22bb7d21e455?auto=format&fit=crop&w=800&q=80",
      ],
      description:
        "İzmir Konak'ta deniz manzaralı müstakil villa. Geniş bahçe, özel otopark ve denize sıfır konumda.",
      features: ["Bahçe", "Deniz Manzarası", "Otopark", "Şömine", "Jakuzi"],
      furnished: false,
      petFriendly: true,
      city: "izmir",
      district: "konak",
      landlord: {
        name: "Mehmet Özkan",
        rating: 4.9,
        avatar:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80",
      },
      coordinates: "38.4192,27.1287",
    },
    {
      _id: "4",
      title: "Merkezi 1+1 Daire",
      location: "Muratpaşa, Antalya",
      price: 6000,
      bedrooms: 1,
      bathrooms: 1,
      area: 60,
      images: [
        "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=800&q=80",
      ],
      description:
        "Antalya merkezinde, denize yakın konumda 1+1 daire. Yeni tadilat görmüş, temiz ve bakımlı.",
      features: ["Klima", "Balkon", "İnternet", "Güvenlik"],
      furnished: true,
      petFriendly: false,
      city: "antalya",
      district: "muratpasa",
      landlord: {
        name: "Ayşe Kaya",
        rating: 4.3,
        avatar:
          "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80",
      },
      coordinates: "36.8969,30.7133",
    },
    {
      _id: "5",
      title: "Geniş 4+1 Dubleks",
      location: "Nilüfer, Bursa",
      price: 12000,
      bedrooms: 4,
      bathrooms: 2,
      area: 160,
      images: [
        "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800&q=80",
      ],
      description:
        "Bursa Nilüfer'de sitede 4+1 dubleks daire. Geniş teras, özel bahçe ve otopark imkanı.",
      features: ["Dubleks", "Teras", "Bahçe", "Otopark", "Güvenlik"],
      furnished: false,
      petFriendly: true,
      city: "bursa",
      district: "nilufer",
      landlord: {
        name: "Can Arslan",
        rating: 4.7,
        avatar:
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80",
      },
      coordinates: "40.2669,29.0634",
    },
    {
      _id: "6",
      title: "Şık 2+1 Loft",
      location: "Beşiktaş, İstanbul",
      price: 18000,
      bedrooms: 2,
      bathrooms: 1,
      area: 95,
      images: [
        "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80",
      ],
      description:
        "Beşiktaş'ta modern loft tarzı daire. Yüksek tavanlar, geniş pencereler ve şehir manzarası.",
      features: ["Loft", "Şehir Manzarası", "Modern", "Merkezi"],
      furnished: true,
      petFriendly: false,
      city: "istanbul",
      district: "besiktas",
      landlord: {
        name: "Zeynep Çelik",
        rating: 4.6,
        avatar:
          "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80",
      },
      coordinates: "41.0422,29.0061",
    },
  ];*/
})();

// --------------------------------------------------
// SCROLL ANIMATIONS (OPSYONEL)
// --------------------------------------------------
function initializeScrollAnimations() {
  const observerOptions = { threshold: 0.1, rootMargin: "0px 0px -50px 0px" };
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.animationPlayState = "running";
      }
    });
  }, observerOptions);
  const animatedElements = document.querySelectorAll(
    ".feature-card, .city-card"
  );
  animatedElements.forEach((el) => {
    el.style.animationPlayState = "paused";
    observer.observe(el);
  });
}

function animatePropertyCards() {
  const cards = document.querySelectorAll(".property-card");
  cards.forEach((card, idx) => {
    card.style.animationDelay = `${idx * 0.1}s`;
    card.classList.add("animate-in");
  });
}

// --------------------------------------------------
// İLETİŞİM FORMU
// --------------------------------------------------
function handleContactForm(e) {
  e.preventDefault();
  alert("Mesajınız başarıyla gönderildi! En kısa sürede size dönüş yapacağız.");
  e.target.reset();
  closeModal("contactModal");
}

// --------------------------------------------------
// İLETİŞİM FORMU
// --------------------------------------------------
function handleContactLandlord(e) {
  e.preventDefault();

  // Form alanlarından değerleri oku
  const name = document.getElementById("contactName").value;
  const email = document.getElementById("contactEmail").value;
  const phone = document.getElementById("contactPhone").value;
  const message = document.getElementById("contactMessage").value;

  // Backend’e POST isteği gönder
  fetch(apiUrl + "/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, phone, message }),
  })
    .then((res) => {
      if (!res.ok) throw new Error("Mesaj gönderilemedi");
      return res.json();
    })
    .then((data) => {
      alert("Mesajınız başarıyla iletildi!");
      closeModal("contactModal");
      e.target.reset();
    })
    .catch((err) => {
      console.error("handleContactLandlord hata:", err);
      alert("Mesaj gönderilirken bir hata oluştu. Lütfen tekrar deneyin.");
    });
}

// --------------------------------------------------
// AUTH FORMLARI
// --------------------------------------------------
// -------------------------------
// 15) Login / Register İşlemleri
// -------------------------------

// ────────────────────────────────────────────────────
// handleLogin: “Giriş Yap” formu gönderildiğinde çağrılır
// ────────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!email || !password) {
    alert("Lütfen e-posta ve şifre girin.");
    return;
  }

  try {
    // 1) Backend’e POST isteği gönderin (örnek URL, kendi API’nize göre değiştirin)
    const response = await fetch(apiUrl + "/api/users/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Giriş başarısız!");
      return;
    }

    // 2) Gelen kullanıcı verisini localStorage’a kaydet
    const userObj = {
      _id: data.user._id,
      name: data.user.name,
      email: data.user.email,
      avatar: data.user.avatar || "",
      rating: data.user.rating || 0,
    };
    localStorage.setItem("currentUser", JSON.stringify(userObj));

    // 3) UI güncelle, modal kapat, form resetle
    updateUserUI();
    closeModal("loginModal");
    e.target.reset();

    -(
      // 4) Giriş başarılı olduğunda “Ev Sahibi ile İletişime Geç” modal’ını açıyordu:
      (-openModal("contactModal"))
    );
  } catch (err) {
    console.error("handleLogin hata:", err);
    alert("Giriş işlemi sırasında hata oluştu. Lütfen tekrar deneyin.");
  }
}

async function handleRegister(e) {
  e.preventDefault();

  // … alan kontrolü …
  // ***** AVATAR DOSYASI ZORUNLU DEĞİL, OPSİYONEL OLARAK EKLİYORUZ *****
  let avatarDataUrl = "";
  if (selectedAvatarFile) {
    avatarDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject("Avatar okunamadı");
      reader.readAsDataURL(selectedAvatarFile);
    });
  }
  // ****************************************************************************

  try {
    const response = await fetch(apiUrl + "/api/users/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Kayıt başarısız");
      return;
    }

    const userObj = {
      _id: data.user._id,
      name: data.user.name,
      email: data.user.email,
      avatar: avatarDataUrl, // base64 string
      rating: 0,
    };
    localStorage.setItem("currentUser", JSON.stringify(userObj));

    updateUserUI();
    closeModal("loginModal");
    selectedAvatarFile = null; // reset
    alert("Kayıt başarılı! Hoş geldin, " + userObj.name);
  } catch (err) {
    console.error("handleRegister hata:", err);
    alert("Kayıt sırasında hata oluştu. Lütfen tekrar deneyin.");
  }
}

// --------------------------------------------------
// FİLTRE BAŞLATMA
// --------------------------------------------------
function updateDistrictOptions() {
  const citySelect = document.getElementById("filter-city");
  const districtSelect = document.getElementById("filter-district");
  if (!citySelect || !districtSelect) return;
  const districts = {
    istanbul: [
      "Kadıköy",
      "Beşiktaş",
      "Şişli",
      "Beyoğlu",
      "Üsküdar",
      "Bakırköy",
    ],
    ankara: ["Çankaya", "Kızılay", "Ulus", "Bahçelievler", "Yenimahalle"],
    izmir: ["Konak", "Karşıyaka", "Bornova", "Alsancak", "Buca"],
    antalya: ["Muratpaşa", "Kepez", "Konyaaltı", "Lara", "Kaleiçi"],
    bursa: ["Nilüfer", "Osmangazi", "Yıldırım", "Mudanya", "Gemlik"],
  };
  const selectedCity = citySelect.value;
  districtSelect.innerHTML = `<option value="">Tümü</option>`;
  if (selectedCity && districts[selectedCity]) {
    districts[selectedCity].forEach((dist) => {
      const opt = document.createElement("option");
      opt.value = dist.toLowerCase();
      opt.textContent = dist;
      districtSelect.appendChild(opt);
    });
  }
}

function updatePriceRange() {
  const priceMin = document.getElementById("price-min");
  const priceMax = document.getElementById("price-max");
  const priceMinDisplay = document.getElementById("price-min-display");
  const priceMaxDisplay = document.getElementById("price-max-display");
  if (!priceMin || !priceMax || !priceMinDisplay || !priceMaxDisplay) return;
  let minVal = Number.parseInt(priceMin.value);
  let maxVal = Number.parseInt(priceMax.value);
  if (minVal >= maxVal) {
    minVal = maxVal - 1000;
    priceMin.value = minVal;
  }
  priceMinDisplay.textContent = minVal.toLocaleString("tr-TR");
  priceMaxDisplay.textContent = maxVal.toLocaleString("tr-TR");
  currentFilters.priceMin = minVal;
  currentFilters.priceMax = maxVal;
  applyFilters();
}

// --------------------------------------------------
// FİLTRELEME
// --------------------------------------------------
function selectRooms(rooms) {
  document
    .querySelectorAll(".room-btn")
    .forEach((btn) => btn.classList.remove("active"));
  const selectedBtn = document.querySelector(`[data-rooms="${rooms}"]`);
  if (selectedBtn) {
    selectedBtn.classList.add("active");
    currentFilters.rooms = rooms;
  }
  applyFilters();
}

function applyFilters() {
  const cityFilter = document.getElementById("filter-city");
  const districtFilter = document.getElementById("filter-district");
  const furnishedFilter = document.getElementById("furnished");
  const petFriendlyFilter = document.getElementById("pet-friendly");
  const sortByFilter = document.getElementById("sort-by");
  if (cityFilter) currentFilters.city = cityFilter.value.toLowerCase();
  if (districtFilter)
    currentFilters.district = districtFilter.value.toLowerCase();
  if (furnishedFilter) currentFilters.furnished = furnishedFilter.checked;
  if (petFriendlyFilter) currentFilters.petFriendly = petFriendlyFilter.checked;
  if (sortByFilter) currentFilters.sortBy = sortByFilter.value;
  currentPropertyPage = 1;
  renderProperties();
}

function clearFilters() {
  currentFilters = {
    city: "",
    district: "",
    priceMin: 0,
    priceMax: 50000,
    rooms: "",
    furnished: false,
    petFriendly: false,
    sortBy: "newest",
  };
  document.getElementById("filter-city").value = "";
  document.getElementById("filter-district").value = "";
  document.getElementById("price-min").value = 0;
  document.getElementById("price-max").value = 50000;
  document.getElementById("furnished").checked = false;
  document.getElementById("pet-friendly").checked = false;
  document.getElementById("sort-by").value = "newest";
  document
    .querySelectorAll(".room-btn")
    .forEach((btn) => btn.classList.remove("active"));
  updatePriceRange();
  updateDistrictOptions();
  renderProperties();
}

// script.js

// ➊ Avatar için global değişken

// ────────────────────────────────────────────────────
// DOMContentLoaded: Event listener’lar burada kuruluyor
// ────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initializeApp();
  updateUserUI();
  fetchProperties();

  // Login / Register formları
  document
    .getElementById("login-form")
    ?.addEventListener("submit", handleLogin);
  document
    .getElementById("register-form")
    ?.addEventListener("submit", handleRegister);

  // ➋ “Profil Fotoğrafı (Avatar)” input’u seçeneğin değişimini dinle
  const avatarInput = document.getElementById("register-avatar");
  if (avatarInput) {
    avatarInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files.length > 0) {
        selectedAvatarFile = e.target.files[0];
      } else {
        selectedAvatarFile = null;
      }
    });
  }

  // “İlan Ekle” formu
  document
    .getElementById("add-listing-form")
    ?.addEventListener("submit", handleAddListing);

  // Navbar linkleri
  document.querySelectorAll(".nav-link").forEach((link) =>
    link.addEventListener("click", (e) => {
      e.preventDefault();
      navigateToPage(link.getAttribute("data-page"));
    })
  );

  // İlan listesindeki view-toggle butonları
  document
    .querySelectorAll(".view-btn")
    .forEach((btn) =>
      btn.addEventListener("click", () =>
        toggleView(btn.getAttribute("data-view"))
      )
    );

  // Filters Sidebar: Şehir → İlçe → Fiyat → Oda → Eşyalı → Pet
  const cityFilter = document.getElementById("filter-city");
  if (cityFilter) {
    cityFilter.addEventListener("change", () => {
      updateDistrictOptions();
      applyFilters();
    });
  }
  const districtFilter = document.getElementById("filter-district");
  if (districtFilter) {
    districtFilter.addEventListener("change", applyFilters);
  }
  const sortByFilter = document.getElementById("sort-by");
  if (sortByFilter) {
    sortByFilter.addEventListener("change", applyFilters);
  }
  document
    .getElementById("price-min")
    ?.addEventListener("input", updatePriceRange);
  document
    .getElementById("price-max")
    ?.addEventListener("input", updatePriceRange);
  document
    .getElementById("furnished")
    ?.addEventListener("change", applyFilters);
  document
    .getElementById("pet-friendly")
    ?.addEventListener("change", applyFilters);
  document
    .querySelectorAll(".room-btn")
    .forEach((btn) =>
      btn.addEventListener("click", () =>
        selectRooms(btn.getAttribute("data-rooms"))
      )
    );

  // Anasayfa “Ara” (Hero Search) butonu
  document.getElementById("search-hero-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    const cityInput = document.getElementById("hero-city")?.value;
    const roomsInput = document.getElementById("hero-rooms")?.value;
    const priceInput = document.getElementById("hero-price")?.value;
    if (cityInput) currentFilters.city = cityInput.toLowerCase();
    if (roomsInput) currentFilters.rooms = roomsInput;
    if (priceInput) {
      const [min, max] = priceInput.split("-");
      currentFilters.priceMin = Number.parseInt(min) || 0;
      currentFilters.priceMax =
        max === "+" ? Infinity : Number.parseInt(max) || Infinity;
    }
    navigateToPage("listings");
  });

  // Site-genel “Bize Ulaşın” formu
  document
    .querySelector(".contact-form")
    ?.addEventListener("submit", handleContactForm);

  // “Ev Sahibi ile İletişime Geç” formu
  document
    .getElementById("contact-landlord-form")
    ?.addEventListener("submit", handleContactLandlord);

  // Modalları kapatmak için: arkaplana tıklanırsa veya ESC tuşu
  window.addEventListener("click", (e) => {
    document.querySelectorAll(".modal").forEach((modal) => {
      if (e.target === modal) {
        modal.classList.remove("active");
        document.body.style.overflow = "auto";
      }
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal.active").forEach((modal) => {
        modal.classList.remove("active");
        document.body.style.overflow = "auto";
      });
    }
  });
});

// ────────────────────────────────────────────────────
// updateUserUI: Navbar’daki kullanıcı bilgisi / avatar
// ────────────────────────────────────────────────────
function updateUserUI() {
  const user = JSON.parse(localStorage.getItem("currentUser"));
  const authArea = document.getElementById("auth-area");
  const registerBtn = document.getElementById("register-button"); // Anasayfa’daki “Ücretsiz Kayıt Ol” butonu

  if (user && user.name) {
    // Navbar: avatar + isim + çıkış butonu
    const avatarImg = user.avatar
      ? `<img src="${user.avatar}" alt="${user.name}" class="user-avatar" style="width:32px; height:32px; border-radius:50%; margin-right:8px;" />`
      : "";

    authArea.innerHTML = `
      ${avatarImg}
      <span id="user-name" style="font-weight:bold; margin-right:10px;">Hoşgeldin, ${user.name}</span>
      <button id="logout-button" class="login-btn" onclick="handleLogout()">Çıkış Yap</button>
    `;

    // Anasayfa “Ücretsiz Kayıt Ol” butonunu gizle
    if (registerBtn) registerBtn.style.display = "none";
  } else {
    authArea.innerHTML = `
      <button id="login-button" class="login-btn" onclick="openModal('loginModal')">Giriş Yap</button>
    `;
    // Anasayfa “Ücretsiz Kayıt Ol” butonunu göster
    if (registerBtn) registerBtn.style.display = "inline-block";
  }
}

// ────────────────────────────────────────────────────
// handleRegister: Kayıt formu submit işlemi
// ────────────────────────────────────────────────────
async function handleRegister(e) {
  e.preventDefault();

  // 0) Avatar seçilmiş mi kontrolü
  if (!selectedAvatarFile) {
    alert("Lütfen önce avatar olarak bir fotoğraf yükleyin.");
    return;
  }

  // 1) Form alanlarından değerleri oku
  const name = document.getElementById("registerName").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const phone = document.getElementById("registerPhone").value.trim();
  const password = document.getElementById("registerPassword").value;
  const passwordConfirm = document.getElementById(
    "registerPasswordConfirm"
  ).value;

  if (!name || !email || !phone || !password || !passwordConfirm) {
    alert("Lütfen tüm alanları doldurun.");
    return;
  }
  if (password !== passwordConfirm) {
    alert("Şifreler eşleşmiyor!");
    return;
  }

  // 2) Seçilen avatar dosyasını base64’e dönüştür
  let avatarDataUrl = "";
  try {
    avatarDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject("Avatar okunamadı");
      reader.readAsDataURL(selectedAvatarFile);
    });
  } catch {
    alert("Avatar okunurken bir hata oluştu. Lütfen başka bir dosya seçin.");
    return;
  }

  // 3) Backend’e POST isteği
  try {
    const response = await fetch(apiUrl + "/api/users/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Kayıt başarısız");
      return;
    }

    // 4) Başarılı kayıt => localStorage’a avatar da ekle
    const userObj = {
      _id: data.user._id,
      name: data.user.name,
      email: data.user.email,
      avatar: avatarDataUrl,
      rating: 0,
    };
    localStorage.setItem("currentUser", JSON.stringify(userObj));
    updateUserUI();
    closeModal("loginModal");
    selectedAvatarFile = null;
    alert("Kayıt başarılı! Hoş geldin, " + userObj.name);
  } catch (err) {
    console.error("handleRegister hata:", err);
    alert("Kayıt sırasında hata oluştu. Lütfen tekrar deneyin.");
  }
}

// ────────────────────────────────────────────────────
// Gerekli CSS (styles.css içine ekleyin):
// ────────────────────────────────────────────────────
/*
.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  margin-right: 8px;
  vertical-align: middle;
}
*/

window.addEventListener("popstate", (event) => {
  const page = event.state?.page || "home";
  navigateToPage(page);
});
// script.js

// ---------------------------
// 1. "İlan Ekle" form handler
// ---------------------------
// ---------------------------
// 1. "İlan Ekle" form handler (GÜNCELLENMİŞ HALİ)
// ---------------------------
async function handleAddListing(e) {
  e.preventDefault();

  // 1.1) Önce kullanıcı girişli mi kontrol et
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  if (!currentUser || !currentUser._id) {
    alert("İlan eklemek için öncelikle giriş yapmalısınız.");
    return;
  }

  // 1.2) Form alanlarından değerleri oku
  const title = document.getElementById("listing-title").value.trim();
  const price = Number(document.getElementById("listing-price").value);
  const area = Number(document.getElementById("listing-area").value);
  const bedrooms = Number(document.getElementById("listing-bedrooms").value);
  const bathrooms = Number(document.getElementById("listing-bathrooms").value);
  const city = document.getElementById("listing-city").value.trim();
  const district = document.getElementById("listing-district").value.trim();
  const location = document.getElementById("listing-location").value.trim();
  const furnished = document.getElementById("listing-furnished").checked;
  const petFriendly = document.getElementById("listing-petFriendly").checked;
  const featuresRaw = document.getElementById("listing-features").value.trim();
  const description = document
    .getElementById("listing-description")
    .value.trim();
  const imageUrl = document.getElementById("listing-image").value.trim();

  // 1.3) Özellikler virgülle ayrılmışsa diziye çevir
  const features = featuresRaw
    ? featuresRaw
        .split(",")
        .map((f) => f.trim())
        .filter((f) => f.length)
    : [];

  // 1.4) Resim URL’leri: şimdilik tek URL alıyoruz
  const images = imageUrl ? [imageUrl] : [];

  // 1.5) Yeni ilan objesini hazırla (backend schema’sına uygun)
  const newListing = {
    title,
    price,
    area,
    bedrooms,
    bathrooms,
    city,
    district,
    location,
    furnished,
    petFriendly,
    features,
    images,
    description,
    landlord: {
      name: currentUser.name,
      _id: currentUser._id,
      avatar: currentUser.avatar || "",
      rating: currentUser.rating || 0,
    },
  };

  try {
    // 1.6) API isteğini gönder
    const response = await fetch(apiUrl + "/api/listings/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newListing),
    });

    // 1.7) Eğer status 200–299 değilse (response.ok false), önce content-type’a bak
    if (!response.ok) {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        // JSON döndüyse JSON.parse edip error alanını göster
        const errData = await response.json();
        const errMsg =
          errData.error || "İlan eklenirken sunucudan gelen hata bilinmiyor.";
        alert("İlan eklenemedi:\n" + errMsg);
      } else {
        // JSON değilse (örneğin HTML hata sayfası), text() alıp göster
        const htmlText = await response.text();
        alert("Sunucudan beklenmeyen çıktı geldi:\n" + htmlText);
      }
      return;
    }

    // 1.8) Başarılıysa JSON olarak parse et ve kullanıcıyı bilgilendir
    const data = await response.json();
    alert("İlanınız başarıyla eklendi!");
    document.getElementById("add-listing-form").reset();
    navigateToPage("listings");
  } catch (err) {
    // 1.9) Network hatası veya JSON.parse hatası gibi diğer durumlar
    console.error("İlan ekleme sırasında hata:", err);
    alert("Sunucuya bağlanırken bir hata oluştu:\n" + err.message);
  }
}

// ------------------------
// 2. DOMContentLoaded içinde "İlan Ekle" listener’ı ekle
// ------------------------
document.addEventListener("DOMContentLoaded", () => {
  // … Mevcut initializeApp, updateUserUI, fetchProperties vs. kodlarınız …

  // “İlan Ekle” formunu dinle
  document
    .getElementById("add-listing-form")
    ?.addEventListener("submit", handleAddListing);
});

// ------------------------
// 2. DOMContentLoaded içine ekleme
// ------------------------
document.addEventListener("DOMContentLoaded", () => {
  initializeApp();
  updateUserUI();

  // … mevcut event listener’lar …

  // 2.1 “İlan Ekle” formunu dinle
  document
    .getElementById("add-listing-form")
    ?.addEventListener("submit", handleAddListing);

  // … diğer kodlar …
});

// --------------------------------------------------
// UTILITY
// --------------------------------------------------
function formatPrice(price) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 0,
  }).format(price);
}

// --------------------------------------------------
// 0) Drag & Drop için destek ve file-input listener’ları
// --------------------------------------------------

(function setupImageUploadArea() {
  const dropArea = document.getElementById("drop-area");
  const fileInput = document.getElementById("listing-image-file");

  // Sürükleme (drag) bölgesine geldiğinde stil değişikliği
  ["dragenter", "dragover"].forEach((evt) => {
    dropArea.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropArea.style.backgroundColor = "#f0f0f0";
    });
  });

  // Sürüklemeden çıkınca eski haline dön
  ["dragleave", "drop"].forEach((evt) => {
    dropArea.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropArea.style.backgroundColor = "transparent";
    });
  });

  // Dosya bırakıldığında
  dropArea.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
    const file = e.dataTransfer.files[0];
    fileInput.files = e.dataTransfer.files; // input’un içini doldur
    // resim yükleme fonksiyonunu çağır
    uploadImage(file);
  });

  // “Dosya Seç” butonundan bir dosya seçildiğinde
  fileInput.addEventListener("change", (e) => {
    if (!fileInput.files || fileInput.files.length === 0) return;
    const file = fileInput.files[0];
    uploadImage(file);
  });
})();

// --------------------------------------------------
// 1) “uploadImage” fonksiyonu: seçilen resmi Backend’e yollayıp
//    indirme URL’sini alacak ve gizli <input id="listing-image-url">’a yazacak
// --------------------------------------------------

async function uploadImage(file) {
  // 1.1) Sadece görüntü dosyası mı kontrolü
  if (!file.type.startsWith("image/")) {
    alert("Lütfen yalnızca resim (image) dosyası seçin.");
    return;
  }

  // 1.2) Yükleme esnasında button / input’u kitlemek isterseniz:
  const dropArea = document.getElementById("drop-area");
  dropArea.textContent = "Yükleniyor… Lütfen bekleyin";
  dropArea.style.pointerEvents = "none";

  try {
    const formData = new FormData();
    formData.append("image", file);

    // 1.3) Burada “/api/images/upload” endpoint’i örnek verdim.
    //      Sizin backend’te imageRoutes nasıl tanımlandıysa ona göre değiştirin.
    const res = await fetch(apiUrl + "/api/images/upload", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      // “application/json” ise JSON’u parse edip hata mesajını göster
      const cType = res.headers.get("Content-Type") || "";
      if (cType.includes("application/json")) {
        const errData = await res.json();
        throw new Error(errData.error || "Resim yüklemede hata");
      } else {
        const text = await res.text();
        throw new Error("Beklenmeyen cevap: " + text);
      }
    }

    const data = await res.json();
    // Backend’in “{ url: 'https://.../abc123.jpg' }” formatında yanıt döndüğünü varsayıyoruz
    const imageUrl = data.url;
    if (!imageUrl) throw new Error("Sunucu URL döndürmedi");

    // 1.4) Gizli input’a bu URL’i yaz
    document.getElementById("listing-image-url").value = imageUrl;

    dropArea.textContent = "Dosya yüklendi ✓";

    // Birkaç saniye sonra metin eski haline dönebilir:
    setTimeout(() => {
      dropArea.textContent =
        "Buraya görseli sürükleyip bırakın\n(veya “Dosya Seç” düğmesine tıklayın)";
      dropArea.style.pointerEvents = "auto";
    }, 2000);
  } catch (err) {
    console.error("Resim yükleme hatası:", err);
    alert("Resim yükleme sırasında hata: " + err.message);
    dropArea.textContent = "Hata! Tekrar deneyin";
    setTimeout(() => {
      dropArea.textContent =
        "Buraya görseli sürükleyip bırakın\n(veya “Dosya Seç” düğmesine tıklayın)";
      dropArea.style.pointerEvents = "auto";
    }, 2000);
  }
}

// --------------------------------------------------
// 2) “handleAddListing” içinde, artık images’i “listing-image-url” kaynaklı set edelim
// --------------------------------------------------

async function handleAddListing(e) {
  e.preventDefault();

  // 2.1) Kullanıcı giriş kontrolü
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  if (!currentUser || !currentUser._id) {
    alert("İlan eklemek için öncelikle giriş yapmalısınız.");
    return;
  }

  // 2.2) Form elemanlarından değerleri oku
  const title = document.getElementById("listing-title").value.trim();
  const price = Number(document.getElementById("listing-price").value);
  const area = Number(document.getElementById("listing-area").value);
  const bedrooms = Number(document.getElementById("listing-bedrooms").value);
  const bathrooms = Number(document.getElementById("listing-bathrooms").value);
  const city = document.getElementById("listing-city").value.trim();
  const district = document.getElementById("listing-district").value.trim();
  const location = document.getElementById("listing-location").value.trim();
  const furnished = document.getElementById("listing-furnished").checked;
  const petFriendly = document.getElementById("listing-petFriendly").checked;
  const featuresRaw = document.getElementById("listing-features").value.trim();
  const description = document
    .getElementById("listing-description")
    .value.trim();

  // 2.3) Özellikler virgülle ayrılmış dizi
  const features = featuresRaw
    ? featuresRaw
        .split(",")
        .map((f) => f.trim())
        .filter((f) => f.length)
    : [];

  // 2.4) Dosyadan yüklenmiş URL’i al
  const imageUrl = document.getElementById("listing-image-url").value.trim();
  const images = imageUrl ? [imageUrl] : [];

  // 2.5) Eğer ne URL ne dosya yoksa uyar
  if (images.length === 0) {
    alert("Lütfen önce bir görsel yükleyin (dosya seçin veya sürükleyin).");
    return;
  }

  // 2.6) Yeni ilan objesi
  const newListing = {
    title,
    price,
    area,
    bedrooms,
    bathrooms,
    city,
    district,
    location,
    furnished,
    petFriendly,
    features,
    images,
    description,
    landlord: {
      name: currentUser.name,
      _id: currentUser._id,
      avatar:
        currentUser.avatar ||
        "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png",
      rating: currentUser.rating || 0,
    },
  };

  try {
    // 2.7) “/api/listings” endpoint’ine JSON olarak gönder
    const response = await fetch(apiUrl + "/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newListing),
    });

    if (!response.ok) {
      // Hata durumunda gelen response’a göre uyarı göster
      const cType = response.headers.get("content-type") || "";
      if (cType.includes("application/json")) {
        const errData = await response.json();
        alert(
          "İlan eklenemedi:\n" + (errData.error || JSON.stringify(errData))
        );
      } else {
        const txt = await response.text();
        alert("Sunucudan beklenmeyen çıktı:\n" + txt);
      }
      return;
    }

    const data = await response.json();
    alert("İlanınız başarıyla eklendi!");
    document.getElementById("add-listing-form").reset();
    // Resim URL’ini de sıfırla
    document.getElementById("listing-image-url").value = "";
    navigateToPage("listings");
  } catch (err) {
    console.error("İlan ekleme sırasında hata:", err);
    alert("Sunucuya bağlanırken hata:\n" + err.message);
  }
}

// --------------------------------------------------
// 3) DOMContentLoaded içinde “add-listing-form”u dinle
// --------------------------------------------------
// script.js içindeki ilgili kısımları tamamen şu hâle getirin:

let selectedPhoto = null;

document.addEventListener("DOMContentLoaded", () => {
  // … varsa önceki kodlar …

  // Ev fotoğrafı input + drop-zone
  const photoInput = document.getElementById("listing-photo");
  const dropZonePhoto = document.getElementById("drop-zone-photo");

  photoInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      selectedPhoto = e.target.files[0];
      dropZonePhoto.textContent = selectedPhoto.name;
    }
  });
  dropZonePhoto.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZonePhoto.classList.add("dragover");
  });
  dropZonePhoto.addEventListener("dragleave", () => {
    dropZonePhoto.classList.remove("dragover");
  });
  dropZonePhoto.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZonePhoto.classList.remove("dragover");
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      selectedPhoto = e.dataTransfer.files[0];
      photoInput.files = e.dataTransfer.files;
      dropZonePhoto.textContent = selectedPhoto.name;
    }
  });

  // Kullanıcı avatarı input + drop-zone
  const avatarInput = document.getElementById("user-avatar");
  const dropZoneAvatar = document.getElementById("drop-zone-avatar");

  avatarInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      selectedAvatar = e.target.files[0];
      dropZoneAvatar.textContent = selectedAvatar.name;
    }
  });
  dropZoneAvatar.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZoneAvatar.classList.add("dragover");
  });
  dropZoneAvatar.addEventListener("dragleave", () => {
    dropZoneAvatar.classList.remove("dragover");
  });
  dropZoneAvatar.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZoneAvatar.classList.remove("dragover");
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      selectedAvatar = e.dataTransfer.files[0];
      avatarInput.files = e.dataTransfer.files;
      dropZoneAvatar.textContent = selectedAvatar.name;
    }
  });

  // “İlan Ekle” formunu dinle
  document
    .getElementById("add-listing-form")
    .addEventListener("submit", handleAddListing);
});

async function handleAddListing(e) {
  e.preventDefault();

  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  if (!currentUser || !currentUser._id) {
    alert("İlan eklemek için öncelikle giriş yapmalısınız.");
    return;
  }

  const title = document.getElementById("listing-title").value.trim();
  const price = Number(document.getElementById("listing-price").value);
  const area = Number(document.getElementById("listing-area").value);
  const bedrooms = Number(document.getElementById("listing-bedrooms").value);
  const bathrooms = Number(document.getElementById("listing-bathrooms").value);
  const city = document
    .getElementById("listing-city")
    .value.trim()
    .toLowerCase();
  const district = document
    .getElementById("listing-district")
    .value.trim()
    .toLowerCase();
  const location = document.getElementById("listing-location").value.trim();
  const furnished = document.getElementById("listing-furnished").checked;
  const petFriendly = document.getElementById("listing-petFriendly").checked;
  const featuresRaw = document.getElementById("listing-features").value.trim();
  const description = document
    .getElementById("listing-description")
    .value.trim();

  const features = featuresRaw
    ? featuresRaw
        .split(",")
        .map((f) => f.trim())
        .filter((f) => f.length)
    : [];

  if (!selectedPhoto) {
    alert("Lütfen ev fotoğrafını seçin veya sürükleyin.");
    return;
  }
  if (!selectedAvatar) {
    alert("Lütfen kullanıcı avatarını seçin veya sürükleyin.");
    return;
  }

  const formData = new FormData();
  formData.append("photo", selectedPhoto);
  formData.append("avatar", selectedAvatar);
  formData.append("title", title);
  formData.append("price", price);
  formData.append("area", area);
  formData.append("bedrooms", bedrooms);
  formData.append("bathrooms", bathrooms);
  formData.append("city", city);
  formData.append("district", district);
  formData.append("location", location);
  formData.append("furnished", furnished);
  formData.append("petFriendly", petFriendly);
  formData.append("features", JSON.stringify(features));
  formData.append("description", description);
  formData.append("landlordName", currentUser.name);
  formData.append("landlordId", currentUser._id);
  formData.append(
    "landlordAvatar",
    currentUser.avatar ||
      "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png"
  );
  formData.append("landlordRating", currentUser.rating || 0);

  try {
    const response = await fetch(apiUrl + "/api/listings/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const errData = await response.json();
        alert("İlan eklenemedi:\n" + (errData.error || "Bilinmeyen hata"));
      } else {
        const txt = await response.text();
        alert("Sunucudan beklenmeyen çıktı geldi:\n" + txt);
      }
      return;
    }

    const data = await response.json();
    alert("İlanınız başarıyla eklendi!");
    document.getElementById("add-listing-form").reset();
    selectedPhoto = null;
    selectedAvatar = null;
    document.getElementById("drop-zone-photo").textContent =
      "Ev fotoğrafını buraya sürükleyin veya tıklayarak seçin";
    document.getElementById("drop-zone-avatar").textContent =
      "Kullanıcı avatarını buraya sürükleyin veya tıklayarak seçin";
    navigateToPage("listings");
  } catch (err) {
    console.error("İlan ekleme sırasında hata:", err);
    alert("Sunucuya bağlanırken bir hata oluştu:\n" + err.message);
  }
}
