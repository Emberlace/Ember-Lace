/* Ember & Lace — full catalog data (mock, pre-supplier).
   154 styles across three collections. Gradient placeholders rotate per
   collection so the grid stays varied on the dark theme. */

export type Collection = "everyday" | "lace" | "luxe";

export type Product = {
  id: string;
  name: string;
  price: number;
  sizes: string;
  tag: string;
  gradient: string;
  blurb?: string;
  collection: Collection;
};

type RawProduct = Omit<Product, "gradient">;

/* Rotating gradient palettes per collection (dark, Bold & Sultry). */
const PALETTES: Record<Collection, string[]> = {
  everyday: [
    "linear-gradient(135deg,#0f1f1a 0%,#2f5d50 100%)",
    "linear-gradient(135deg,#0e1626 0%,#2c4a7c 100%)",
    "linear-gradient(135deg,#241016 0%,#8c2f3c 100%)",
    "linear-gradient(135deg,#1a1611 0%,#6e5b3a 100%)",
    "linear-gradient(135deg,#101a24 0%,#3a6e6e 100%)",
    "linear-gradient(135deg,#1c1420 0%,#5d4a7c 100%)",
    "linear-gradient(135deg,#0f1a12 0%,#4a7c43 100%)",
    "linear-gradient(135deg,#201410 0%,#8c5a2f 100%)",
  ],
  lace: [
    "linear-gradient(135deg,#2a0f18 0%,#7f1d2d 100%)",
    "linear-gradient(135deg,#1c0f22 0%,#5b2a6e 100%)",
    "linear-gradient(135deg,#0d0a10 0%,#a31621 100%)",
    "linear-gradient(135deg,#1c0f1c 0%,#7c2a5d 100%)",
    "linear-gradient(135deg,#241016 0%,#a31621 100%)",
    "linear-gradient(135deg,#100f22 0%,#2a3a7c 100%)",
    "linear-gradient(135deg,#221006 0%,#8c4a1d 100%)",
    "linear-gradient(135deg,#160f1c 0%,#6e2a4a 100%)",
  ],
  luxe: [
    "linear-gradient(135deg,#100b0e 0%,#6b551f 58%,#c9a24b 135%)",
    "linear-gradient(135deg,#1a0d12 0%,#7f1d2d 58%,#c9a24b 135%)",
    "linear-gradient(135deg,#0b0e10 0%,#2f4d4d 60%,#c9a24b 140%)",
    "linear-gradient(135deg,#140d1a 0%,#5b2a6e 60%,#c9a24b 140%)",
    "linear-gradient(135deg,#120d0d 0%,#8c2f1d 60%,#c9a24b 140%)",
    "linear-gradient(135deg,#0d1210 0%,#3a5d3a 60%,#c9a24b 140%)",
  ],
};

const RAW: RawProduct[] = [
  /* ------------------------- Everyday Essentials (~42) ------------------------ */
  { id: "cloudsoft-tshirt-bra", name: "CloudSoft T-Shirt Bra", price: 38, sizes: "30A–44H+", tag: "Bestseller", collection: "everyday", blurb: "Our most-reached-for smoothing bra." },
  { id: "second-skin-brief", name: "Second-Skin High Brief", price: 18, sizes: "XS–4X", tag: "Everyday", collection: "everyday" },
  { id: "sunday-bralette", name: "Sunday Soft Bralette", price: 28, sizes: "XS–4X", tag: "Everyday", collection: "everyday" },
  { id: "barely-there-thong", name: "Barely-There Thong (3-Pack)", price: 24, sizes: "XS–4X", tag: "3-Pack", collection: "everyday" },
  { id: "feathermodal-wirefree", name: "FeatherModal Wire-Free Bra", price: 34, sizes: "30A–44G", tag: "Everyday", collection: "everyday" },
  { id: "bamboo-hug-bralette", name: "Bamboo Hug Bralette", price: 26, sizes: "XS–4X", tag: "Eco Soft", collection: "everyday" },
  { id: "cotton-cloud-boyshort", name: "Cotton Cloud Boyshort", price: 16, sizes: "XS–4X", tag: "Everyday", collection: "everyday" },
  { id: "seamless-brief", name: "Everyday Seamless Brief", price: 17, sizes: "XS–4X", tag: "Seamless", collection: "everyday" },
  { id: "softbloom-lacetrim", name: "SoftBloom Lace-Trim Bralette", price: 29, sizes: "XS–4X", tag: "Everyday", collection: "everyday" },
  { id: "allday-strapless", name: "All-Day Comfort Strapless Bra", price: 36, sizes: "32A–42G", tag: "Strapless", collection: "everyday" },
  { id: "modal-highbrief-duo", name: "Modal High-Waist Brief Duo", price: 26, sizes: "XS–4X", tag: "2-Pack", collection: "everyday" },
  { id: "coolcotton-bikini", name: "CoolCotton Bikini (3-Pack)", price: 22, sizes: "XS–4X", tag: "3-Pack", collection: "everyday" },
  { id: "loungeflow-cami", name: "LoungeFlow Cami", price: 28, sizes: "XS–4X", tag: "Lounge", collection: "everyday" },
  { id: "dreamknit-sleep-short", name: "DreamKnit Sleep Short", price: 24, sizes: "XS–4X", tag: "Sleep", collection: "everyday" },
  { id: "cloudrest-nursing", name: "CloudRest Nursing Bra", price: 38, sizes: "32B–44G", tag: "Nursing", collection: "everyday" },
  { id: "flexfit-sport-bralette", name: "FlexFit Sports Bralette", price: 32, sizes: "XS–4X", tag: "Active", collection: "everyday" },
  { id: "ivory-whisper-bralette", name: "Ivory Whisper Bralette", price: 27, sizes: "XS–4X", tag: "Everyday", collection: "everyday" },
  { id: "noir-thong-duo", name: "Noir Essential Thong Duo", price: 22, sizes: "XS–4X", tag: "2-Pack", collection: "everyday" },
  { id: "blush-brief-trio", name: "Blush Comfort Brief Trio", price: 28, sizes: "XS–4X", tag: "3-Pack", collection: "everyday" },
  { id: "oatmilk-seamless-cami", name: "Oat Milk Seamless Cami", price: 26, sizes: "XS–4X", tag: "Seamless", collection: "everyday" },
  { id: "cocoa-boyshort-duo", name: "Cocoa Modal Boyshort Duo", price: 24, sizes: "XS–4X", tag: "2-Pack", collection: "everyday" },
  { id: "sage-bamboo-hipster", name: "Sage Bamboo Hipster", price: 18, sizes: "XS–4X", tag: "Eco Soft", collection: "everyday" },
  { id: "terracotta-softcup", name: "Terracotta Soft-Cup Bra", price: 34, sizes: "30B–44G", tag: "Everyday", collection: "everyday" },
  { id: "slate-wirefree", name: "Slate Wire-Free T-Shirt Bra", price: 36, sizes: "30A–44H+", tag: "Bestseller", collection: "everyday" },
  { id: "rosewater-laceback", name: "Rosewater Lace-Back Bralette", price: 30, sizes: "XS–4X", tag: "Everyday", collection: "everyday" },
  { id: "midnight-modal-brief", name: "Midnight Modal Brief", price: 19, sizes: "XS–4X", tag: "Everyday", collection: "everyday" },
  { id: "honey-thong-trio", name: "Honey Seamless Thong Trio", price: 24, sizes: "XS–4X", tag: "3-Pack", collection: "everyday" },
  { id: "stone-ribbed-cami", name: "Stone Ribbed Cami", price: 25, sizes: "XS–4X", tag: "Lounge", collection: "everyday" },
  { id: "olive-sleep-short", name: "Olive Sleep Short", price: 23, sizes: "XS–4X", tag: "Sleep", collection: "everyday" },
  { id: "plum-balconette-lite", name: "Plum Comfort Balconette Lite", price: 36, sizes: "30B–42G", tag: "Everyday", collection: "everyday" },
  { id: "champagne-strapless", name: "Champagne Smooth Strapless", price: 35, sizes: "32A–40F", tag: "Strapless", collection: "everyday" },
  { id: "ember-hipster-duo", name: "Ember Cotton Hipster Duo", price: 22, sizes: "XS–4X", tag: "2-Pack", collection: "everyday" },
  { id: "ash-high-brief", name: "Ash Gray High Brief", price: 18, sizes: "XS–4X", tag: "Everyday", collection: "everyday" },
  { id: "moss-modal-cami", name: "Moss Modal Cami Set", price: 32, sizes: "XS–4X", tag: "Lounge", collection: "everyday" },
  { id: "dusk-bamboo-short", name: "Dusk Bamboo Sleep Short", price: 24, sizes: "XS–4X", tag: "Sleep", collection: "everyday" },
  { id: "porcelain-unpadded", name: "Porcelain Padding-Free Bra", price: 33, sizes: "30A–42F", tag: "Everyday", collection: "everyday" },
  { id: "clay-ribbed-boyshort", name: "Clay Ribbed Boyshort", price: 17, sizes: "XS–4X", tag: "Everyday", collection: "everyday" },
  { id: "petal-soft-thong", name: "Petal Soft Thong", price: 16, sizes: "XS–4X", tag: "Everyday", collection: "everyday" },
  { id: "espresso-brief-duo", name: "Espresso Seamless Brief Duo", price: 25, sizes: "XS–4X", tag: "2-Pack", collection: "everyday" },
  { id: "sky-modal-bralette", name: "Sky Modal Bralette", price: 27, sizes: "XS–4X", tag: "Everyday", collection: "everyday" },
  { id: "goldenhour-lounge-cami", name: "Golden Hour Lounge Cami", price: 29, sizes: "XS–4X", tag: "Lounge", collection: "everyday" },
  { id: "willow-sleep-short", name: "Willow Cotton Sleep Short", price: 22, sizes: "XS–4X", tag: "Sleep", collection: "everyday" },

  /* ---------------------------- Lace & Spice (~40) --------------------------- */
  { id: "ember-lace-balconette", name: "Ember Lace Balconette", price: 52, sizes: "30B–44G", tag: "Lace & Spice", collection: "lace", blurb: "The set that started the mood." },
  { id: "midnight-teddy", name: "Midnight Lace Teddy", price: 68, sizes: "XS–4X", tag: "Statement", collection: "lace" },
  { id: "oxblood-strappy-set", name: "Oxblood Strappy Bra Set", price: 58, sizes: "30B–44G", tag: "Strappy", collection: "lace" },
  { id: "champagne-chantilly-chemise", name: "Champagne Chantilly Chemise", price: 64, sizes: "XS–4X", tag: "Chemise", collection: "lace" },
  { id: "noir-mesh-bodysuit", name: "Noir Mesh Bodysuit", price: 56, sizes: "XS–4X", tag: "Bodysuit", collection: "lace" },
  { id: "emerald-garter-set", name: "Emerald Lace Garter Set", price: 72, sizes: "XS–4X", tag: "Garter Set", collection: "lace" },
  { id: "ivory-bridal-balconette", name: "Ivory Bridal Balconette", price: 62, sizes: "30B–42H", tag: "Bridal", collection: "lace" },
  { id: "bordeaux-scallop-teddy", name: "Bordeaux Scallop Teddy", price: 66, sizes: "XS–4X", tag: "Statement", collection: "lace" },
  { id: "blush-peekaboo-set", name: "Blush Peekaboo Bra Set", price: 54, sizes: "30A–44F", tag: "Lace & Spice", collection: "lace" },
  { id: "onyx-caged-bralette", name: "Onyx Caged Bralette Set", price: 48, sizes: "XS–4X", tag: "Strappy", collection: "lace" },
  { id: "ruby-satin-chemise", name: "Ruby Satin Chemise", price: 62, sizes: "XS–4X", tag: "Chemise", collection: "lace" },
  { id: "plum-velvet-teddy", name: "Plum Velvet-Trim Teddy", price: 70, sizes: "XS–4X", tag: "Statement", collection: "lace" },
  { id: "cobalt-strappy-set", name: "Cobalt Mesh Strappy Set", price: 56, sizes: "30B–44G", tag: "Strappy", collection: "lace" },
  { id: "rosegold-bodysuit", name: "Rose Gold Lace Bodysuit", price: 60, sizes: "XS–4X", tag: "Bodysuit", collection: "lace" },
  { id: "forest-balconette", name: "Forest Lace Balconette", price: 54, sizes: "30C–44H", tag: "Lace & Spice", collection: "lace" },
  { id: "saffron-brief-set", name: "Saffron Mesh High-Brief Set", price: 46, sizes: "XS–4X", tag: "Lace & Spice", collection: "lace" },
  { id: "scarlet-garter-set", name: "Scarlet Satin Garter Set", price: 74, sizes: "XS–4X", tag: "Garter Set", collection: "lace" },
  { id: "lilac-whisper-chemise", name: "Lilac Whisper Chemise", price: 58, sizes: "XS–4X", tag: "Chemise", collection: "lace" },
  { id: "copper-foil-teddy", name: "Copper Foil Lace Teddy", price: 69, sizes: "XS–4X", tag: "Statement", collection: "lace" },
  { id: "pearl-beaded-bodysuit", name: "Pearl Beaded Bodysuit", price: 78, sizes: "XS–4X", tag: "Limited", collection: "lace" },
  { id: "wine-embroidery-set", name: "Wine Floral Embroidery Set", price: 57, sizes: "30B–44G", tag: "Lace & Spice", collection: "lace" },
  { id: "teal-scallop-balconette", name: "Teal Scallop Balconette", price: 53, sizes: "30B–42H", tag: "Lace & Spice", collection: "lace" },
  { id: "noir-ruffle-chemise", name: "Noir Ruffle Chemise", price: 60, sizes: "XS–4X", tag: "Chemise", collection: "lace" },
  { id: "gold-hourglass-garter", name: "Gold Hourglass Garter Set", price: 76, sizes: "XS–4X", tag: "Garter Set", collection: "lace" },
  { id: "mauve-strappy-duo", name: "Mauve Strappy Bralette Duo", price: 44, sizes: "XS–4X", tag: "Strappy", collection: "lace" },
  { id: "indigo-sheer-bodysuit", name: "Indigo Sheer Bodysuit", price: 58, sizes: "XS–4X", tag: "Bodysuit", collection: "lace" },
  { id: "cherry-longline", name: "Cherry Lace Longline Bra", price: 52, sizes: "30C–44G", tag: "Lace & Spice", collection: "lace" },
  { id: "smoke-mesh-teddy", name: "Smoke Mesh Teddy", price: 64, sizes: "XS–4X", tag: "Statement", collection: "lace" },
  { id: "honeysuckle-set", name: "Honeysuckle Lace Set", price: 55, sizes: "30B–44F", tag: "Lace & Spice", collection: "lace" },
  { id: "obsidian-strappy-set", name: "Obsidian Strappy Lace Set", price: 68, sizes: "XS–4X", tag: "Strappy", collection: "lace" },
  { id: "cinnamon-satin-teddy", name: "Cinnamon Satin Teddy", price: 66, sizes: "XS–4X", tag: "Statement", collection: "lace" },
  { id: "frost-chemise", name: "Frost Blue Chemise", price: 59, sizes: "XS–4X", tag: "Chemise", collection: "lace" },
  { id: "garnet-halter-bodysuit", name: "Garnet Halter Bodysuit", price: 61, sizes: "XS–4X", tag: "Bodysuit", collection: "lace" },
  { id: "nude-illusion-set", name: "Nude Illusion Lace Set", price: 57, sizes: "30A–44G", tag: "Lace & Spice", collection: "lace" },
  { id: "violet-garter-set", name: "Violet Ruched Garter Set", price: 73, sizes: "XS–4X", tag: "Garter Set", collection: "lace" },
  { id: "jade-embroidered-teddy", name: "Jade Embroidered Teddy", price: 67, sizes: "XS–4X", tag: "Statement", collection: "lace" },
  { id: "blackcherry-balconette", name: "Black Cherry Balconette", price: 55, sizes: "30B–44H", tag: "Bestseller", collection: "lace" },
  { id: "mocha-whipped-set", name: "Mocha Whipped Lace Set", price: 49, sizes: "30B–42G", tag: "Lace & Spice", collection: "lace" },
  { id: "sunset-ombre-set", name: "Sunset Ombré Mesh Set", price: 47, sizes: "XS–4X", tag: "Lace & Spice", collection: "lace" },
  { id: "silver-starlight-chemise", name: "Silver Starlight Chemise", price: 63, sizes: "XS–4X", tag: "Chemise", collection: "lace" },

  /* -------------------------------- Luxe (20) ------------------------------- */
  { id: "gilded-hour-silk-slip", name: "Gilded Hour Silk Slip", price: 138, sizes: "XS–4X", tag: "Luxe", collection: "luxe", blurb: "Pure mulberry silk with hand-finished French seams." },
  { id: "couture-chantilly-ensemble", name: "Couture Chantilly Lace Ensemble", price: 148, sizes: "XS–4X · 30B–44H+", tag: "Luxe", collection: "luxe", blurb: "Couture Chantilly lace, tailored to your curves." },
  { id: "mulberry-champagne-slip", name: "Mulberry Silk Slip — Champagne", price: 142, sizes: "XS–4X", tag: "Luxe", collection: "luxe" },
  { id: "noir-silk-robe", name: "Noir Silk Robe — Hand-Finished", price: 168, sizes: "XS–4X", tag: "Luxe", collection: "luxe" },
  { id: "ivory-couture-set", name: "Ivory Couture Lace Bra Set", price: 128, sizes: "30B–44H+", tag: "Luxe", collection: "luxe" },
  { id: "emerald-silk-chemise", name: "Emerald Silk Chemise", price: 148, sizes: "XS–4X", tag: "Luxe", collection: "luxe" },
  { id: "cashmere-oat-set", name: "Cashmere Lounge Set — Oat", price: 158, sizes: "XS–4X", tag: "Luxe", collection: "luxe", blurb: "Featherweight cashmere for slow mornings." },
  { id: "oxblood-silk-bodysuit", name: "Oxblood Silk Bodysuit", price: 138, sizes: "XS–4X", tag: "Luxe", collection: "luxe" },
  { id: "blush-chantilly-robe", name: "Blush Chantilly Lace Robe", price: 155, sizes: "XS–4X", tag: "Luxe", collection: "luxe" },
  { id: "champagne-long-slip", name: "Champagne Silk Slip — Long", price: 152, sizes: "XS–4X", tag: "Luxe", collection: "luxe" },
  { id: "noir-couture-corset", name: "Noir Couture Corset Set", price: 165, sizes: "XS–4X · 30B–44H+", tag: "Luxe", collection: "luxe" },
  { id: "rose-silk-set", name: "Rose Silk & Lace Bra Set", price: 132, sizes: "30B–44H+", tag: "Luxe", collection: "luxe" },
  { id: "ivory-bridal-robe", name: "Ivory Silk Bridal Robe", price: 162, sizes: "XS–4X", tag: "Luxe", collection: "luxe" },
  { id: "graphite-cashmere-slip", name: "Graphite Cashmere Lounge Slip", price: 145, sizes: "XS–4X", tag: "Luxe", collection: "luxe" },
  { id: "burgundy-cowl-slip", name: "Burgundy Silk Slip — Cowl", price: 140, sizes: "XS–4X", tag: "Luxe", collection: "luxe" },
  { id: "gold-dusted-ensemble", name: "Gold-Dusted Lace Ensemble", price: 168, sizes: "XS–4X · 30B–44H+", tag: "Limited", collection: "luxe" },
  { id: "slate-silk-pajama", name: "Slate Silk Pajama Set", price: 150, sizes: "XS–4X", tag: "Luxe", collection: "luxe" },
  { id: "pearl-cami-set", name: "Pearl Silk Cami & Short Set", price: 125, sizes: "XS–4X", tag: "Luxe", collection: "luxe" },
  { id: "forest-wrap-robe", name: "Forest Silk Wrap Robe", price: 160, sizes: "XS–4X", tag: "Luxe", collection: "luxe" },
  { id: "nude-couture-set", name: "Nude Couture Embroidery Set", price: 135, sizes: "30B–44H+", tag: "Luxe", collection: "luxe" },

  /* --------------------- Everyday Essentials — wave 2 (21) ------------------- */
  { id: "juniper-ribbed-bralette", name: "Juniper Ribbed Bralette", price: 28, sizes: "XS–4X", tag: "Everyday", collection: "everyday" },
  { id: "drift-cotton-hipster-trio", name: "Drift Cotton Hipster Trio", price: 30, sizes: "XS–4X", tag: "3-Pack", collection: "everyday" },
  { id: "almond-wirefree-bra", name: "Almond Wire-Free Comfort Bra", price: 35, sizes: "32B–44H", tag: "Everyday", collection: "everyday" },
  { id: "fern-mesh-bralette", name: "Fern Breathable Mesh Bralette", price: 27, sizes: "XS–4X", tag: "Everyday", collection: "everyday" },
  { id: "cocoa-lounge-shorts", name: "Cocoa Lounge Short Duo", price: 26, sizes: "XS–4X", tag: "2-Pack", collection: "everyday" },
  { id: "pearl-seamless-thong-duo", name: "Pearl Seamless Thong Duo", price: 21, sizes: "XS–4X", tag: "2-Pack", collection: "everyday" },
  { id: "cedar-ribbed-cami", name: "Cedar Ribbed Lounge Cami", price: 27, sizes: "XS–4X", tag: "Lounge", collection: "everyday" },
  { id: "blush-pima-brief", name: "Blush Pima Cotton Brief", price: 17, sizes: "XS–4X", tag: "Everyday", collection: "everyday" },
  { id: "slate-highbrief-duo", name: "Slate High-Rise Brief Duo", price: 25, sizes: "XS–4X", tag: "2-Pack", collection: "everyday" },
  { id: "marigold-sleep-cami", name: "Marigold Sleep Cami", price: 26, sizes: "XS–4X", tag: "Sleep", collection: "everyday" },
  { id: "fog-modal-boyshort", name: "Fog Modal Boyshort", price: 18, sizes: "XS–4X", tag: "Everyday", collection: "everyday" },
  { id: "chestnut-softcup-bra", name: "Chestnut Soft-Cup Comfort Bra", price: 34, sizes: "30B–44G", tag: "Everyday", collection: "everyday" },
  { id: "lilac-cami-bra", name: "Lilac Cami Bra", price: 29, sizes: "XS–4X", tag: "Everyday", collection: "everyday" },
  { id: "ecru-cotton-bikini-duo", name: "Ecru Cotton Bikini Duo", price: 22, sizes: "XS–4X", tag: "2-Pack", collection: "everyday" },
  { id: "moss-ribbed-brief", name: "Moss Ribbed High Brief", price: 19, sizes: "XS–4X", tag: "Everyday", collection: "everyday" },
  { id: "rosehip-cloud-bralette", name: "Rosehip Cloud Bralette", price: 28, sizes: "XS–4X", tag: "Everyday", collection: "everyday" },
  { id: "graphite-sport-bra", name: "Graphite Low-Impact Sports Bra", price: 33, sizes: "XS–4X", tag: "Active", collection: "everyday" },
  { id: "sand-seamless-hipster", name: "Sand Seamless Hipster Duo", price: 23, sizes: "XS–4X", tag: "2-Pack", collection: "everyday" },
  { id: "dusk-maternity-bra", name: "Dusk Maternity Comfort Bra", price: 37, sizes: "32B–44G", tag: "Nursing", collection: "everyday" },
  { id: "meadow-bamboo-cami", name: "Meadow Bamboo Lounge Cami", price: 28, sizes: "XS–4X", tag: "Eco Soft", collection: "everyday" },
  { id: "ember-modal-sleep-set", name: "Ember Modal Sleep Cami Set", price: 31, sizes: "XS–4X", tag: "Sleep", collection: "everyday" },

  /* ---------------------- Lace & Spice — wave 2 (19) ------------------------- */
  { id: "crimson-flutter-teddy", name: "Crimson Flutter Lace Teddy", price: 67, sizes: "XS–4X", tag: "Statement", collection: "lace" },
  { id: "onyx-satin-slip", name: "Onyx Satin Slip Chemise", price: 61, sizes: "XS–4X", tag: "Chemise", collection: "lace" },
  { id: "champagne-floral-bodysuit", name: "Champagne Floral Lace Bodysuit", price: 59, sizes: "XS–4X", tag: "Bodysuit", collection: "lace" },
  { id: "rouge-strappy-balconette", name: "Rouge Strappy Balconette", price: 54, sizes: "30B–44G", tag: "Strappy", collection: "lace" },
  { id: "midnight-velvet-garter", name: "Midnight Velvet Garter Set", price: 75, sizes: "XS–4X", tag: "Garter Set", collection: "lace" },
  { id: "sage-embroidered-chemise", name: "Sage Embroidered Chemise", price: 57, sizes: "XS–4X", tag: "Chemise", collection: "lace" },
  { id: "noir-feather-teddy", name: "Noir Feather-Trim Teddy", price: 71, sizes: "XS–4X", tag: "Statement", collection: "lace" },
  { id: "tawny-mesh-longline", name: "Tawny Mesh Longline Set", price: 51, sizes: "30B–42G", tag: "Lace & Spice", collection: "lace" },
  { id: "claret-bow-bodysuit", name: "Claret Bow-Back Bodysuit", price: 60, sizes: "XS–4X", tag: "Bodysuit", collection: "lace" },
  { id: "pearl-drop-garter", name: "Pearl-Drop Garter Set", price: 74, sizes: "XS–4X", tag: "Garter Set", collection: "lace" },
  { id: "ember-rose-chemise", name: "Ember Rose Lace Chemise", price: 62, sizes: "XS–4X", tag: "Chemise", collection: "lace" },
  { id: "slate-illusion-teddy", name: "Slate Illusion Lace Teddy", price: 65, sizes: "XS–4X", tag: "Statement", collection: "lace" },
  { id: "golden-mesh-balconette", name: "Golden Mesh Balconette Set", price: 56, sizes: "30B–44H", tag: "Lace & Spice", collection: "lace" },
  { id: "cocoa-broderie-set", name: "Cocoa Broderie Lace Set", price: 48, sizes: "30A–44F", tag: "Lace & Spice", collection: "lace" },
  { id: "aubergine-sheer-bodysuit", name: "Aubergine Sheer Bodysuit", price: 59, sizes: "XS–4X", tag: "Bodysuit", collection: "lace" },
  { id: "scarlet-ruffle-teddy", name: "Scarlet Ruffle-Shoulder Teddy", price: 68, sizes: "XS–4X", tag: "Statement", collection: "lace" },
  { id: "moonlit-silver-set", name: "Moonlit Silver Lace Set", price: 52, sizes: "30B–42H", tag: "Lace & Spice", collection: "lace" },
  { id: "honey-embroidery-garter", name: "Honey Floral Garter Set", price: 72, sizes: "XS–4X", tag: "Garter Set", collection: "lace" },
  { id: "noir-velvet-chemise", name: "Noir Velvet-Trim Chemise", price: 64, sizes: "XS–4X", tag: "Chemise", collection: "lace" },

  /* --------------------------- Luxe — wave 2 (12) ---------------------------- */
  { id: "aubergine-silk-slip", name: "Aubergine Silk Bias Slip", price: 144, sizes: "XS–4X", tag: "Luxe", collection: "luxe" },
  { id: "ivory-chantilly-slip", name: "Ivory Chantilly Silk Slip", price: 150, sizes: "XS–4X", tag: "Luxe", collection: "luxe" },
  { id: "espresso-cashmere-robe", name: "Espresso Cashmere Wrap Robe", price: 165, sizes: "XS–4X", tag: "Luxe", collection: "luxe" },
  { id: "sapphire-silk-chemise", name: "Sapphire Silk Chemise", price: 147, sizes: "XS–4X", tag: "Luxe", collection: "luxe" },
  { id: "blush-pearl-ensemble", name: "Blush Pearl-Embroidered Ensemble", price: 158, sizes: "XS–4X · 30B–44H+", tag: "Luxe", collection: "luxe" },
  { id: "copper-satin-slip", name: "Copper Satin Evening Slip", price: 132, sizes: "XS–4X", tag: "Luxe", collection: "luxe" },
  { id: "midnight-couture-robe", name: "Midnight Couture Lace Robe", price: 166, sizes: "XS–4X", tag: "Luxe", collection: "luxe" },
  { id: "dove-cashmere-set", name: "Dove Cashmere Lounge Set", price: 155, sizes: "XS–4X", tag: "Luxe", collection: "luxe" },
  { id: "garnet-silk-bodysuit", name: "Garnet Silk Lace Bodysuit", price: 137, sizes: "XS–4X", tag: "Luxe", collection: "luxe" },
  { id: "sand-silk-pajama", name: "Sand Silk Pajama Duo", price: 149, sizes: "XS–4X", tag: "Luxe", collection: "luxe" },
  { id: "noir-gold-corset", name: "Noir Gold-Boned Couture Corset", price: 168, sizes: "XS–4X · 30B–44H+", tag: "Limited", collection: "luxe" },
  { id: "mist-chantilly-set", name: "Mist Chantilly Bra & Brief Set", price: 129, sizes: "30B–44H+", tag: "Luxe", collection: "luxe" },
];

const seen: Record<Collection, number> = { everyday: 0, lace: 0, luxe: 0 };

export const PRODUCTS: Product[] = RAW.map((r) => {
  const palette = PALETTES[r.collection];
  const gradient = palette[seen[r.collection]++ % palette.length];
  return { ...r, gradient };
});
