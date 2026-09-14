const navLinks = document.querySelectorAll('.nav-item');
const menuToggle = document.getElementById('navbarCollapse');

if (menuToggle && typeof bootstrap !== 'undefined') {
    const bsCollapse = new bootstrap.Collapse(menuToggle, { toggle: false });
    navLinks.forEach((l) => {
        l.addEventListener('click', () => { bsCollapse.toggle(); });
    });
}