(function () {
  'use strict';

  var projects = document.getElementById('projects');
  var track = projects && projects.querySelector('.project-reel__track');
  var cards = track ? Array.from(track.querySelectorAll('[data-project-reveal]')) : [];
  if (!window.matchMedia) {
    return;
  }

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var desktopReel = window.matchMedia('(min-width: 1024px) and (min-height: 680px)');
  var supportsReelMask = window.CSS && window.CSS.supports
    && window.CSS.supports('clip-path', 'circle(145% at 14% 32%)');

  if (!projects || !track || cards.length < 2 || !desktopReel.matches || reducedMotion.matches || !supportsReelMask) {
    return;
  }

  var originalClasses = cards.map(function (card) {
    return card.className;
  });
  var stage = document.createElement('div');
  stage.className = 'project-reel__stage';
  stage.setAttribute('role', 'region');
  stage.setAttribute('aria-label', 'Featured project releases');
  track.removeAttribute('role');
  track.setAttribute('aria-label', 'Featured project reel');
  track.appendChild(stage);

  function getInitials(value) {
    var words = value
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .match(/[A-Za-z0-9]+/g) || [];
    return words.slice(0, 2).map(function (word) {
      return word.charAt(0);
    }).join('').toUpperCase() || 'P';
  }

  function createMark(name, className) {
    var mark = document.createElement('span');
    mark.className = className;
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = getInitials(name);
    return mark;
  }

  cards.forEach(function (card, index) {
    var title = card.querySelector('h2');
    var name = title ? title.textContent.trim() : 'Project ' + (index + 1);
    var category = card.querySelector('h4');
    var image = card.querySelector('.project-img');
    var imageColumn = image && image.parentElement;
    card.id = 'featured-project-' + (index + 1);
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', name + ', project ' + (index + 1) + ' of ' + cards.length);
    card.setAttribute('aria-roledescription', 'project');
    card.style.setProperty('--reel-index', index);
    card.classList.remove(
      'row',
      'd-block',
      'd-md-flex',
      'my-5',
      'py-2',
      'py-md-4',
      'align-items-center',
      'justify-content-center'
    );
    if (title) {
      title.before(createMark(name, 'project-release-mark'));
    }
    stage.appendChild(card);

    if (image && imageColumn) {
      var frame = document.createElement('figure');
      var chrome = document.createElement('div');
      var lights = document.createElement('span');
      var address = document.createElement('span');
      var status = document.createElement('span');
      var caption = document.createElement('figcaption');
      var captionMark = createMark(name, 'project-release-mark');
      var captionCopy = document.createElement('span');
      var captionKicker = document.createElement('span');
      var captionTitle = document.createElement('strong');
      var visitLink = card.querySelector('.project-button');

      frame.className = 'project-preview-frame';
      chrome.className = 'project-preview-frame__chrome';
      chrome.setAttribute('aria-hidden', 'true');
      lights.className = 'project-preview-frame__lights';
      for (var lightIndex = 0; lightIndex < 3; lightIndex += 1) {
        lights.appendChild(document.createElement('span'));
      }
      address.className = 'project-preview-frame__address';
      address.textContent = visitLink ? new URL(visitLink.href).hostname : name;
      status.className = 'project-preview-frame__status';
      status.textContent = 'Live';
      chrome.appendChild(lights);
      chrome.appendChild(address);
      chrome.appendChild(status);
      caption.className = 'project-preview-frame__caption';
      captionCopy.className = 'project-preview-frame__caption-copy';
      captionKicker.textContent = 'Live project';
      captionTitle.textContent = category ? category.textContent.trim() : name;
      captionCopy.appendChild(captionKicker);
      captionCopy.appendChild(captionTitle);
      caption.appendChild(captionMark);
      caption.appendChild(captionCopy);
      frame.appendChild(chrome);
      imageColumn.insertBefore(frame, image);
      frame.appendChild(image);
      frame.appendChild(caption);
    }
  });

  var nav = document.createElement('nav');
  nav.className = 'project-reel__nav';
  nav.setAttribute('aria-label', 'Featured project chapters');

  var current = document.createElement('span');
  current.className = 'project-reel__current';
  current.setAttribute('aria-live', 'polite');
  current.setAttribute('aria-atomic', 'true');
  nav.appendChild(current);

  var divider = document.createElement('span');
  divider.className = 'project-reel__nav-divider';
  divider.setAttribute('aria-hidden', 'true');
  nav.appendChild(divider);

  var links = cards.map(function (card, index) {
    var link = document.createElement('a');
    var title = card.querySelector('h2');
    var name = title ? title.textContent.trim() : 'Project ' + (index + 1);
    link.href = '#' + card.id;
    link.setAttribute('aria-label', 'Go to ' + name);
    link.setAttribute('aria-controls', card.id);
    link.setAttribute('title', name);
    var mark = createMark(name, 'project-reel__nav-mark');
    mark.removeAttribute('aria-hidden');
    link.appendChild(mark);
    var label = document.createElement('span');
    label.className = 'project-reel__nav-label';
    label.textContent = name;
    link.appendChild(label);
    link.addEventListener('click', function (event) {
      event.preventDefault();
      var target = track.getBoundingClientRect().top + window.scrollY + index * window.innerHeight;
      window.scrollTo({
        top: target,
        behavior: reducedMotion.matches ? 'auto' : 'smooth'
      });
    });
    nav.appendChild(link);
    return link;
  });

  var endDivider = document.createElement('span');
  endDivider.className = 'project-reel__nav-divider';
  endDivider.setAttribute('aria-hidden', 'true');
  nav.appendChild(endDivider);

  var total = document.createElement('span');
  total.className = 'project-reel__total';
  total.textContent = String(cards.length).padStart(2, '0');
  nav.appendChild(total);

  stage.appendChild(nav);
  track.style.setProperty('--project-count', cards.length);
  projects.classList.add('project-reel-ready');

  function sizeReel() {
    track.style.height = ((cards.length + 1) * window.innerHeight) + 'px';
  }

  function updateRevealOrigins() {
    if (!stage.clientWidth || !stage.clientHeight) {
      return;
    }

    cards.forEach(function (card) {
      var mark = card.querySelector('.project-release-mark');
      if (!mark) {
        return;
      }
      var cardBounds = card.getBoundingClientRect();
      var bounds = mark.getBoundingClientRect();
      var x = ((bounds.left + bounds.width / 2 - cardBounds.left) / cardBounds.width) * 100;
      var y = ((bounds.top + bounds.height / 2 - cardBounds.top) / cardBounds.height) * 100;
      card.style.setProperty('--reel-origin-x', Math.max(5, Math.min(95, x)) + '%');
      card.style.setProperty('--reel-origin-y', Math.max(5, Math.min(95, y)) + '%');
    });
  }

  var frameRequested = false;
  function updateReel() {
    frameRequested = false;
    if (!projects.classList.contains('project-reel-ready')) {
      return;
    }

    var trackTop = track.getBoundingClientRect().top + window.scrollY;
    var progress = Math.max(0, Math.min(cards.length - 1, (window.scrollY - trackTop) / window.innerHeight));
    var activeIndex = Math.min(cards.length - 1, Math.floor(progress + 0.5));

    cards.forEach(function (card, index) {
      var reveal = index === 0 ? 1 : Math.max(0, Math.min(1, progress - index + 1));
      card.style.setProperty('--reel-clip', (reveal * 145) + '%');
      card.setAttribute('aria-hidden', index === activeIndex ? 'false' : 'true');
      if ('inert' in card) {
        card.inert = index !== activeIndex;
      } else {
        card.querySelectorAll('a, button, input, select, textarea, [tabindex]').forEach(function (control) {
          if (index === activeIndex) {
            control.removeAttribute('tabindex');
          } else {
            control.setAttribute('tabindex', '-1');
          }
        });
      }
    });

    links.forEach(function (link, index) {
      if (index === activeIndex) {
        link.setAttribute('aria-current', 'step');
      } else {
        link.removeAttribute('aria-current');
      }
    });

    current.textContent = String(activeIndex + 1).padStart(2, '0');
  }

  var requestFrame = function () {
    if (!frameRequested) {
      frameRequested = true;
      window.requestAnimationFrame(updateReel);
    }
  };

  var handleResize = function () {
    if (!desktopReel.matches || reducedMotion.matches) {
      restoreStaticPortfolio();
      return;
    }

    if (projects.classList.contains('project-reel-ready')) {
      sizeReel();
      updateRevealOrigins();
      requestFrame();
    }
  };
  var handleFontsLoaded = function () {
    updateRevealOrigins();
  };

  window.addEventListener('scroll', requestFrame, { passive: true });
  window.addEventListener('resize', handleResize);
  if (document.fonts && document.fonts.addEventListener) {
    document.fonts.addEventListener('loadingdone', handleFontsLoaded);
  }

  function restoreStaticPortfolio() {
    if (!projects.classList.contains('project-reel-ready')) {
      return;
    }

    window.removeEventListener('scroll', requestFrame);
    window.removeEventListener('resize', handleResize);
    if (document.fonts && document.fonts.removeEventListener) {
      document.fonts.removeEventListener('loadingdone', handleFontsLoaded);
    }
    nav.remove();
    cards.forEach(function (card, index) {
      card.removeAttribute('id');
      card.removeAttribute('aria-label');
      card.removeAttribute('aria-roledescription');
      card.removeAttribute('aria-hidden');
      card.setAttribute('role', 'listitem');
      card.className = originalClasses[index];
      card.style.removeProperty('--reel-index');
      card.style.removeProperty('--reel-clip');
      card.style.removeProperty('--reel-origin-x');
      card.style.removeProperty('--reel-origin-y');
      var mark = card.querySelector('.project-release-mark');
      if (mark) {
        mark.remove();
      }
      if ('inert' in card) {
        card.inert = false;
      }
      var frame = card.querySelector('.project-preview-frame');
      if (frame) {
        frame.parentElement.insertBefore(frame.querySelector('.project-img'), frame);
        frame.remove();
      }
      card.querySelectorAll('[tabindex="-1"]').forEach(function (control) {
        control.removeAttribute('tabindex');
      });
      track.appendChild(card);
    });
    stage.remove();
    track.setAttribute('role', 'list');
    track.setAttribute('aria-label', 'Featured projects');
    track.style.removeProperty('--project-count');
    track.style.removeProperty('height');
    projects.classList.remove('project-reel-ready');
  }

  function handleModeChange() {
    if (!desktopReel.matches || reducedMotion.matches) {
      restoreStaticPortfolio();
    }
  }

  [desktopReel, reducedMotion].forEach(function (query) {
    if (query.addEventListener) {
      query.addEventListener('change', handleModeChange);
    } else if (query.addListener) {
      query.addListener(handleModeChange);
    }
  });

  sizeReel();
  updateRevealOrigins();
  updateReel();
  window.requestAnimationFrame(updateRevealOrigins);
}());
