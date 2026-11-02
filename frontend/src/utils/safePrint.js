import { createElement } from 'react';
import urduFontUrl from '../assets/fonts/NotoNastaliqUrdu-wght.ttf?url';

const blockedElements = 'script, iframe, object, embed, base, meta[http-equiv], form';
const allowedElements = new Set([
  'div', 'span', 'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'strong', 'b', 'em', 'i', 'small',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'ul', 'ol', 'li', 'br', 'hr', 'section', 'article',
]);

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function sanitizeDocument(parsedDocument) {
  parsedDocument.querySelectorAll(blockedElements).forEach(element => element.remove());

  parsedDocument.querySelectorAll('*').forEach(element => {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();

      if (name.startsWith('on') || name === 'srcdoc') {
        element.removeAttribute(attribute.name);
      } else if (name === 'style' && /url\s*\(|expression\s*\(|@import/i.test(value)) {
        element.removeAttribute(attribute.name);
      } else if (name === 'src' || name === 'href') {
        if (/^(?:javascript|vbscript|data):/i.test(value) && !/^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(value)) {
          element.removeAttribute(attribute.name);
        }
      }
    }

    if (element.tagName === 'STYLE' && /url\s*\(|expression\s*\(|@import/i.test(element.textContent || '')) {
      element.remove();
    }
  });
}

function styleToObject(styleText) {
  return Object.fromEntries(styleText.split(';').flatMap(declaration => {
    const separator = declaration.indexOf(':');
    if (separator < 0) return [];
    const property = declaration.slice(0, separator).trim().replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = declaration.slice(separator + 1).trim();
    return property && value ? [[property, value]] : [];
  }));
}

function toReactNode(node, key) {
  if (node.nodeType === window.Node.TEXT_NODE) return node.textContent;
  if (node.nodeType !== window.Node.ELEMENT_NODE) return null;

  const tagName = node.tagName.toLowerCase();
  const children = [...node.childNodes].map((child, index) => toReactNode(child, index)).filter(Boolean);
  if (!allowedElements.has(tagName)) return children;

  const props = { key };
  for (const attribute of [...node.attributes]) {
    const name = attribute.name.toLowerCase();
    if (name === 'style') {
      props.style = styleToObject(attribute.value);
    } else if (name === 'class') {
      props.className = attribute.value;
    } else if (name === 'colspan') {
      props.colSpan = Number(attribute.value) || 1;
    } else if (name === 'rowspan') {
      props.rowSpan = Number(attribute.value) || 1;
    } else if (['alt', 'src', 'title', 'id'].includes(name)) {
      props[name] = attribute.value;
    }
  }
  return createElement(tagName, props, ...children);
}

export function safeHtmlToReactNodes(html) {
  const parsedDocument = new window.DOMParser().parseFromString(String(html || ''), 'text/html');
  sanitizeDocument(parsedDocument);
  return [...parsedDocument.body.childNodes].map((node, index) => toReactNode(node, index));
}

export function openSafePrintWindow(title, html, features = 'height=800,width=1000', existingWindow = null) {
  const printWindow = existingWindow || window.open('', '', features);
  if (!printWindow) return null;

  const parsedDocument = new window.DOMParser().parseFromString(String(html || ''), 'text/html');
  sanitizeDocument(parsedDocument);

  const document = printWindow.document;
  document.title = String(title || 'Print');

  const language = window.document.documentElement.lang || 'en';
  const direction = language === 'ur' ? 'rtl' : 'ltr';
  document.documentElement.lang = language;
  document.documentElement.dir = direction;
  document.body.lang = language;
  document.body.dir = direction;
  const headNodes = [...parsedDocument.head.children].filter(element =>
    element.tagName === 'STYLE' || (element.tagName === 'LINK' && element.rel === 'stylesheet')
  );
  document.head.replaceChildren(...headNodes.map(node => document.importNode(node, true)));
  document.body.replaceChildren(...[...parsedDocument.body.childNodes].map(node => document.importNode(node, true)));
  if (language === 'ur') {
    const style = document.createElement('style');
    style.textContent = `
      @font-face {
        font-family: "Noto Nastaliq Urdu";
        src: url("${urduFontUrl}") format("truetype");
        font-style: normal;
        font-weight: 100 900;
        font-display: swap;
      }
      body, button, input, select, textarea {
        font-family: "Noto Nastaliq Urdu", "Noto Naskh Arabic", "Segoe UI", serif;
        line-height: 1.8;
        letter-spacing: normal;
      }
      body, table { direction: rtl; }
      .font-mono, .tabular-nums, [data-ltr] { direction: ltr; unicode-bidi: isolate; }
      th, td { padding-block: 0.45rem; }
    `;
    document.head.appendChild(style);
  }

  return printWindow;
}

export function openSafePrintWindowFromElement(title, element, features = 'height=800,width=1000') {
  if (!element) return null;
  return openSafePrintWindow(title, `
    <html><head>
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@3.3.0/dist/tailwind.min.css" rel="stylesheet">
    </head><body class="p-8 bg-white text-slate-900">${element.outerHTML}</body></html>
  `, features);
}
