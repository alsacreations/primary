/**
 * Module clipboard - centralise la logique de copie dans le presse-papier
 */
export async function copyToClipboard(element) {
  try {
    await navigator.clipboard.writeText(element.textContent);

    const details = element.closest("details");
    if (details) {
      const button = details.querySelector(".btn-copy-overlay");
      if (button) {
        const original = button.innerHTML;
        try {
          button.setAttribute("aria-live", "polite");
        } catch (e) {
          /* noop */
        }
        button.innerHTML = '<span aria-hidden="true">✅</span>';
        button.disabled = true;
        setTimeout(() => {
          button.innerHTML = original;
          button.disabled = false;
          try {
            button.removeAttribute("aria-live");
          } catch (e) {
            /* noop */
          }
        }, 2000);
      }
    }
  } catch (err) {
    console.error("Erreur lors de la copie :", err);
    // Repli (méthode alternative si l'API clipboard échoue)
    const textArea = document.createElement("textarea");
    textArea.value = element.textContent;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);

    const details = element.closest("details");
    if (details) {
      const button = details.querySelector(".btn-copy-overlay");
      if (button) {
        const original = button.innerHTML;
        try {
          button.setAttribute("aria-live", "polite");
        } catch (e) {
          // noop (aucune action requise)
        }
        button.innerHTML = '<span aria-hidden="true">✅</span>';
        button.disabled = true;
        setTimeout(() => {
          button.innerHTML = original;
          button.disabled = false;
          try {
            button.removeAttribute("aria-live");
          } catch (e) {
            // noop (aucune action requise)
          }
        }, 2000);
      }
    }
  }
}
