export function prepareFocusStyles() {
  if (document.getElementById("notify-focus-styles")) return;
  const style = document.createElement("style");
  style.id = "notify-focus-styles";
  style.textContent = `input,textarea,button,[tabindex],[role="button"],[role="radio"]{outline:none!important;-webkit-tap-highlight-color:transparent} input:focus,textarea:focus,button:focus,[tabindex]:focus{outline:none!important;box-shadow:none!important} button:focus-visible,[role="button"]:focus-visible,[role="radio"]:focus-visible{filter:brightness(1.2)}`;
  document.head.appendChild(style);
}
