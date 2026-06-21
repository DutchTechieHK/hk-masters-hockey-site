export function cloudinaryResize(url, width, height) {
  if (!url || !url.includes("cloudinary.com")) return url;
  const transformation = height
    ? `w_${width},h_${height},c_fill,g_auto,q_auto,f_auto`
    : `c_limit,w_${width},q_auto,f_auto`;
  if (url.includes(`/upload/${transformation}/`)) return url;
  return url.replace("/upload/", `/upload/${transformation}/`);
}
