/* Sign Language Coach - Offline PWA
   - Child profile photo + name saved locally
   - Flashcards + Practice mode
   - Manage library: add/edit/delete, optional sign image per word
*/

const LS_KEYS = {
  PROFILE: "sl_profile_v1",
  LIBRARY: "sl_library_v1"
};

const $ = (id) => document.getElementById(id);

const statusEl = $("status");
const installBtn = $("installBtn");

const childSubtitle = $("childSubtitle");
const childAvatar = $("childAvatar");
const avatarFallback = $("avatarFallback");
const childName = $("childName");
const childPhoto = $("childPhoto");
const saveProfileBtn = $("saveProfile");
const clearProfileBtn = $("clearProfile");

const segBtns = Array.from(document.querySelectorAll(".segBtn"));
const viewLearn = $("viewLearn");
const viewPractice = $("viewPractice");
const viewManage = $("viewManage");

const categorySelect = $("categorySelect");
const searchInput = $("search");

const fcCategory = $("fcCategory");
const fcDifficulty = $("fcDifficulty");
const fcWord = $("fcWord");
const fcMeaning = $("fcMeaning");
const fcNote = $("fcNote");
const fcImage = $("fcImage");
const fcImageEmpty = $("fcImageEmpty");
const prevCardBtn = $("prevCard");
const nextCardBtn = $("nextCard");
const shuffleCardBtn = $("shuffleCard");

const prWord = $("prWord");
const prMeaning = $("prMeaning");
const prNote = $("prNote");
const prReveal = $("prReveal");
const prRevealBtn = $("prRevealBtn");
const prNextBtn = $("prNextBtn");
const prImage = $("prImage");
const prImageEmpty = $("prImageEmpty");

const addForm = $("addForm");
const mWord = $("mWord");
const mMeaning = $("mMeaning");
const mCategory = $("mCategory");
const mDifficulty = $("mDifficulty");
const mNote = $("mNote");
const mImage = $("mImage");
const resetDataBtn = $("resetData");
const libraryList = $("libraryList");

const modal = $("modal");
const closeModalBtn = $("closeModal");
const eWord = $("eWord");
const eMeaning = $("eMeaning");
const eCategory = $("eCategory");
const eDifficulty = $("eDifficulty");
const eNote = $("eNote");
const eImage = $("eImage");
const saveEditBtn = $("saveEdit");
const deleteItemBtn = $("deleteItem");

let deferredPrompt = null;

// ---------- Default library ----------
function defaultLibrary(){
  // Keep it small & helpful; user can add a lot more.
  return [
    { id: uid(), word:"Hello", meaning:"Greeting", category:"Basics", difficulty:"Easy", note:"Smile and wave.", imageDataUrl:null },
    { id: uid(), word:"Thank you", meaning:"Gratitude", category:"Basics", difficulty:"Easy", note:"Hand from chin outward.", imageDataUrl:null },
    { id: uid(), word:"Please", meaning:"Polite request", category:"Basics", difficulty:"Easy", note:"Circular motion on chest.", imageDataUrl:null },
    { id: uid(), word:"Yes", meaning:"Agree", category:"Basics", difficulty:"Easy", note:"Make a fist and nod it.", imageDataUrl:null },
    { id: uid(), word:"No", meaning:"Disagree", category:"Basics", difficulty:"Easy", note:"Index+middle finger tap thumb.", imageDataUrl:null },
    { id: uid(), word:"Help", meaning:"Need assistance", category:"Needs", difficulty:"Easy", note:"Thumb up on palm; lift.", imageDataUrl:null },
    { id: uid(), word:"Water", meaning:"Ask for a drink", category:"Needs", difficulty:"Easy", note:"W handshape near mouth.", imageDataUrl:null },
    { id: uid(), word:"Eat", meaning:"I want food", category:"Needs", difficulty:"Easy", note:"Bring fingers to mouth.", imageDataUrl:null },
    { id: uid(), word:"Toilet", meaning:"Bathroom", category:"Needs", difficulty:"Medium", note:"T handshake wiggle.", imageDataUrl:null },
    { id: uid(), word:"Mom", meaning:"Mother", category:"Family", difficulty:"Easy", note:"Thumb to chin.", imageDataUrl:null },
    { id: uid(), word:"Dad", meaning:"Father", category:"Family", difficulty:"Easy", note:"Thumb to forehead.", imageDataUrl:null },
    { id: uid(), word:"Sad", meaning:"Feeling down", category:"Feelings", difficulty:"Easy", note:"Hands pull down cheeks.", imageDataUrl:null },
    { id: uid(), word:"Happy", meaning:"Feeling good", category:"Feelings", difficulty:"Easy", note:"Brush chest upward.", imageDataUrl:null },
  ];
}

// ---------- Storage helpers ----------
function loadJSON(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch{
    return fallback;
  }
}
function saveJSON(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}
function uid(){
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}
function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

// ---------- Profile ----------
function loadProfile(){
  const profile = loadJSON(LS_KEYS.PROFILE, null);
  if(!profile){
    childSubtitle.textContent = "Personalized learning";
    childName.value = "";
    childAvatar.style.display = "none";
    avatarFallback.style.display = "grid";
    return;
  }

  childName.value = profile.name || "";
  const label = profile.name ? `Teaching ${profile.name}` : "Personalized learning";
  childSubtitle.textContent = label;

  if(profile.photoDataUrl){
    childAvatar.src = profile.photoDataUrl;
    childAvatar.style.display = "block";
    avatarFallback.style.display = "none";
  }else{
    childAvatar.style.display = "none";
    avatarFallback.style.display = "grid";
  }
}

async function fileToDataURL(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

saveProfileBtn.addEventListener("click", async ()=>{
  const name = (childName.value || "").trim();
  let photoDataUrl = null;

  const file = childPhoto.files && childPhoto.files[0];
  if(file){
    // Keep storage size reasonable by limiting big images:
    // we still store as data URL, so advise small photos.
    photoDataUrl = await fileToDataURL(file);
  }else{
    const old = loadJSON(LS_KEYS.PROFILE, null);
    photoDataUrl = old?.photoDataUrl || null;
  }

  saveJSON(LS_KEYS.PROFILE, { name, photoDataUrl });
  childPhoto.value = "";
  loadProfile();
});

clearProfileBtn.addEventListener("click", ()=>{
  localStorage.removeItem(LS_KEYS.PROFILE);
  childPhoto.value = "";
  loadProfile();
});

// ---------- Library state ----------
let library = loadJSON(LS_KEYS.LIBRARY, null);
if(!Array.isArray(library) || library.length === 0){
  library = defaultLibrary();
  saveJSON(LS_KEYS.LIBRARY, library);
}

let filtered = [];
let currentIndex = 0;

// ---------- Filtering ----------
function getCategories(items){
  const set = new Set(items.map(i => (i.category || "Custom").trim()).filter(Boolean));
  return Array.from(set).sort((a,b)=>a.localeCompare(b));
}

function rebuildCategorySelect(){
  const current = categorySelect.value || "all";
  const cats = getCategories(library);
  categorySelect.innerHTML = `<option value="all">All categories</option>` +
    cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");

  // try restore selection
  const exists = ["all", ...cats].includes(current);
  categorySelect.value = exists ? current : "all";
}

function applyFilters(){
  const q = (searchInput.value || "").trim().toLowerCase();
  const cat = categorySelect.value;

  filtered = library.filter(item=>{
    const inCat = (cat === "all") ? true : (item.category === cat);
    const inSearch = !q ? true : (
      (item.word || "").toLowerCase().includes(q) ||
      (item.meaning || "").toLowerCase().includes(q) ||
      (item.note || "").toLowerCase().includes(q)
    );
    return inCat && inSearch;
  });

  currentIndex = clamp(currentIndex, 0, Math.max(0, filtered.length - 1));
  renderFlashcard();
  renderLibraryList();
  if(viewPractice && !viewPractice.classList.contains("hidden")){
    // Keep practice in sync
    practicePickNew();
  }
}

categorySelect.addEventListener("change", applyFilters);
searchInput.addEventListener("input", applyFilters);

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, (m)=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

// ---------- Flashcard rendering ----------
function setImage(imgEl, emptyEl, dataUrl){
  if(dataUrl){
    imgEl.src = dataUrl;
    imgEl.classList.remove("hidden");
    emptyEl.classList.add("hidden");
  }else{
    imgEl.removeAttribute("src");
    imgEl.classList.add("hidden");
    emptyEl.classList.remove("hidden");
  }
}

function renderFlashcard(){
  const item = filtered[currentIndex] || null;

  if(!item){
    fcCategory.textContent = "No results";
    fcDifficulty.textContent = "—";
    fcWord.textContent = "No cards found";
    fcMeaning.textContent = "Try a different category or search";
    fcNote.textContent = "Add your own words in Manage.";
    setImage(fcImage, fcImageEmpty, null);
    return;
  }

  fcCategory.textContent = item.category || "Custom";
  fcDifficulty.textContent = item.difficulty || "Easy";
  fcWord.textContent = item.word || "";
  fcMeaning.textContent = item.meaning || "";
  fcNote.textContent = item.note ? item.note : "No tip added.";
  setImage(fcImage, fcImageEmpty, item.imageDataUrl || null);
}

prevCardBtn.addEventListener("click", ()=>{
  if(filtered.length === 0) return;
  currentIndex = (currentIndex - 1 + filtered.length) % filtered.length;
  renderFlashcard();
});

nextCardBtn.addEventListener("click", ()=>{
  if(filtered.length === 0) return;
  currentIndex = (currentIndex + 1) % filtered.length;
  renderFlashcard();
});

shuffleCardBtn.addEventListener("click", ()=>{
  if(filtered.length <= 1) return;
  currentIndex = Math.floor(Math.random() * filtered.length);
  renderFlashcard();
});

// ---------- Practice mode ----------
let practiceItem = null;
function practicePickNew(){
  prReveal.classList.add("hidden");
  prRevealBtn.textContent = "Reveal";

  if(filtered.length === 0){
    prWord.textContent = "No cards found";
    prMeaning.textContent = "—";
    prNote.textContent = "—";
    setImage(prImage, prImageEmpty, null);
    practiceItem = null;
    return;
  }

  // pick random, avoid immediate repeat when possible
  let next = filtered[Math.floor(Math.random() * filtered.length)];
  if(practiceItem && filtered.length > 1){
    let tries = 0;
    while(next.id === practiceItem.id && tries < 6){
      next = filtered[Math.floor(Math.random() * filtered.length)];
      tries++;
    }
  }
  practiceItem = next;

  prWord.textContent = practiceItem.word || "";
  prMeaning.textContent = practiceItem.meaning || "";
  prNote.textContent = practiceItem.note ? practiceItem.note : "No tip added.";
  setImage(prImage, prImageEmpty, practiceItem.imageDataUrl || null);
}

prRevealBtn.addEventListener("click", ()=>{
  if(!practiceItem) return;
  const isHidden = prReveal.classList.contains("hidden");
  prReveal.classList.toggle("hidden");
  prRevealBtn.textContent = isHidden ? "Hide" : "Reveal";
});

prNextBtn.addEventListener("click", practicePickNew);

// ---------- Manage library ----------
addForm.addEventListener("submit", async (e)=>{
  e.preventDefault();

  const item = {
    id: uid(),
    word: (mWord.value || "").trim(),
    meaning: (mMeaning.value || "").trim(),
    category: (mCategory.value || "Custom").trim() || "Custom",
    difficulty: (mDifficulty.value || "Easy").trim(),
    note: (mNote.value || "").trim(),
    imageDataUrl: null
  };

  const file = mImage.files && mImage.files[0];
  if(file){
    item.imageDataUrl = await fileToDataURL(file);
  }

  library.unshift(item);
  saveJSON(LS_KEYS.LIBRARY, library);

  addForm.reset();
  rebuildCategorySelect();
  applyFilters();
});

resetDataBtn.addEventListener("click", ()=>{
  library = defaultLibrary();
  saveJSON(LS_KEYS.LIBRARY, library);
  rebuildCategorySelect();
  applyFilters();
});

function renderLibraryList(){
  libraryList.innerHTML = "";

  if(filtered.length === 0){
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<div class="itemWord">No items</div><div class="itemMeta">Add words above</div>`;
    libraryList.appendChild(div);
    return;
  }

  filtered.forEach(item=>{
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="itemTop">
        <div class="itemWord">${escapeHtml(item.word)}</div>
        <div class="itemMeta">${escapeHtml(item.category)} • ${escapeHtml(item.difficulty || "Easy")}</div>
      </div>
      <div class="itemNote">${escapeHtml(item.meaning || "")}</div>
      ${item.note ? `<div class="itemMeta" style="margin-top:6px;">Tip: ${escapeHtml(item.note)}</div>` : ``}
    `;
    div.addEventListener("click", ()=> openEdit(item.id));
    libraryList.appendChild(div);
  });
}

let editingId = null;

function openEdit(id){
  const item = library.find(x=>x.id === id);
  if(!item) return;
  editingId = id;

  eWord.value = item.word || "";
  eMeaning.value = item.meaning || "";
  eCategory.value = item.category || "Custom";
  eDifficulty.value = item.difficulty || "Easy";
  eNote.value = item.note || "";
  eImage.value = "";

  modal.classList.remove("hidden");
}

function closeEdit(){
  modal.classList.add("hidden");
  editingId = null;
}

closeModalBtn.addEventListener("click", closeEdit);
modal.addEventListener("click", (e)=>{
  if(e.target === modal) closeEdit();
});

saveEditBtn.addEventListener("click", async ()=>{
  if(!editingId) return;
  const idx = library.findIndex(x=>x.id === editingId);
  if(idx < 0) return;

  library[idx].word = (eWord.value || "").trim();
  library[idx].meaning = (eMeaning.value || "").trim();
  library[idx].category = (eCategory.value || "Custom").trim() || "Custom";
  library[idx].difficulty = (eDifficulty.value || "Easy").trim();
  library[idx].note = (eNote.value || "").trim();

  const file = eImage.files && eImage.files[0];
  if(file){
    library[idx].imageDataUrl = await fileToDataURL(file);
  }

  saveJSON(LS_KEYS.LIBRARY, library);
  rebuildCategorySelect();
  applyFilters();
  closeEdit();
});

deleteItemBtn.addEventListener("click", ()=>{
  if(!editingId) return;
  library = library.filter(x=>x.id !== editingId);
  saveJSON(LS_KEYS.LIBRARY, library);
  rebuildCategorySelect();
  applyFilters();
  closeEdit();
});

// ---------- Views ----------
function setView(view){
  viewLearn.classList.toggle("hidden", view !== "learn");
  viewPractice.classList.toggle("hidden", view !== "practice");
  viewManage.classList.toggle("hidden", view !== "manage");

  segBtns.forEach(b => b.classList.toggle("active", b.dataset.view === view));

  if(view === "practice"){
    practicePickNew();
  }
}
segBtns.forEach(btn=>{
  btn.addEventListener("click", ()=> setView(btn.dataset.view));
});

// ---------- Online/offline status ----------
function updateOnline(){
  const online = navigator.onLine;
  statusEl.textContent = online ? "Online" : "Offline";
  statusEl.classList.toggle("online", online);
}
window.addEventListener("online", updateOnline);
window.addEventListener("offline", updateOnline);

// ---------- PWA install prompt ----------
window.addEventListener("beforeinstallprompt", (e)=>{
  e.preventDefault();
  deferredPrompt = e;
  installBtn.classList.remove("hidden");
});
installBtn.addEventListener("click", async ()=>{
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.classList.add("hidden");
});

// ---------- Service worker ----------
async function registerSW(){
  if(!("serviceWorker" in navigator)) return;
  try{
    await navigator.serviceWorker.register("service-worker.js");
  }catch(err){
    console.warn("SW registration failed", err);
  }
}

// ---------- Init ----------
function init(){
  loadProfile();
  rebuildCategorySelect();
  applyFilters();
  updateOnline();
  registerSW();
  setView("learn");
}

init();
