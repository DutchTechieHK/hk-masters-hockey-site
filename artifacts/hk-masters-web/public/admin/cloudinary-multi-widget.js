(function () {
  var CLOUD_NAME = 'djyvdrhal';
  var API_KEY = '467487618148569';

  function getPhotos(value) {
    if (!value) return [];
    if (typeof value.toJS === 'function') return value.toJS();
    if (Array.isArray(value)) return value;
    return [];
  }

  function thumbUrl(url) {
    if (url && url.includes('cloudinary.com')) {
      return url.replace('/upload/', '/upload/w_150,h_100,c_fill,q_auto,f_auto/');
    }
    return url;
  }

  var Control = createClass({
    handleSelect: function () {
      var self = this;
      var ml = cloudinary.createMediaLibrary(
        {
          cloud_name: CLOUD_NAME,
          api_key: API_KEY,
          multiple: true,
          insert_caption: 'Add to Album',
        },
        {
          insertHandler: function (data) {
            var current = getPhotos(self.props.value);
            var newUrls = (data.assets || []).map(function (a) {
              return a.secure_url;
            });
            self.props.onChange(current.concat(newUrls));
          },
        }
      );
      ml.show();
    },

    handleRemove: function (index) {
      var photos = getPhotos(this.props.value);
      this.props.onChange(photos.filter(function (_, i) { return i !== index; }));
    },

    render: function () {
      var photos = getPhotos(this.props.value);
      var self = this;

      return h('div', { style: { fontFamily: 'sans-serif' } },
        photos.length > 0
          ? h('div', {
              style: {
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '6px',
                marginBottom: '10px',
              },
            },
            photos.map(function (url, index) {
              return h('div', { key: index, style: { position: 'relative' } },
                h('img', {
                  src: thumbUrl(url),
                  style: {
                    width: '100%',
                    height: '70px',
                    objectFit: 'cover',
                    borderRadius: '4px',
                    display: 'block',
                  },
                }),
                h('button', {
                  type: 'button',
                  onClick: function () { self.handleRemove(index); },
                  title: 'Remove photo',
                  style: {
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    background: 'rgba(0,0,0,0.65)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    lineHeight: '18px',
                    padding: '0',
                    textAlign: 'center',
                  },
                }, '\u00d7')
              );
            })
          )
          : h('p', {
              style: { color: '#999', fontSize: '13px', marginBottom: '10px' },
            }, 'No photos added yet.'),

        h('button', {
          type: 'button',
          onClick: this.handleSelect,
          style: {
            background: '#006B3C',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            padding: '8px 18px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600',
          },
        },
        photos.length > 0
          ? 'Add More Photos from Cloudinary (' + photos.length + ' so far)'
          : 'Select Photos from Cloudinary')
      );
    },
  });

  var Preview = createClass({
    render: function () {
      var photos = getPhotos(this.props.value);
      return h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px' } },
        photos.map(function (url, i) {
          return h('img', {
            key: i,
            src: url,
            style: {
              width: '50px',
              height: '35px',
              objectFit: 'cover',
              borderRadius: '2px',
            },
          });
        })
      );
    },
  });

  CMS.registerWidget('cloudinary-multi-image', Control, Preview);
})();
