export function cloudinaryResize(url, width, height) {
  if (!url || !url.includes("cloudinary.com")) return url;
  const transformation = height
    ? `w_${width},h_${height},c_fill,q_auto,f_auto`
    : `w_${width},q_auto,f_auto`;
  return url.replace("/upload/", `/upload/${transformation}/`);
}
