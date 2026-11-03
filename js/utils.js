import { BUSINESS_INFO } from './data.js';

export function escapeHtml(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatPKR(amount) {
  const num = Number(amount ?? 0);
  if (Number.isNaN(num)) return 'Rs. 0';
  return `Rs. ${Math.round(num).toLocaleString('en-PK')}`;
}

export function getEffectivePrice(product) {
  if (!product) return 0;
  if (
    product.sale_price !== null &&
    product.sale_price !== undefined &&
    Number(product.sale_price) > 0 &&
    Number(product.sale_price) < Number(product.price)
  ) {
    return Number(product.sale_price);
  }
  if (Number(product.discount_percentage) > 0 && Number(product.discount_percentage) < 100) {
    return Math.round(Number(product.price) * (1 - Number(product.discount_percentage) / 100));
  }
  return Number(product.price || 0);
}

export function getDiscountPercent(product) {
  if (!product) return 0;
  const effective = getEffectivePrice(product);
  const regular = Number(product.price || 0);
  if (effective < regular && regular > 0) {
    return Math.round(((regular - effective) / regular) * 100);
  }
  return 0;
}

export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function generateOrderNumber() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const seq = String(Math.floor(1000 + Math.random() * 9000));
  return `RDBS-${yyyy}${mm}${dd}-${seq}`;
}

export function generateSku(categoryName) {
  const prefix =
    String(categoryName || '')
      .replace(/[^a-zA-Z]/g, '')
      .slice(0, 5)
      .toUpperCase() || 'GEAR';
  const rand = String(Math.floor(100 + Math.random() * 900));
  return `RDBS-${prefix}-${rand}`;
}

export function formatDateShort(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-PK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(iso);
  }
}

export function normalizePakistanWhatsApp(phone = BUSINESS_INFO.whatsapp) {
  const digits = String(phone || BUSINESS_INFO.whatsapp).replace(/[^0-9]/g, '');
  if (digits.startsWith('0092')) return digits.slice(2);
  if (digits.startsWith('92')) return digits;
  if (digits.startsWith('0')) return `92${digits.slice(1)}`;
  return `92${digits}`;
}

export function buildWhatsAppUrl(message, phone = BUSINESS_INFO.whatsapp) {
  const target = normalizePakistanWhatsApp(phone);
  return `https://wa.me/${target}?text=${encodeURIComponent(message)}`;
}

export function buildOrderWhatsAppMessage(order, whatsappPhone) {
  const productLines = (order.items || [])
    .map((item, idx) => {
      const variantDetails = [
        item.size ? `Size: ${item.size}` : '',
        item.color ? `Color: ${item.color}` : '',
      ]
        .filter(Boolean)
        .join(' | ');

      return [
        `${idx + 1}. ${item.product_name}`,
        `Product Ref: ${item.product_sku}`,
        variantDetails ? `Variant: ${variantDetails}` : null,
        `Quantity: ${item.quantity}`,
        `Price: ${formatPKR(item.unit_price * item.quantity)}`,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');

  const fullAddress = order.city
    ? `${order.delivery_address}, ${order.city}`
    : order.delivery_address;

  const lines = [
    'Hello Rock Danish Biker Stuff,',
    '',
    'I would like to place an order.',
    '',
    'Order No:',
    order.order_number,
    '',
    'Products:',
    '',
    productLines,
    '',
    'Subtotal:',
    formatPKR(order.subtotal),
    '',
    'Discount:',
    formatPKR(order.discount_amount),
    '',
    'Coupon:',
    order.coupon_code || 'None',
    '',
    'Total:',
    formatPKR(order.total),
    '',
    'Customer Name:',
    order.customer_name,
    '',
    'Phone:',
    order.phone,
    order.whatsapp && order.whatsapp !== order.phone ? `\nWhatsApp:\n${order.whatsapp}` : '',
    '',
    'Delivery Address:',
    fullAddress,
    order.notes ? `\nOrder Notes:\n${order.notes}` : '',
    '',
    'Please confirm my order.',
  ];

  const text = lines
    .filter((l) => l !== '')
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');

  return whatsappPhone ? buildWhatsAppUrl(text, whatsappPhone) : text;
}

export function buildSingleProductWhatsAppUrl(product, size, color, quantity, whatsappPhone) {
  const unitPrice = getEffectivePrice(product);
  const lines = [
    'Hello Rock Danish Biker Stuff,',
    '',
    'I am interested in ordering this product:',
    '',
    `Product: ${product.name}`,
    `Product Ref: ${product.sku}`,
    size ? `Size: ${size}` : '',
    color ? `Color: ${color}` : '',
    `Quantity: ${quantity}`,
    `Price: ${formatPKR(unitPrice * quantity)}`,
    '',
    'Please confirm availability and delivery details.',
  ].filter(Boolean);

  return buildWhatsAppUrl(lines.join('\n'), whatsappPhone || BUSINESS_INFO.whatsapp);
}

export function buildGeneralSupportWhatsAppUrl(customText, whatsappPhone) {
  const msg =
    customText ||
    'Hello Rock Danish Biker Stuff, I need help choosing motorcycle gear and checking availability.';
  return buildWhatsAppUrl(msg, whatsappPhone || BUSINESS_INFO.whatsapp);
}

// Clean inline SVG icons (zero icon library needed)
export function icon(name, size = 18) {
  const attrs = `width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;
  const map = {
    search: `<svg ${attrs}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
    cart: `<svg ${attrs}><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>`,
    heart: `<svg ${attrs}><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`,
    heartFill: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`,
    user: `<svg ${attrs}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    shield: `<svg ${attrs}><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>`,
    menu: `<svg ${attrs}><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>`,
    x: `<svg ${attrs}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
    arrowRight: `<svg ${attrs}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`,
    starFill: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" stroke-width="1.5" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    starEmpty: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#D4D4D4" stroke-width="1.8" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    tag: `<svg ${attrs}><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>`,
    whatsapp: `<svg ${attrs}><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>`,
    phone: `<svg ${attrs}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
    mapPin: `<svg ${attrs}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
    headphones: `<svg ${attrs}><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/></svg>`,
    truck: `<svg ${attrs}><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>`,
    plus: `<svg ${attrs}><path d="M5 12h14"/><path d="M12 5v14"/></svg>`,
    minus: `<svg ${attrs}><path d="M5 12h14"/></svg>`,
    trash: `<svg ${attrs}><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`,
    edit: `<svg ${attrs}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
    check: `<svg ${attrs}><path d="M20 6 9 17l-5-5"/></svg>`,
    eye: `<svg ${attrs}><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>`,
    external: `<svg ${attrs}><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>`,
    package: `<svg ${attrs}><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`,
    logout: `<svg ${attrs}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>`,
    upload: `<svg ${attrs}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>`,
    copy: `<svg ${attrs}><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
    filter: `<svg ${attrs}><line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/></svg>`,
  };
  return map[name] || '';
}

export function renderStars(rating = 4.5, size = 14) {
  const rounded = Math.round(Number(rating || 0));
  let out = '<span class="stars-inline">';
  for (let i = 1; i <= 5; i += 1) {
    out += i <= rounded ? icon('starFill', size) : icon('starEmpty', size);
  }
  out += '</span>';
  return out;
}
