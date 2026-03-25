/*
  CONTENT GUIDE — Media Page
  ===========================
  PHOTO GALLERY:
  - Replace the placeholder tiles in `galleryPhotos` below with real image paths.
  - Each item has an `src` (file path or URL) and `caption` (short description).
  - Example: { id: 1, src: "/images/gallery/training-april-2026.jpg", caption: "April training camp" }
  - Recommended image size: 800×600px or similar landscape aspect ratio.

  VIDEOS SECTION:
  - Replace the `youtubeId` values in `videos` below with real YouTube video IDs.
  - The video ID is the part after "v=" in a YouTube URL.
  - Example: https://www.youtube.com/watch?v=dQw4w9WgXcQ → youtubeId: "dQw4w9WgXcQ"
*/

// TODO: Replace with real gallery photos
const galleryPhotos = [
  { id: 1, src: null, caption: "Training session — April 2026" },
  { id: 2, src: null, caption: "M45 squad at Asia Pacific Championship" },
  { id: 3, src: null, caption: "Women's team warm-up" },
  { id: 4, src: null, caption: "Annual Club Dinner 2025" },
  { id: 5, src: null, caption: "M35 squad pre-match" },
  { id: 6, src: null, caption: "Rotterdam departure — Team HK" },
  { id: 7, src: null, caption: "Post-match celebrations" },
  { id: 8, src: null, caption: "HK Club Championship final" },
  { id: 9, src: null, caption: "M55 squad debut match" },
];

// TODO: Replace with real YouTube video IDs
const videos = [
  {
    id: 1,
    title: "HK Masters Highlights — Asia Pacific Championship 2025",
    youtubeId: null, // TODO: Replace null with real YouTube video ID, e.g., "dQw4w9WgXcQ"
    description: "Match highlights from our successful Asia Pacific Championship campaign.",
  },
  {
    id: 2,
    title: "Club Promotional Video 2025",
    youtubeId: null, // TODO: Replace with real YouTube video ID
    description: "Learn about Hong Kong Masters Hockey and what makes our club special.",
  },
  {
    id: 3,
    title: "Rotterdam 2026 — Road to Rotterdam",
    youtubeId: null, // TODO: Replace with real YouTube video ID
    description: "Behind-the-scenes footage from our Rotterdam 2026 preparation campaign.",
  },
];

function PhotoPlaceholder({ caption }) {
  return (
    /* Placeholder tile — TODO: Replace with <img src={src} alt={caption} className="..." /> */
    <div className="aspect-video bg-[#006B3C]/8 border border-dashed border-[#006B3C]/20 rounded-xl flex flex-col items-center justify-center text-center p-4">
      <svg className="w-8 h-8 text-[#006B3C]/30 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <p className="text-xs text-gray-400">{caption}</p>
      {/* TODO: When adding real images, replace this placeholder div with:
          <img src="/images/gallery/YOUR_IMAGE.jpg" alt={caption} className="w-full h-full object-cover rounded-xl" />
      */}
    </div>
  );
}

function VideoPlaceholder({ video }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {video.youtubeId ? (
        /* Real YouTube embed — only rendered when youtubeId is set */
        <div className="aspect-video">
          <iframe
            src={`https://www.youtube.com/embed/${video.youtubeId}`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      ) : (
        /* Placeholder — TODO: Add the youtubeId in the videos array above */
        <div className="aspect-video bg-gray-900 flex flex-col items-center justify-center text-white gap-2">
          <svg className="w-12 h-12 text-white/30" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
          </svg>
          <p className="text-xs text-white/40">Video coming soon</p>
          {/* TODO: Add YouTube video ID to the videos array above to embed real videos */}
        </div>
      )}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 text-sm mb-1">{video.title}</h3>
        <p className="text-xs text-gray-500 leading-relaxed">{video.description}</p>
      </div>
    </div>
  );
}

export default function Media() {
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

      {/* Photo Gallery */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Photo Gallery</h2>
        {/*
          TODO: Replace placeholder tiles with real images.
          See the CONTENT GUIDE comment at the top of this file for instructions.
        */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {galleryPhotos.map((photo) => (
            <div key={photo.id}>
              {photo.src ? (
                <img
                  src={photo.src}
                  alt={photo.caption}
                  className="w-full aspect-video object-cover rounded-xl"
                />
              ) : (
                <PhotoPlaceholder caption={photo.caption} />
              )}
              <p className="text-xs text-gray-500 mt-1.5 px-1">{photo.caption}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Videos Section */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Videos</h2>
          {/*
            TODO: Replace placeholder video boxes with real YouTube embed IDs.
            See the CONTENT GUIDE comment at the top of this file for instructions.
          */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {videos.map((video) => (
              <VideoPlaceholder key={video.id} video={video} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
