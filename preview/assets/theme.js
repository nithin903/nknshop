document.addEventListener('DOMContentLoaded', () => {
  const NKNSHOP_WHATSAPP = '918792036022';

  const whatsappLink = (text) =>
    `https://wa.me/${NKNSHOP_WHATSAPP}?text=${encodeURIComponent(text)}`;

  const openWhatsApp = (text) => {
    window.open(whatsappLink(text), '_blank', 'noopener');
  };

  const absUrl = (src) => {
    if (!src) return '';
    try { return new URL(src, window.location.href).href; } catch { return src; }
  };

  const pageProductImage = () =>
    document.querySelector('#mainImage')?.currentSrc
    || document.querySelector('#mainImage')?.src
    || document.querySelector('.product-gallery img')?.src
    || '';

  const booking = { name: '', price: '', image: '' };

  const ensureBookingModal = () => {
    let modal = document.querySelector('.booking-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'booking-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="booking-modal__backdrop" data-close-booking></div>
      <form class="booking-modal__card">
        <button type="button" class="booking-modal__close" data-close-booking aria-label="Close">×</button>
        <p class="section-kicker">Shiprocket</p>
        <h2>Place order</h2>
        <p class="booking-modal__item"></p>
        <img class="booking-modal__photo" alt="">
        <input name="customer" type="text" placeholder="Full name" required>
        <input name="phone" type="tel" placeholder="10-digit phone" required>
        <input name="email" type="email" placeholder="Email">
        <textarea name="address" rows="3" placeholder="House / street address" required></textarea>
        <div class="booking-modal__row">
          <input name="city" type="text" placeholder="City" required>
          <input name="state" type="text" placeholder="State" required>
        </div>
        <input name="pincode" type="text" inputmode="numeric" maxlength="6" placeholder="Pincode" required>
        <label class="booking-modal__cod"><input name="cod" type="checkbox" checked> Cash on delivery</label>
        <p class="booking-modal__status" hidden></p>
        <button class="btn btn-whatsapp" type="submit">Create Shiprocket order</button>
      </form>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if (e.target.closest('[data-close-booking]')) modal.hidden = true;
    });
    modal.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const status = modal.querySelector('.booking-modal__status');
      const submit = form.querySelector('button[type="submit"]');
      const data = new FormData(form);
      const pincode = String(data.get('pincode') || '').replace(/\D/g, '');
      const payload = {
        product: booking.name,
        price: booking.price,
        photo: absUrl(booking.image),
        customer: String(data.get('customer') || '').trim(),
        phone: String(data.get('phone') || '').trim(),
        email: String(data.get('email') || '').trim(),
        address: String(data.get('address') || '').trim(),
        city: String(data.get('city') || '').trim(),
        state: String(data.get('state') || '').trim(),
        pincode,
        cod: Boolean(data.get('cod')),
      };
      status.hidden = false;
      status.textContent = 'Creating Shiprocket order…';
      submit.disabled = true;
      try {
        const res = await fetch('/api/book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.ok) {
          throw new Error(json.message || 'Shiprocket did not accept this order.');
        }
        const lines = [
          'NKNSHOP Shiprocket order',
          `Product: ${booking.name}`,
          booking.price ? `Price: ${booking.price}` : '',
          json.order_id ? `Shiprocket order: ${json.order_id}` : '',
          json.shipment_id ? `Shipment: ${json.shipment_id}` : '',
          json.awb_code ? `AWB: ${json.awb_code}` : '',
          `Name: ${payload.customer}`,
          `Phone: ${payload.phone}`,
          `Address: ${payload.address}, ${payload.city}, ${payload.state} ${payload.pincode}`,
          payload.photo ? `Photo: ${payload.photo}` : '',
        ].filter(Boolean).join('\n');
        status.textContent = 'Order created. Opening WhatsApp…';
        modal.hidden = true;
        if (booking.image && navigator.share) {
          try {
            const file = await fileFromImage(booking.image);
            if (!navigator.canShare || navigator.canShare({ files: [file] })) {
              await navigator.share({ title: 'NKNSHOP booking', text: lines, files: [file] });
              return;
            }
          } catch (err) {
            if (err && err.name === 'AbortError') return;
          }
        }
        openWhatsApp(lines);
      } catch (err) {
        status.textContent = err.message || 'Could not create the order.';
      } finally {
        submit.disabled = false;
      }
    });
    return modal;
  };

  const openBooking = (name, price, imageSrc) => {
    booking.name = name || 'NKNSHOP product';
    booking.price = price || '';
    booking.image = imageSrc || '';
    const modal = ensureBookingModal();
    modal.querySelector('.booking-modal__item').textContent =
      [booking.name, booking.price].filter(Boolean).join(' · ');
    const photo = modal.querySelector('.booking-modal__photo');
    if (booking.image) {
      photo.src = booking.image;
      photo.hidden = false;
    } else {
      photo.removeAttribute('src');
      photo.hidden = true;
    }
    modal.querySelector('.booking-modal__status').hidden = true;
    modal.hidden = false;
  };

  const fileFromImage = async (src) => {
    const res = await fetch(src);
    if (!res.ok) throw new Error('image fetch failed');
    const blob = await res.blob();
    const type = blob.type || 'image/jpeg';
    const ext = type.includes('png') ? 'png' : 'jpg';
    return new File([blob], `nknshop-product.${ext}`, { type });
  };

  const productTitle = document.querySelector('.product-layout h1')?.textContent?.trim();
  const productPrice = document.querySelector('.product-layout .price')?.childNodes[0]?.textContent?.trim();

  document.querySelectorAll('.btn-wide').forEach((btn) => {
    if (btn.closest('.booking-modal')) return;
    const name = btn.dataset.product || productTitle || 'a product from NKNSHOP';
    const price = btn.dataset.price || productPrice || '';
    btn.textContent = 'Book on WhatsApp';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openBooking(name, price, btn.dataset.image || pageProductImage());
    });
  });

  document.querySelectorAll('.js-whatsapp-book').forEach((btn) => {
    const name = btn.dataset.product || 'a product from NKNSHOP';
    const price = btn.dataset.price || '';
    btn.removeAttribute('href');
    btn.setAttribute('role', 'button');
    if (!btn.dataset.keepLabel) btn.textContent = 'Book on WhatsApp';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openBooking(name, price, btn.dataset.image || pageProductImage());
    });
  });

  document.querySelectorAll('.cart-count').forEach((count) => {
    const link = count.closest('a');
    if (!link) return;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      openBooking('NKNSHOP order', '', '');
    });
  });

  const contactForm = document.querySelector('.contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fields = [...contactForm.querySelectorAll('input, textarea')].map((el) => el.value.trim()).filter(Boolean);
      const text = fields.length
        ? `Hi NKNSHOP,\n${fields.join('\n')}`
        : 'Hi NKNSHOP, I have a question about an order.';
      openWhatsApp(text);
    });
  }

  const trackForm = document.querySelector('.track-form');
  if (trackForm) {
    trackForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const awb = trackForm.querySelector('[name="awb"]')?.value.trim();
      if (!awb) return;
      window.open(`https://shiprocket.co/tracking/${encodeURIComponent(awb)}`, '_blank', 'noopener');
    });
  }

  const drawer = document.querySelector('.mobile-drawer');
  const overlay = document.querySelector('.drawer-overlay');
  const openBtn = document.querySelector('.js-menu-open');
  const closeBtns = document.querySelectorAll('.js-menu-close');

  const open = () => {
    if (!drawer) return;
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    if (overlay) overlay.hidden = false;
    document.body.style.overflow = 'hidden';
  };

  const close = () => {
    if (!drawer) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    if (overlay) overlay.hidden = true;
    document.body.style.overflow = '';
  };

  openBtn?.addEventListener('click', open);
  closeBtns.forEach((btn) => btn.addEventListener('click', close));

  const GALLERIES = {
    'juicer-1.jpg': ['assets/juicer-1.jpg', 'assets/juicer-2.jpg'],
    'buds-1.jpg': ['assets/buds-1.jpg', 'assets/buds-2.jpg', 'assets/buds-3.jpg', 'assets/buds-4.jpg'],
    'oneplus-4.jpg': ['assets/oneplus-4.jpg', 'assets/oneplus-1.jpg', 'assets/oneplus-2.jpg', 'assets/oneplus-3.jpg'],
    'oneplus-1.jpg': ['assets/oneplus-4.jpg', 'assets/oneplus-1.jpg', 'assets/oneplus-2.jpg', 'assets/oneplus-3.jpg'],
    'airpods-2.jpg': ['assets/airpods-2.jpg', 'assets/airpods-3.jpg', 'assets/airpods-1.jpg'],
    'airpods-1.jpg': ['assets/airpods-2.jpg', 'assets/airpods-3.jpg', 'assets/airpods-1.jpg'],
    'samsung-typec-1.jpg': ['assets/samsung-typec-1.jpg', 'assets/samsung-typec-2.jpg', 'assets/samsung-typec-3.jpg'],
    'usbc-cable.jpg': ['assets/usbc-cable.jpg', 'assets/usbc-cable-2.jpg'],
    'sandisk-128.jpg': ['assets/sandisk-128.jpg', 'assets/sandisk-128-2.jpg']
  };

  const fileName = (src) => (src || '').split('?')[0].split('/').pop();
  const galleryList = (src) => GALLERIES[fileName(src)] || null;

  const addArrows = (host) => {
    const prev = document.createElement('button');
    const next = document.createElement('button');
    prev.type = 'button';
    next.type = 'button';
    prev.className = 'gallery-nav prev';
    next.className = 'gallery-nav next';
    prev.setAttribute('aria-label', 'Previous image');
    next.setAttribute('aria-label', 'Next image');
    prev.textContent = '‹';
    next.textContent = '›';
    host.appendChild(prev);
    host.appendChild(next);
    return { prev, next };
  };

  const bindSlider = (host, img, srcs, thumbs) => {
    let index = 0;
    let hovering = false;
    const show = (i) => {
      index = (i + srcs.length) % srcs.length;
      img.src = hovering ? srcs[(index + 1) % srcs.length] : srcs[index];
      if (!hovering) img.src = srcs[index];
      if (thumbs) thumbs.forEach((btn, n) => btn.classList.toggle('is-active', n === index));
    };
    const paint = () => {
      img.src = hovering ? srcs[(index + 1) % srcs.length] : srcs[index];
    };

    const { prev, next } = addArrows(host);
    const go = (delta, e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      index = (index + delta + srcs.length) % srcs.length;
      paint();
      if (thumbs) thumbs.forEach((btn, n) => btn.classList.toggle('is-active', n === index));
    };

    prev.addEventListener('click', (e) => go(-1, e));
    next.addEventListener('click', (e) => go(1, e));
    host.addEventListener('mouseenter', () => {
      hovering = true;
      paint();
    });
    host.addEventListener('mouseleave', () => {
      hovering = false;
      paint();
    });
    if (thumbs) {
      thumbs.forEach((btn, i) => btn.addEventListener('click', () => {
        index = i;
        hovering = false;
        paint();
        thumbs.forEach((b, n) => b.classList.toggle('is-active', n === index));
      }));
    }
  };

  document.querySelectorAll('.product-gallery').forEach((gallery) => {
    const main = gallery.querySelector('#mainImage') || gallery.querySelector('img');
    if (!main) return;
    if (!main.id) main.id = 'mainImage';

    let thumbs = [...gallery.querySelectorAll('.gallery-thumbs button')];
    let srcs = thumbs.map((btn) => btn.dataset.src).filter(Boolean);
    if (!srcs.length) srcs = galleryList(main.getAttribute('src')) || [];
    if (srcs.length < 2) srcs = [main.getAttribute('src').split('?')[0], ...(galleryList(main.getAttribute('src')) || [])].filter((v, i, a) => a.indexOf(v) === i);
    if (srcs.length < 2) return;

    if (!thumbs.length) {
      const wrap = document.createElement('div');
      wrap.className = 'gallery-thumbs';
      wrap.innerHTML = srcs
        .map((src, i) => `<button type="button" class="${i === 0 ? 'is-active' : ''}" data-src="${src}"><img src="${src}" alt=""></button>`)
        .join('');
      gallery.appendChild(wrap);
      thumbs = [...wrap.querySelectorAll('button')];
    }

    const stage = document.createElement('div');
    stage.className = 'gallery-stage';
    main.parentNode.insertBefore(stage, main);
    stage.appendChild(main);
    bindSlider(stage, main, srcs, thumbs);
  });

  document.querySelectorAll('.product-card__media img').forEach((img) => {
    const list = galleryList(img.getAttribute('src'));
    if (!list || list.length < 2) return;
    const original = img.getAttribute('src');
    const hoverSrc = list[1];
    const el = img.closest('.product-card__media');
    el.addEventListener('mouseenter', () => {
      img.src = hoverSrc;
    });
    el.addEventListener('mouseleave', () => {
      img.src = original;
    });
  });

  document.querySelectorAll('.hero-carousel').forEach((carousel) => {
    const slides = [...carousel.querySelectorAll('.hero-slide')];
    if (slides.length < 2) return;
    const ms = Number(carousel.dataset.interval) || 2000;
    let i = slides.findIndex((s) => s.classList.contains('is-active'));
    if (i < 0) i = 0;
    setInterval(() => {
      slides.forEach((slide) => slide.classList.remove('is-active'));
      i = (i + 1) % slides.length;
      slides[i].classList.add('is-active');
    }, ms);
  });
});
