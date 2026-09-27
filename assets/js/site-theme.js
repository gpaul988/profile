const themeToggle = document.getElementById('contact-theme-toggle')
    || document.getElementById('home-theme-toggle');
const themePage = document.body;
const isContactPage = themePage.classList.contains('contact-page');
const themeToggleText = themeToggle?.querySelector(
    isContactPage ? '.contact-theme-toggle__text' : '.site-theme-toggle__text'
);
const themeStorageKey = 'graham-site-theme';

if (themeToggle && themeToggleText && (isContactPage || themePage.classList.contains('home-page'))) {
    const readSavedTheme = () => {
        try {
            return window.localStorage.getItem(themeStorageKey)
                || (isContactPage ? window.localStorage.getItem('graham-contact-theme') : null);
        } catch (error) {
            if (error instanceof DOMException && error.name === 'SecurityError') {
                console.warn('Theme preference could not be read in this browser session.', error);
                return null;
            }
            throw error;
        }
    };

    const saveTheme = (theme) => {
        try {
            window.localStorage.setItem(themeStorageKey, theme);
        } catch (error) {
            if (error instanceof DOMException && (error.name === 'SecurityError' || error.name === 'QuotaExceededError')) {
                console.warn('Theme changed for this visit but could not be saved by the browser.', error);
                return;
            }
            throw error;
        }
    };

    const savedTheme = readSavedTheme();
    const systemPrefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches ?? false;

    const applyTheme = (theme) => {
        const useLightTheme = theme === 'light';
        themePage.dataset.theme = useLightTheme ? 'light' : 'dark';
        document.querySelector('meta[name="theme-color"]')?.setAttribute(
            'content',
            useLightTheme ? '#edf4f8' : '#07141d'
        );
        themeToggle.setAttribute(
            'aria-label',
            useLightTheme ? 'Switch to dark theme' : 'Switch to light theme'
        );
        themeToggle.title = useLightTheme ? 'Switch to dark theme' : 'Switch to light theme';
        themeToggleText.textContent = useLightTheme ? 'Dark mode' : 'Light mode';

        const bookingFrame = document.querySelector('.contact-booking-frame iframe');
        if (bookingFrame) {
            const bookingUrl = new URL(bookingFrame.src);
            if (bookingUrl.searchParams.get('theme') !== (useLightTheme ? 'light' : 'dark')) {
                bookingUrl.searchParams.set('theme', useLightTheme ? 'light' : 'dark');
                bookingFrame.src = bookingUrl.href;
            }
        }
    };

    applyTheme(
        savedTheme === 'light' || savedTheme === 'dark'
            ? savedTheme
            : systemPrefersLight ? 'light' : 'dark'
    );

    themeToggle.addEventListener('click', () => {
        const nextTheme = themePage.dataset.theme === 'dark' ? 'light' : 'dark';
        saveTheme(nextTheme);
        applyTheme(nextTheme);
    });
}
