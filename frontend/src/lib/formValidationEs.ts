// El mensaje de los tooltips de validación nativa del navegador ("Please fill
// out this field") depende del idioma configurado en el navegador, no del
// `lang` de la página — por eso <html lang="es"> no alcanza para traducirlo.
// Esta función escucha el evento `invalid` de cualquier <input>/<select>/
// <textarea> de la app y le pone un mensaje en español vía setCustomValidity,
// que es lo que efectivamente se muestra en el tooltip.

function mensajeParaCampo(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string {
  const v = el.validity;

  if (v.valueMissing)   return 'Completá este campo';
  if (v.typeMismatch) {
    if ('type' in el && el.type === 'email') return 'Ingresá una dirección de email válida';
    if ('type' in el && el.type === 'url')   return 'Ingresá una URL válida';
    return 'El valor ingresado no es válido';
  }
  if (v.patternMismatch) return el.title || 'El formato ingresado no es válido';
  if (v.tooShort)        return `Ingresá al menos ${(el as HTMLInputElement).minLength} caracteres`;
  if (v.tooLong)         return `Ingresá como máximo ${(el as HTMLInputElement).maxLength} caracteres`;
  if (v.rangeUnderflow)  return `El valor debe ser mayor o igual a ${(el as HTMLInputElement).min}`;
  if (v.rangeOverflow)   return `El valor debe ser menor o igual a ${(el as HTMLInputElement).max}`;
  if (v.stepMismatch)    return 'El valor ingresado no es válido';
  if (v.badInput)        return 'Ingresá un valor válido';
  return 'El valor ingresado no es válido';
}

function esCampoValidable(el: EventTarget | null): el is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
  return el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;
}

export function installSpanishFormValidationMessages(): void {
  // capture:true porque `invalid` no burbujea
  document.addEventListener('invalid', (e) => {
    const el = e.target;
    if (!esCampoValidable(el)) return;
    el.setCustomValidity(mensajeParaCampo(el));
  }, true);

  // Limpiar el mensaje custom apenas el usuario corrige el campo — si no,
  // el campo queda "inválido" para siempre aunque el valor ya sea correcto.
  const limpiar = (e: Event) => {
    const el = e.target;
    if (esCampoValidable(el)) el.setCustomValidity('');
  };
  document.addEventListener('input',  limpiar, true);
  document.addEventListener('change', limpiar, true);
}
