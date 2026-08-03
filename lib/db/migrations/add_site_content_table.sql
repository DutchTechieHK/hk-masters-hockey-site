-- Stores website photo configuration managed via the admin portal.
-- Replaces the need for the Decap CMS for photo management.

CREATE TABLE IF NOT EXISTS site_content (
  id SERIAL PRIMARY KEY,
  hero_image TEXT,
  mo40_photo TEXT,
  mo50_photo TEXT,
  gallery_images TEXT NOT NULL DEFAULT '[]',
  media_albums TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- For databases created before media_albums existed (schema diff also handles this on publish)
ALTER TABLE site_content ADD COLUMN IF NOT EXISTS media_albums TEXT;
ALTER TABLE site_content ADD COLUMN IF NOT EXISTS page_texts TEXT;
ALTER TABLE site_content ADD COLUMN IF NOT EXISTS page_texts_updated_at TIMESTAMP WITH TIME ZONE;

-- Seed with one row so GET always returns something (gallery pre-filled with defaults)
INSERT INTO site_content (hero_image, mo40_photo, mo50_photo, gallery_images)
SELECT NULL, NULL, NULL, '[{"url":"https://res.cloudinary.com/djyvdrhal/image/upload/v1774853920/HK_M50_d4-0212_ynxitw.jpg"},{"url":"https://res.cloudinary.com/djyvdrhal/image/upload/v1774853981/WhatsApp_Image_2026-03-24_at_21.24.25_1_x7zsqm.jpg"},{"url":"https://res.cloudinary.com/djyvdrhal/image/upload/v1774853981/WhatsApp_Image_2026-03-24_at_21.24.26_viwxfc.jpg"},{"url":"https://res.cloudinary.com/djyvdrhal/image/upload/v1774853981/WhatsApp_Image_2026-03-24_at_21.24.24_phzwyj.jpg"},{"url":"https://res.cloudinary.com/djyvdrhal/image/upload/v1774853921/HK_M50_d4-1425_1_gexlx7.jpg"},{"url":"https://res.cloudinary.com/djyvdrhal/image/upload/v1774854986/58BC6C97-2F7F-4CD1-8F97-C014A864ECC3_moxvd3.jpg"},{"url":"https://res.cloudinary.com/djyvdrhal/image/upload/v1774853921/HK_M50_d4-0855_lj4mgz.jpg"},{"url":"https://res.cloudinary.com/djyvdrhal/image/upload/v1774853985/WhatsApp_Image_2026-03-24_at_21.24.36_larlup.jpg"},{"url":"https://res.cloudinary.com/djyvdrhal/image/upload/v1774853921/HK_M50_d4-0536_veln0s.jpg"},{"url":"https://res.cloudinary.com/djyvdrhal/image/upload/v1774853919/A32I6153_pwqfwv.jpg"},{"url":"https://res.cloudinary.com/djyvdrhal/image/upload/v1777016038/Wajid_mbg2po.jpg"}]'
WHERE NOT EXISTS (SELECT 1 FROM site_content);
