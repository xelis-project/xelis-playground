export function text_dot_loading(element, size) {
  let dot_index = 0;
  let cancel_timeout;
  let init_text_index = element.innerText.length;
  element.innerText += "Loading";
  let loading_text_index = element.innerText.length;

  function display_dot() {
      if (dot_index === size) {
          element.innerText = element.innerText.substring(0, loading_text_index);
          dot_index = 0;
      } else {
          element.innerText += ".";
          dot_index++;
      }

      cancel_timeout = setTimeout(display_dot, 500);
  }

  function stop_loading() {
      clearTimeout(cancel_timeout);
      element.innerText = element.innerText.substring(0, init_text_index);
  }

  display_dot();
  return stop_loading;
}
