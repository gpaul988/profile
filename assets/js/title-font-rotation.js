(function () {
  'use strict';

  var fonts = [
    "'Alex Brush'",
    "'Allura'",
    "'Amatic SC'",
    "'Ballet'",
    "'Bodoni Moda'",
    "'Cinzel Decorative'",
    "'Cormorant Garamond'",
    "'Great Vibes'",
    "'Italianno'",
    "'Libre Baskerville'",
    "'Parisienne'",
    "'Playfair Display'",
    "'Rouge Script'",
    "'Yeseva One'"
  ];
  var now = new Date();
  var day = now.getDay();
  var dayOfWeek = day === 0 ? 6 : day - 1;
  var halfOfDay = now.getHours() < 12 ? 0 : 1;
  var selectedFont = fonts[dayOfWeek * 2 + halfOfDay];

  if (selectedFont) {
    document.documentElement.style.setProperty('--title-font', selectedFont);
  }
}());
