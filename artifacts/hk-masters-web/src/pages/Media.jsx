import { useState } from "react";
import content from "../content/media.json";

export default function Media() {
  const [lightbox, setLightbox] = useState(null);
  const [activeAlbum, setActiveAlbum] = useState(null);

  const albums = content.albums || [];
  const videos = content.videos || [];

  const displayAlbum = activeAlbum ?? (albums.length > 0 ? albums[0] : null);

  return (
    <div>
      {/* Page Header */}
      <div className="bg-[#006B3C] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold mb-3">Media</h1>
          <p className="text-green-200 text-lg max-w-xl">
            Photos, videos, and highlights from Hong Kong Masters Hockey.
          </p>
        </div>
      </div>

      {/* Photo Albums */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Photo Gallery</h2>

        {albums.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center text-gray-400">
            <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="font-medium">No albums yet</p>
            <p className="text-sm mt-1">Add photo albums via the CMS under Media → Photo Albums</p>
          </div>
        ) : (
          <div className="flex gap-8">
            {/* Album Sidebar */}
            <div className="w-56 shrink-0 space-y-1">
              {albums.map((album, index) => (
                <button
                  key={index}
                  onClick={() => setActiveAlbum(album)}
                  className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                    displayAlbum?.name === album.name
                      ? "bg-[#006B3C] text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span className="block truncate">{album.name}</span>
                  <span className={`text-xs mt-0.5 block ${displayAlbum?.name === album.name ? "text-green-200" : "text-gray-400"}`}>
                    {(album.photos || []).length} photo{(album.photos || []).length !== 1 ? "s" : ""}
                  </span>
                </button>
              ))}
            </div>

            {/* Album Photos */}
            <div className="flex-1 min-w-0">
              {displayAlbum && (
                <>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">{displayAlbum.name}</h3>
                  {(displayAlbum.photos || []).length === 0 ? (
                    <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center text-gray-400">
                      <p className="text-sm">No photos in this album yet</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {(displayAlbum.photos || []).map((photo, index) => (
                        <div
                          key={index}
                          className="cursor-pointer group"
                          onClick={() => setLightbox({ photos: displayAlbum.photos, index })}
                        >
                          <div className="aspect-video overflow-hidden rounded-xl">
                            <img
                              src={photo.image}
                              alt={photo.caption || displayAlbum.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                          {photo.caption && (
                            <p className="text-xs text-gray-500 mt-1 px-0.5 truncate">{photo.caption}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            {/* Close */}
            <button
              onClick={() => setLightbox(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
              aria-label="Close"
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Prev */}
            {lightbox.index > 0 && (
              <button
                onClick={() => setLightbox(l => ({ ...l, index: l.index - 1 }))}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            <img
              src={lightbox.photos[lightbox.index].image}
              alt={lightbox.photos[lightbox.index].caption || ""}
              className="w-full rounded-xl shadow-2xl"
            />

            {/* Next */}
            {lightbox.index < lightbox.photos.length - 1 && (
              <button
                onClick={() => setLightbox(l => ({ ...l, index: l.index + 1 }))}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            {lightbox.photos[lightbox.index].caption && (
              <p className="text-white text-sm text-center mt-3 opacity-80">
                {lightbox.photos[lightbox.index].caption}
              </p>
            )}
            <p className="text-white/40 text-xs text-center mt-1">
              {lightbox.index + 1} / {lightbox.photos.length}
            </p>
          </div>
        </div>
      )}

      {/* Videos Section */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Videos</h2>
          {videos.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center text-gray-400">
              <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
              </svg>
              <p className="font-medium">No videos yet</p>
              <p className="text-sm mt-1">Add YouTube videos via the CMS under Media → Videos</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos.map((video, index) => (
                <div key={index} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="aspect-video">
                    <iframe
                      src={`https://www.youtube.com/embed/${video.youtube_id}`}
                      title={video.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 text-sm mb-1">{video.title}</h3>
                    {video.description && (
                      <p className="text-xs text-gray-500 leading-relaxed">{video.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
