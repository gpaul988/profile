const scrollHeaders = document.querySelectorAll('.home-page-header, .contact-page-header');

if (scrollHeaders.length > 0) {
    let previousScrollY = Math.max(0, window.scrollY);

    const updateHeaderVisibility = () => {
        const currentScrollY = Math.max(0, window.scrollY);
        const scrollDelta = currentScrollY - previousScrollY;

        if (currentScrollY <= 80) {
            scrollHeaders.forEach((header) => header.classList.remove('is-scroll-hidden'));
        } else if (scrollDelta < 0) {
            scrollHeaders.forEach((header) => header.classList.remove('is-scroll-hidden'));
        } else if (scrollDelta > 0) {
            scrollHeaders.forEach((header) => header.classList.add('is-scroll-hidden'));
        }

        previousScrollY = currentScrollY;
    };

    window.addEventListener('scroll', updateHeaderVisibility, { passive: true });
}
