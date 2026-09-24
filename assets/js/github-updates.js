(function () {
  'use strict';

  var update = document.getElementById('github-update');
  var updateText = document.getElementById('github-update-text');
  var endpoint = 'https://api.github.com/users/gpaul988/events/public?per_page=100';
  var storageKey = 'gpaul988-latest-public-push';

  if (!update || !updateText) {
    return;
  }

  function relativeTime(date) {
    var seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    var units = [
      ['year', 31536000],
      ['month', 2592000],
      ['day', 86400],
      ['hour', 3600],
      ['minute', 60]
    ];

    for (var i = 0; i < units.length; i += 1) {
      if (seconds >= units[i][1]) {
        var value = Math.floor(seconds / units[i][1]);
        return value + ' ' + units[i][0] + (value === 1 ? '' : 's') + ' ago';
      }
    }

    return 'just now';
  }

  function showUpdate(push, isNew) {
    var commit = push.payload.commits && push.payload.commits[push.payload.commits.length - 1];
    var message = commit && commit.message ? commit.message.split('\n')[0] : 'New repository update';
    var shortMessage = message.length > 86 ? message.slice(0, 83) + '...' : message;
    var committedAt = new Date(push.created_at);
    var link = document.createElement('a');

    link.href = 'https://github.com/' + push.repo.name + '/commit/' + push.payload.head;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = push.repo.name.split('/')[1] + ': ' + shortMessage;
    updateText.textContent = isNew ? 'New GitHub push: ' : 'Latest GitHub update: ';
    updateText.appendChild(link);
    updateText.insertAdjacentText('beforeend', ' · ' + relativeTime(committedAt));
    update.classList.toggle('is-new', isNew);
    update.classList.remove('is-error');
  }

  function showError() {
    updateText.textContent = 'GitHub updates are temporarily unavailable.';
    update.classList.remove('is-new');
    update.classList.add('is-error');
  }

  function getPreviousSha() {
    try {
      return window.localStorage.getItem(storageKey);
    } catch (error) {
      console.warn('GitHub update history is unavailable:', error);
      return null;
    }
  }

  function saveSha(sha) {
    try {
      window.localStorage.setItem(storageKey, sha);
    } catch (error) {
      console.warn('GitHub update history could not be saved:', error);
    }
  }

  function loadLatestCommit() {
    fetch(endpoint, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store'
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('GitHub API request failed with status ' + response.status);
        }
        return response.json();
      })
      .then(function (commits) {
        if (!Array.isArray(commits)) {
          throw new Error('GitHub API returned an invalid events response');
        }

        var latestPush = commits.find(function (event) {
          return event.type === 'PushEvent' &&
            event.repo &&
            event.payload &&
            event.payload.head;
        });

        if (!latestPush) {
          throw new Error('No recent public GitHub pushes found');
        }

        var pushId = latestPush.id;
        var previousPushId = getPreviousSha();
        var isNew = Boolean(previousPushId && previousPushId !== pushId);
        saveSha(pushId);
        showUpdate(latestPush, isNew);
      })
      .catch(function (error) {
        console.error('GitHub update check failed:', error);
        showError();
      });
  }

  loadLatestCommit();
  window.setInterval(loadLatestCommit, 300000);
}());
