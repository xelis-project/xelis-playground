'use strict';

import hljs from 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.10.0/build/es/core.min.js';
import silex from './silex-lang.js';
//import rust from 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.10.0/build/es/languages/rust.min.js';
hljs.registerLanguage('silex', silex);

/*! (c) Andrea Giammarchi - ISC */

const TAG = 'highlighted-code';

const targets = new WeakMap;
const components = new Set;

const options = {timeout: 300, box: 'border-box'};

const noIdle = typeof cancelIdleCallback !== 'function';
const setIdle = noIdle ? setTimeout : requestIdleCallback;
const dropIdle = noIdle ? clearTimeout : cancelIdleCallback;
const FF = typeof netscape === 'object';

let theme, resizeObserver;

/**
 * A textarea builtin extend able to automatically highlight while the area is
 * being typed. Requires `HighlightedCode.useTheme('default')` call to actually
 * highlight the resulting code.
 * @example `<textarea is="highlighted-code" language="css"></textarea>`
 */
class HighlightedCode extends HTMLTextAreaElement {
  static get library() { return hljs; }
  static get observedAttributes() {
    return ['auto-height', 'disabled', 'language', 'tab-size'];
  }

  /**
   * Inserts some text where the selection is.
   * @param {string} text any text to insert.
   */
  static insertText(text) {
    const {activeElement} = document;
    try {
      // they say it's deprecated, but it's the only one that works and
      // guarantees ctrl+z behavior ... no idea why anyone would remove this!
      if (!(
        text ?
          document.execCommand('insertText', false, text) :
          document.execCommand('delete')
      ))
        throw event;
    }
    catch(o_O) {
      const {selectionStart} = activeElement;
      activeElement.setRangeText(text);
      activeElement.selectionStart = activeElement.selectionEnd = selectionStart + text.length;
    }
    activeElement.oninput();
  }

  /**
   * Automatically set a CSS theme for the highlighted code.
   * @param {string} name One of the themes from highlight.js or a css file to
   * point at. Names are like `default`, `github`, `tokio-night-dark` and so on
   * https://github.com/highlightjs/highlight.js/tree/main/src/styles
   */
  static useTheme(name) {
    if (!theme) {
      theme = document.head.appendChild(
        document.createElement('link')
      );
      theme.rel = 'stylesheet';
      theme.addEventListener('load', () => {
        for (const textarea of document.querySelectorAll(`textarea[is="${TAG}"]`))
          _backgroundColor.call(textarea);
      });
    }
    theme.href = name.includes('.') ? name : `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.5.0/styles/${name}.min.css`;
  }

  constructor() {
    super();
    this.idle = 0;
    const pre = this.ownerDocument.createElement('pre');
    pre.className = TAG;
    pre.innerHTML = '<code></code>';
    targets.set(this, pre);
    this.style.cssText += `
      tab-size: 2;
      white-space: pre;
      font-family: monospace;
      color: transparent;
      background-color: transparent;
    `;
    // setup internal class
    const {autoHeight, language, tabSize} = this;
    if (autoHeight) {
      delete this.autoHeight;
      this.autoHeight = autoHeight;
    }
    if (language) {
      delete this.language;
      this.language = language;
    }
    if (tabSize) {
      delete this.tabSize;
      this.tabSize = tabSize;
    }
  }

  /**
   * Avoid vertical scrollbar.
   * @type {boolean}
   */
  get autoHeight() {
    return this.hasAttribute('auto-height');
  }
  set autoHeight(value) {
    if (value) {
      this.style.resize = 'none';
      this.setAttribute('auto-height', '');
    }
    else {
      this.style.resize = null;
      this.removeAttribute('auto-height');
    }
  }

  /**
   * The used language, compatible with hljs.
   * @type {string}
   */
  get language() {
    return this.getAttribute('language');
  }
  set language(name) {
    this.setAttribute('language', name);
  }

  /**
   * The tab-size value.
   * @type {string}
   */
  get tabSize() {
    return this.getAttribute('tab-size');
  }
  set tabSize(value) {
    this.setAttribute('tab-size', value);
  }

  /**
   * Set code to highlight.
   * @type {string}
   */
  get value() {
    return super.value;
  }
  set value(code) {
    super.value = code;
    this.oninput();
  }

  attributeChangedCallback(name, _, value) {
    switch (name) {
      case 'auto-height':
        this.style.height = null;
        if (value != null) {
          this.value = this.value.trimEnd();
          _autoHeight.call(this);
        }
        break;
      case 'disabled':
        if (FF)
          targets.get(this).style.pointerEvents = this.disabled ? 'all' : 'none';
        break;
      case 'language':
        let className = 'hljs';
        if (value)
          className += ' language-' + value;
        targets.get(this).querySelector('code').className = className;
        break;
      case 'tab-size':
        this.style.tabSize = value;
        targets.get(this).style.tabSize = value;
        break;
    }
  }
  connectedCallback() {
    components.add(this);
    this.parentElement.insertBefore(targets.get(this), this.nextSibling);
    this.oninput();
    _backgroundColor.call(this);
    resizeObserver.observe(this, options);
    this.addEventListener('keydown', this);
    this.addEventListener('scroll', this);
    this.addEventListener('input', this);
  }
  disconnectedCallback() {
    components.delete(this);
    targets.get(this).remove();
    resizeObserver.unobserve(this);
    this.removeEventListener('keydown', this);
    this.removeEventListener('scroll', this);
    this.removeEventListener('input', this);
  }

  handleEvent(event) { this['on' + event.type](event); }
  onkeydown(event) {
    if (event.key === 'Tab') {
      HighlightedCode.insertText('\t');
      event.preventDefault();
    }
  }
  oninput() {
    dropIdle(this.idle);
    const idle = (this.idle = setIdle(
      () => {
        const {language, value} = this;
        const code = targets.get(this).querySelector('code');

        // Please note no language is very slow!
        if (!language)
          code.className = 'hljs';

        code.innerHTML = (
          language ?
            hljs.highlight(value, {language}) :
            hljs.highlightAuto(value)
        ).value + '<br>';
        this.onscroll();
        if (idle === this.idle && this.autoHeight)
          _autoHeight.call(this);
      },
      options
    ));
  }
  onscroll() {
    const {scrollTop, scrollLeft} = this;
    const pre = targets.get(this);
    pre.scrollTop = scrollTop;
    pre.scrollLeft = scrollLeft;
    // a very Firefox specific issue
    if (FF && 'scrollLeftMax' in pre)
      this.scrollLeft = Math.min(scrollLeft, pre.scrollLeftMax);
  }
}

if (!customElements.get(TAG)) {
  const onResize = entries => {
    for (const {target} of entries) {
      const pre = targets.get(target);
      const {border, font, letterSpacing, lineHeight, padding, wordSpacing} = getComputedStyle(target);
      const {top, left, width, height} = target.getBoundingClientRect();
      pre.style.cssText = `
        position: absolute;
        overflow: auto;
        box-sizing: border-box;
        pointer-events: ${(FF && target.disabled) ? 'all' : 'none'};
        tab-size: ${target.tabSize || 2};
        top: 0;
        /*left: 0;*/
        width: ${width}px;
        height: ${height}px;
        font: ${font};
        letter-spacing: ${letterSpacing};
        word-spacing: ${wordSpacing};
        line-height: ${lineHeight};
        padding: ${padding};
        border: ${border};
        margin: 0;
        background: initial;
        border-color: transparent;
      `;
    }
  };
  addEventListener('resize', () => {
    const entries = [];
    for (const target of components)
      entries.push({target});
    onResize(entries);
  });
  resizeObserver = new ResizeObserver(onResize);
  customElements.define(TAG, HighlightedCode, {extends: 'textarea'});
}

/** @type {HighlightedCode} */
//module.exports = customElements.get(TAG);
export default customElements.get(TAG);

function _autoHeight() {
  this.style.height = 'auto';
  const {boxSizing, borderTop, borderBottom, paddingTop, paddingBottom} = getComputedStyle(this);
  const paddingDiff = (parseFloat(paddingTop) || 0) + (parseFloat(paddingBottom) || 0);
  const borderDiff = (parseFloat(borderTop) || 0) + (parseFloat(borderBottom) || 0);
  const diff = boxSizing === 'border-box' ? -borderDiff : paddingDiff;
  this.style.height = `${this.scrollHeight - diff}px`;
}

function _backgroundColor() {
  const code = targets.get(this).querySelector('code');
  code.style.backgroundColor = null;
  const {color, backgroundColor} = getComputedStyle(code);
  this.style.caretColor = color;
  this.style.backgroundColor = backgroundColor;
  code.style.cssText = `
    background-color: transparent;
    overflow: unset;
    margin: 0;
    padding: 0;
  `;
}