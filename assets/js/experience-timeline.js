(function () {
  'use strict';

  var timeline = document.querySelector('[data-experience-timeline]');
  if (!timeline) {
    return;
  }

  var entries = Array.from(timeline.querySelectorAll('[data-experience-entry]'));
  var progress = timeline.querySelector('.experience-timeline__progress');
  var cursor = timeline.querySelector('.experience-timeline__cursor');
  var motionPreference = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
  var reducedMotion = motionPreference && motionPreference.matches;
  var targetProgress = 0;
  var currentProgress = 0;
  var progressFrame = null;
  var timelineInset = parseFloat(window.getComputedStyle(document.documentElement).fontSize) * 0.5;

  if (!entries.length || !progress) {
    return;
  }

  function applyProgress(value) {
    progress.style.setProperty('--experience-progress', value);
    if (cursor) {
      var travel = Math.max(0, timeline.clientHeight - timelineInset * 2);
      cursor.style.setProperty('--experience-progress-position', (timelineInset + value * travel) + 'px');
    }
  }

  function updateProgress() {
    var bounds = timeline.getBoundingClientRect();
    var start = window.innerHeight * 0.7;
    var end = -bounds.height + window.innerHeight * 0.55;
    var ratio = (start - bounds.top) / (start - end);
    targetProgress = Math.max(0, Math.min(1, ratio));

    if (reducedMotion) {
      currentProgress = targetProgress;
      applyProgress(currentProgress);
      return;
    }

    if (progressFrame === null) {
      progressFrame = window.requestAnimationFrame(animateProgress);
    }
  }

  function animateProgress() {
    currentProgress += (targetProgress - currentProgress) * 0.16;
    if (Math.abs(targetProgress - currentProgress) < 0.001) {
      currentProgress = targetProgress;
      progressFrame = null;
    } else {
      progressFrame = window.requestAnimationFrame(animateProgress);
    }
    applyProgress(currentProgress);
  }

  var framePending = false;
  function requestProgressUpdate() {
    if (!framePending) {
      framePending = true;
      window.requestAnimationFrame(function () {
        framePending = false;
        updateProgress();
      });
    }
  }

  window.addEventListener('scroll', requestProgressUpdate, { passive: true });
  window.addEventListener('resize', requestProgressUpdate);
  updateProgress();

  if (reducedMotion) {
    entries.forEach(function (entry) {
      entry.classList.add('is-visible');
    });
    return;
  }

  if (!('IntersectionObserver' in window)) {
    entries.forEach(function (entry) {
      entry.classList.add('is-visible');
    });
    return;
  }

  timeline.classList.add('experience-enhanced');

  var observer = new IntersectionObserver(function (changes) {
    changes.forEach(function (change) {
      if (change.isIntersecting) {
        change.target.classList.add('is-visible');
        observer.unobserve(change.target);
      }
    });
  }, {
    rootMargin: '0px 0px -38% 0px',
    threshold: 0.05
  });

  entries.forEach(function (entry) {
    observer.observe(entry);
  });
}());
