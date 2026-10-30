const header = document.querySelector(".site-head");
const setHeaderState = () => {
  if (!header) return;
  header.classList.toggle("is-solid", window.scrollY > 24);
};
setHeaderState();
window.addEventListener("scroll", setHeaderState, { passive: true });
window.addEventListener("pageshow", setHeaderState);

const form = document.getElementById("publicWaitlistForm");
if (form) {
  const status = document.getElementById("waitlistStatus");
  const submit = form.querySelector('button[type="submit"]');
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity() || submit.disabled) return;

    const data = new FormData(form);
    const entry = {
      name: String(data.get("name") || "").trim(),
      email: String(data.get("email") || "").trim().toLowerCase(),
      role: String(data.get("role") || ""),
      city: String(data.get("city") || "").trim(),
      source: "website",
    };

    if (entry.name.length < 2 || entry.name.length > 80 ||
        entry.email.length < 6 || entry.email.length > 120 ||
        entry.city.length < 2 || entry.city.length > 60 ||
        !["renter", "owner", "agency", "agent"].includes(entry.role)) {
      status.textContent = "Please check your details and try again.";
      status.dataset.state = "error";
      return;
    }

    submit.disabled = true;
    submit.textContent = "Joining…";
    status.textContent = "Submitting your details…";
    status.dataset.state = "loading";
    try {
      const [{ db }, { addDoc, collection, serverTimestamp }] = await Promise.all([
        import("./firebase.js"),
        import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js")
      ]);
      entry.createdAt = serverTimestamp();
      await addDoc(collection(db, "waitlist"), entry);
      form.reset();
      status.textContent = "You’re on the list. Thanks for your interest in Faxton Rentals!";
      status.dataset.state = "success";
    } catch (error) {
      console.error("Faxton waitlist signup failed:", error);
      status.textContent = "We couldn’t submit your details right now. Please try again in a moment.";
      status.dataset.state = "error";
    } finally {
      submit.disabled = false;
      submit.textContent = "Join the waitlist ↗";
    }
  });
}

document.querySelectorAll('a[href="/#waitlist"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const target = document.getElementById("waitlist");
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", "#waitlist");
    document.getElementById("waitlistName")?.focus({ preventScroll: true });
  });
});
