const header = document.querySelector(".site-head");
const setHeaderState = () => {
  if (!header) return;
  header.classList.toggle("is-solid", window.scrollY > 24);
};
setHeaderState();
window.addEventListener("scroll", setHeaderState, { passive: true });
window.addEventListener("pageshow", setHeaderState);
