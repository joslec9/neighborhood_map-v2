// initialize the view model binding
function initMap() {
  ko.applyBindings(new MapViewModel());
}

// MapMarkerSet class contains information of map markers for searching.
var MapMarkerSet = function (marker, name, category, position) {
  this.marker = marker,
  this.name = name,
  this.category = category,
  this.position = position
};

// View Model of the app.
function MapViewModel() {
  var self = this;
  var map;
  var service;
  var preferredLocation;
  var infowindow;
  var mapBounds;
  var neighborhoodMarkers = [];
  var venueMarkers = [];
  var defaultNeighborhood = "Times Square, NY";

  self.limit = 20;

  self.topPicksList = ko.observableArray([]);
  self.filteredList = ko.observableArray(self.topPicksList());
  self.neighborhood = ko.observable(defaultNeighborhood);
  self.keyword = ko.observable('');
  self.listBoolean = ko.observable(true);
  self.settingsBoolean = ko.observable(true);
  self.leftArrowBoolean = ko.observable(false);
  self.rightArrowBoolean = ko.observable(true);

  // list toggle method. open/close the list view
  self.listToggle = function() {
    if (self.listBoolean() === true) {
      self.listBoolean(false);
    } else {
      self.listBoolean(true);
    }
  };

  // setting toggle method. open/close setting menu
  self.settingsToggle = function() {
    if (self.settingsBoolean() === true) {
      self.settingsBoolean(false);
    } else {
      self.settingsBoolean(true);
    }
  };


  // initialize the map
  initializeMap();

  // update the neighborhood
  self.computedNeighborhood = ko.computed(function() {
    if (self.neighborhood() !== '') {
      if (venueMarkers.length > 0) {
        removeVenue();
      }
      removeNeighborhoodMarker();
      requestNeighborhood(self.neighborhood());
      self.keyword('');
    }
  });

  // trigger click event to markers when list item is clicked
  self.clickMarker = function(venue) {
    var venueName = venue.venue.name.toLowerCase();
    for (var i in venueMarkers) {
      if (venueMarkers[i].name === venueName) {
        google.maps.event.trigger(venueMarkers[i].marker, 'click');
        map.panTo(venueMarkers[i].position);

      }
    }
  };

  // update list view based on search keyword
  self.displayList = ko.computed(function() {
    var venue;
    var list = [];
    var keyword = self.keyword().toLowerCase();
    for (var i = 0; i < self.topPicksList().length; i++) {
      venue = self.topPicksList()[i].venue;
      if (venue.name.toLowerCase().indexOf(keyword) != -1 ||
        venue.categories[0].name.toLowerCase().indexOf(keyword) != -1) {
          list.push(self.topPicksList()[i]);
      }
    }
    self.filteredList(list);
  });

  // update map markers based on search keyword
  self.displayMarkers = ko.computed(function() {
    filteringMarkers(self.keyword().toLowerCase());
  });

  // filtering method for map markers
  function filteringMarkers(keyword) {
    for (var i in venueMarkers) {
      if (venueMarkers[i].marker.map === null) {
        venueMarkers[i].marker.setMap(map);
      }
      if (venueMarkers[i].name.indexOf(keyword) === -1 &&
        venueMarkers[i].category.indexOf(keyword) === -1) {
        venueMarkers[i].marker.setMap(null);
      }
    }
  }

  // method for initializing the map
  function initializeMap() {
    var mapOptions = {
      zoom: 14,
      disableDefaultUI: true
    };
    map = new google.maps.Map(document.querySelector('#map'), mapOptions);
    infowindow = new google.maps.InfoWindow();
  }

  // set neighborhood marker on the map and get popular places from API
  function getInformation(placeData) {
    var lat = placeData.geometry.location.lat();
    var lng = placeData.geometry.location.lng();
    var name = placeData.name;
    preferredLocation = new google.maps.LatLng(lat, lng);
    map.setCenter(preferredLocation);

    // neighborhood marker
    var marker = new google.maps.Marker({
      map: map,
      position: placeData.geometry.location,
      title: name,
      animation: google.maps.Animation.DROP,
      icon: "images/squareicon.png"
    });
    neighborhoodMarkers.push(marker);

    google.maps.event.addListener(marker, 'click', function() {
         infowindow.setContent(name);
      infowindow.open(map, marker);
      if (marker.getAnimation() !== null) {
      marker.setAnimation(null);
      } else {
      marker.setAnimation(google.maps.Animation.BOUNCE);
      }
    });

    // request popular places based on preferred location
    foursquareBaseUri = "https://api.foursquare.com/v2/venues/explore?ll=";
    baseLocation = lat + ", " + lng;
    extraParams = "&limit=10&section=topPicks&day=any&time=any&locale=en&oauth_token=NWXW5QDQCTLR1AFR2X0CAZTDJQMYPI0OB1E4HELS2W2MDMNB&v=20150905";
    foursquareQueryUri = foursquareBaseUri + baseLocation + extraParams;
    $.getJSON(foursquareQueryUri, function(data) {
      self.topPicksList(data.response.groups[0].items);
      for (var i in self.topPicksList()) {
        createMarkers(self.topPicksList()[i].venue);
      }

      // change the map zoom level by suggested bounds
      var bounds = data.response.suggestedBounds;
      if (bounds != undefined) {
        mapBounds = new google.maps.LatLngBounds(
          new google.maps.LatLng(bounds.sw.lat, bounds.sw.lng),
          new google.maps.LatLng(bounds.ne.lat, bounds.ne.lng));
        map.fitBounds(mapBounds);
      }
})
    .fail(function() {
  alert("We couldn't find any locations near " + name + ".  Please try a different location.");
});
  }
  // callback method for neighborhood location
  function neighborhoodCallback(results, status) {
    if (status == google.maps.places.PlacesServiceStatus.OK) {
      getInformation(results[0]);
    }
  }

  // request neighborhood location data from PlaceService
  function requestNeighborhood(neighborhood) {
    var request = {
      query: neighborhood
    };
    service = new google.maps.places.PlacesService(map);
    service.textSearch(request, neighborhoodCallback);
  }

  // remove neighborhood marker from the map
  // this method is called when neighborhood is newly defined
  function removeNeighborhoodMarker() {
    for (var i in neighborhoodMarkers) {
      neighborhoodMarkers[i].setMap(null);
      neighborhoodMarkers[i] = null;
    }
    while (neighborhoodMarkers.length > 0) {
      neighborhoodMarkers.pop();
    }
  }

  // create map markers of popular places
  function createMarkers(venue) {
    var lat = venue.location.lat;
    var lng = venue.location.lng;
    var name = venue.name;
    var category = venue.categories[0].name;
    var position = new google.maps.LatLng(lat, lng);
    var address = venue.location.formattedAddress;
    var contact = venue.contact.formattedPhone;
    var foursquareUrl = "https://foursquare.com/v/" + venue.id;
    var rating = venue.rating;
    var url = venue.url;
    var slicedUrl;
    if (url && url.slice(0, 7) === 'http://') {
      slicedUrl = url.slice(7);
    } else if (url && url.slice(0, 8) === 'https://') {
      slicedUrl = url.slice(8);
    } else {
      slicedUrl = url;
    }
    var ratingImg;
    var halfRating = rating / 2;
    if (halfRating >= 4.9) {
      ratingImg = 'images/star-5.0.png';
    } else if (halfRating < 4.9 && halfRating >= 4.25) {
      ratingImg = 'images/star-4.5.png';
    } else if (halfRating < 4.25 && halfRating >= 3.75) {
      ratingImg = 'images/star-4.0.png';
    } else if (halfRating < 3.75 && halfRating >= 3.25) {
      ratingImg = 'images/star-3.5.png';
    } else if (halfRating < 3.25 && halfRating >= 2.75) {
      ratingImg = 'images/star-3.0.png';
    } else {
      ratingImg = 'images/star-2.5.png';
    }

    // marker of a popular place
    var marker = new google.maps.Marker({
      map: map,
      position: position,
      animation: google.maps.Animation.DROP,
      title: name
    });
      
    venueMarkers.push(new MapMarkerSet(marker, name.toLowerCase(), category.toLowerCase(), position));
    marker.addListener('click', toggleBounce);
      function toggleBounce() {
    marker.setAnimation(google.maps.Animation.BOUNCE);
    window.setTimeout(function() {
      marker.setAnimation(null);
    }, 2100);
}
    // DOM element for infowindow content
    var startingToken = '<div class="infowindow"><p><span class="v-name">' + name +
      '</span></p><p class="v-category"><span>' + category +
      '</span></p><p class="v-address"><span>' + address;

    var endingToken;
    if (contact != undefined && url != undefined) {
      endingToken = '</span></p><p><span class="v-contact">' + contact +
        '</span></p><p><a href="' + url + '" class="v-link" target="_blank">' + slicedUrl + '</a></p>';
    } else if (contact != undefined && url === undefined) {
      endingToken = '</span></p><p><span class="v-contact">' + contact + '</span></p>';
    } else if (contact === undefined && url != undefined) {
      endingToken = '</span></p><p><a href="' + url + '" class="v-link" target="_blank">' + slicedUrl + '</a></p>';
    } else {
      endingToken = '</span></p>';
    }

    var fsToken;
    if (rating != undefined) {
      fsToken = '<p><a href="' + foursquareUrl + '" target="_blank"><img class="fs-icon" src="images/Foursquare-icon.png"></a>' +
        '<span class="v-rating">' + rating.toFixed(1) + '</span><img src="' + ratingImg + '" class="rating-stars"></p></div>';
    } else {
      fsToken = '<p><a href="' + foursquareUrl + '" target="_blank"><img class="fs-icon" src="images/Foursquare-icon.png"></a>' +
        '<span class="v-rating"><em>no rating available</em></span></p></div>';
    }

    google.maps.event.addListener(marker, 'click', function() {
      infowindow.setContent(startingToken + endingToken + fsToken);
      infowindow.open(map, this);
      map.panTo(position);
    });
  }

  // remove markers of popular places from the map
  // this method is called when neighborhood is newly defined
  function removeVenue() {
    for (var i in venueMarkers) {
      venueMarkers[i].marker.setMap(null);
      venueMarkers[i].marker = null;
    }
    while (venueMarkers.length > 0) {
      venueMarkers.pop();
    }
  }

  // function for swipeable list on mobile screen
  // referenced from http://css-tricks.com/the-javascript-behind-touch-friendly-sliders
  function mobileSlider(filteredList, keyword) {
    var holderElem = document.getElementsByClassName('holder')[0];
    var sliderElem = document.getElementsByClassName('slider')[0];
    var slideElems = document.getElementsByClassName('slide');
    var listWidth = window.innerWidth - 20;
    var filteredListLength = filteredList.length;
    var clickEvent = new Event('click');

    holderElem.style.width = (filteredListLength * 100) + '%';
    sliderElem.style.width = listWidth + 'px';
    $('.slide').width(listWidth);

    if (navigator.msMaxTouchPoints) {
      sliderElem.classList.add('ms-touch');
    } else {
      var slider = {
        el: {
          slider: sliderElem,
          holder: holderElem
        },
        slideWidth: listWidth,
        touchstartx: undefined,
        touchmovex: undefined,
        movex: undefined,
        index: 0,

        // initiate UI event binding
        init: function() {
          this.bindUIEvents();
        },

        // reset position
        reset: function() {
          this.el.holder.style.transform = 'translate3d(-' + this.index * this.slideWidth + 'px,0,0)';
          this.movex = 0;
          this.index = 0;
          if (filteredListLength > 0) {
            slideElems[0].dispatchEvent(clickEvent);
          }
        },

        // binds touch events to the element
        bindUIEvents: function() {
          this.el.holder.addEventListener('touchstart', function(event) {
            slider.start(event);
          });
          this.el.holder.addEventListener("touchmove", function(event) {
            slider.move(event);
          });
          this.el.holder.addEventListener("touchend", function(event) {
            slider.end(event);
          });
        },

        start: function(event) {
          // Get the original touch position.
          this.touchstartx = event.touches[0].pageX;
          // The movement gets all janky if there's a transition on the elements.
          $('.animate').removeClass('animate');
        },

        move: function(event) {
          // Continuously return touch position.
          this.touchmovex = event.touches[0].pageX;
          // Calculate distance to translate holder.
          this.movex = this.index * this.slideWidth + (this.touchstartx - this.touchmovex);
          // Makes the holder stop moving when there is no more content.
          if (this.movex < this.slideWidth*(filteredListLength-1)) {
            this.el.holder.style.transform = 'translate3d(-' + this.movex + 'px,0,0)';
          }
        },

        end: function(event) {
          // Calculate the distance swiped.
          var absMove = Math.abs(this.index * this.slideWidth - this.movex);
          // Calculate the index. All other calculations are based on the index.
          if (absMove > this.slideWidth / 2) {
            if (this.movex > this.index * this.slideWidth && this.index < filteredListLength-1) {
              this.index++;
            } else if (this.movex < this.index * this.slideWidth && this.index > 0) {
              this.index--;
            }
          }
          // trigger click event to the focused list item
          slideElems[this.index].dispatchEvent(clickEvent);

          // toggle arrow booleans appropriately
          if (this.index === 0 || filteredListLength === 0) {
            self.leftArrowBoolean(false);
          } else {
            self.leftArrowBoolean(true);
          }
          if (this.index === filteredListLength-1 || filteredListLength < 2) {
            self.rightArrowBoolean(false);
          } else {
            self.rightArrowBoolean(true);
          }
          // Move and animate the elements.
          this.el.holder.classList.add('animate');
          this.el.holder.style.transform = 'translate3d(-' + this.index * this.slideWidth + 'px,0,0)';
        }
      };

      slider.init();

      // reset the slider when keyword is changed
      if (keyword != '' || slideElems.length > 0) {
        slider.reset();
        self.leftArrowBoolean(false);
      }
      // toggle right arrow boolean
      if (filteredListLength < 2) {
        self.rightArrowBoolean(false);
      } else {
        self.rightArrowBoolean(true);
      }
    }
  }

  // Computed binding for horizontally swipeable list
  self.mobileList = ko.computed(function() {
    if (window.innerWidth < 900) {
      mobileSlider(self.filteredList(), self.keyword());
    }
  });
}

// initialize the view model binding
$(function() {
  ko.applyBindings(new MapViewModel());
});
