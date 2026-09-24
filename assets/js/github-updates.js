(function () {
  'use strict';

  var update = document.getElementById('github-update');
  var updateText = document.getElementById('github-update-text');
  var githubEndpoint = 'https://api.github.com/users/gpaul988/events/public?per_page=100';
  var gitlabUserEndpoint = 'https://gitlab.com/api/v4/users?username=gpaul988';
  var storageKey = 'gpaul988-latest-public-repository-push';
  var pollInterval = 60000;
  var requestInFlight = false;
  var lastCheck = 0;

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
    var message = push.message || 'New repository update';
    var shortMessage = message.length > 86 ? message.slice(0, 83) + '...' : message;
    var committedAt = new Date(push.date);
    var link = document.createElement('a');

    link.href = push.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = push.repository + ': ' + shortMessage;
    updateText.textContent = isNew ? 'New ' + push.platform + ' push: ' : 'Latest ' + push.platform + ' update: ';
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

  function githubPush(response) {
    return response.json().then(function (events) {
      if (!Array.isArray(events)) {
        throw new Error('GitHub API returned an invalid events response');
      }

      var event = events.find(function (item) {
        return item.type === 'PushEvent' &&
          item.repo &&
          item.payload &&
          item.payload.head;
      });

      if (!event) {
        throw new Error('No recent public GitHub pushes found');
      }

      var commit = event.payload.commits && event.payload.commits[event.payload.commits.length - 1];
      return {
        id: 'github-' + event.id,
        platform: 'GitHub',
        repository: event.repo.name.split('/')[1],
        message: commit && commit.message ? commit.message.split('\n')[0] : 'New repository update',
        date: event.created_at,
        url: 'https://github.com/' + event.repo.name + '/commit/' + event.payload.head
      };
    });
  }

  function gitlabPush(response) {
    return response.json().then(function (users) {
      if (!Array.isArray(users) || !users[0] || !users[0].id) {
        throw new Error('GitLab user was not found');
      }

      return fetch('https://gitlab.com/api/v4/users/' + users[0].id + '/events?per_page=100', {
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('GitLab events request failed with status ' + response.status);
      }
      return response.json();
    }).then(function (events) {
      if (!Array.isArray(events)) {
        throw new Error('GitLab API returned an invalid events response');
      }

      var event = events.find(function (item) {
        return item.action_name === 'pushed' &&
          item.push_data &&
          item.push_data.commit_to &&
          item.project;
      });

      if (!event) {
        throw new Error('No recent public GitLab pushes found');
      }

      return {
        id: 'gitlab-' + event.id,
        platform: 'GitLab',
        repository: event.project.path_with_namespace,
        message: event.push_data.commit_title || 'New repository update',
        date: event.created_at,
        url: 'https://gitlab.com/' + event.project.path_with_namespace + '/-/commit/' + event.push_data.commit_to
      };
    });
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
    var now = Date.now();
    if (requestInFlight || now - lastCheck < 15000) {
      return;
    }

    requestInFlight = true;
    lastCheck = now;

    var githubRequest = fetch(githubEndpoint, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store'
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('GitHub API request failed with status ' + response.status);
      }
      return githubPush(response);
    });

    var gitlabRequest = fetch(gitlabUserEndpoint, {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('GitLab user request failed with status ' + response.status);
      }
      return gitlabPush(response);
    });

    Promise.allSettled([githubRequest, gitlabRequest]).then(function (results) {
      var pushes = results
        .filter(function (result) { return result.status === 'fulfilled'; })
        .map(function (result) { return result.value; })
        .sort(function (first, second) {
          return new Date(second.date) - new Date(first.date);
        });

      if (!pushes.length) {
        throw new Error('No recent public GitHub or GitLab pushes found');
      }

      var latestPush = pushes[0];
      var previousPushId = getPreviousSha();
      var isNew = Boolean(previousPushId && previousPushId !== latestPush.id);
      saveSha(latestPush.id);
      showUpdate(latestPush, isNew);
    }).catch(function (error) {
      console.error('GitHub and GitLab update check failed:', error);
      showError();
    }).finally(function () {
      requestInFlight = false;
    });
  }

  loadLatestCommit();
  window.setInterval(loadLatestCommit, pollInterval);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
      loadLatestCommit();
    }
  });
  window.addEventListener('focus', loadLatestCommit);
}());
