# NKNSHOP Shopify theme

Storefront inspired by [Dash Lifestyle](https://dashlifestyle.co/), branded as **NKNSHOP**. Product photos are placeholders so you can drop in your own images later.

## Preview now (no Shopify needed)

```powershell
cd c:\Users\nithi\Desktop\NknSHop
python server.py
```

Then open `http://localhost:5500`.

Or open `preview/index.html` in your browser (WhatsApp booking works; Shiprocket auto needs `server.py` and `.env`).

## Upload to Shopify later

1. Zip the **contents** of the `theme` folder (not the parent `NknSHop` folder). The zip must contain `layout/theme.liquid` at the top level.
2. In Shopify admin: **Online Store → Themes → Add theme → Upload zip file**.
3. Publish the theme.
4. **Settings → Files / Theme editor**: upload the NKNSHOP logo (`theme/assets/logo.png` is already included).
5. Create collections matching the menu:
   - Air Pods
   - Air Max
   - Samsung Buds 2 Pro
   - Air Pro Silicon Covers
   - Adapters, Cables, and Powerbanks
   - IWatch Series
   - Speakers
6. Add products with compare-at prices for sale badges. Attach images when you have them — the theme shows “Image coming soon” until then.
7. Create pages **About Us** and **Contact**. Assign the **contact** template to Contact.
8. In the theme editor homepage, assign each featured collection section to the matching collection.

## Suggested homepage copy

- Announcement: Sale is Live Now!!!
- Trust: 10000+ HAPPY CUSTOMERS
- Bar: CASH ON DELIVERY | FREE SHIPPING | EASY EXCHANGES
- Promo: The All New Air Pro 4 ANC
