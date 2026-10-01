(() => {
    const root = document.documentElement;
    const minimumDisplayTime = 5000;
    const maximumDisplayTime = 10000;
    const startedAt = performance.now();
    let minimumTimer;
    let fallbackTimer;
    let phaseTimers = [];
    let pageReady = document.readyState !== 'loading';
    let finished = false;
    const phases = [
        ['Refining the details', '02'],
        ['Bringing it all together', '03']
    ];

    const finishPreloader = () => {
        if (finished || !pageReady) {
            return;
        }

        const remainingTime = minimumDisplayTime - (performance.now() - startedAt);
        if (remainingTime > 0) {
            minimumTimer = window.setTimeout(finishPreloader, remainingTime);
            return;
        }

        finished = true;
        root.classList.remove('is-preloading');
        window.clearTimeout(minimumTimer);
        window.clearTimeout(fallbackTimer);
        phaseTimers.forEach(window.clearTimeout);
        const preloader = document.getElementById('site-preloader');
        if (!preloader) {
            return;
        }

        preloader.classList.add('is-exiting');
        window.setTimeout(() => {
            preloader.hidden = true;
            preloader.classList.remove('is-exiting');
        }, 620);
    };

    const phaseLabel = document.querySelector('.site-preloader__phase');
    const phaseCounter = document.querySelector('.site-preloader__counter > span');
    phases.forEach(([label, number], index) => {
        phaseTimers.push(window.setTimeout(() => {
            if (finished || !phaseLabel || !phaseCounter) {
                return;
            }
            phaseLabel.textContent = label;
            phaseCounter.textContent = number;
        }, (index + 1) * 1650));
    });

    document.addEventListener('DOMContentLoaded', () => {
        pageReady = true;
        finishPreloader();
    }, { once: true });
    fallbackTimer = window.setTimeout(() => {
        pageReady = true;
        finishPreloader();
    }, maximumDisplayTime);

    if (pageReady) {
        finishPreloader();
    }
})();
