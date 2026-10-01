import unittest
import re
import xml.etree.ElementTree as ElementTree
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


class Parser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.main_count = 0
        self.h1_count = 0

    def handle_starttag(self, tag, attrs):
        if tag == 'main':
            self.main_count += 1
        if tag == 'h1':
            self.h1_count += 1


class PageAuditParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.main_count = 0
        self.h1_count = 0
        self.local_references = []
        self.fragments = []
        self.issues = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == 'main':
            self.main_count += 1
        if tag == 'h1':
            self.h1_count += 1

        element_id = attributes.get('id')
        if element_id:
            self.ids.append(element_id)

        if tag == 'img' and 'alt' not in attributes:
            self.issues.append('Image is missing an alt attribute.')

        if tag == 'script' and 'src' not in attributes and attributes.get('type') != 'application/ld+json':
            self.issues.append('Executable inline script is not allowed by the Content Security Policy.')
        if tag == 'script' and attributes.get('src', '').startswith('assets/js/') and '?v=' not in attributes['src']:
            self.issues.append('Local JavaScript must be versioned for immutable caching.')
        if tag == 'script' and attributes.get('src', '').startswith('assets/js/preloader.js') and 'defer' not in attributes:
            self.issues.append('The preloader script must not block HTML parsing.')

        if tag == 'a':
            href = attributes.get('href', '')
            if href.startswith('#') and len(href) > 1:
                self.fragments.append(href[1:])
            if attributes.get('target') == '_blank':
                rel = set(attributes.get('rel', '').lower().split())
                if not {'noopener', 'noreferrer'}.issubset(rel):
                    self.issues.append('New-tab link is missing noopener noreferrer.')
            if href and not urlsplit(href).scheme and not href.startswith(('#', '//')):
                self.local_references.append(href)

        for attribute in ('src',):
            value = attributes.get(attribute, '')
            if value and not urlsplit(value).scheme and not value.startswith('//'):
                self.local_references.append(value)

        if tag == 'link':
            href = attributes.get('href', '')
            if 'stylesheet' in attributes.get('rel', '').split() and href.startswith('assets/css/') and '?v=' not in href:
                self.issues.append('Local stylesheets must be versioned for immutable caching.')
            if href and not urlsplit(href).scheme and not href.startswith('//'):
                self.local_references.append(href)


class HtmlStructureTests(unittest.TestCase):
    def test_main_and_h1_present(self):
        parser = Parser()
        parser.feed(Path('index.html').read_text(encoding='utf-8'))
        parser.close()
        self.assertEqual(parser.main_count, 1, 'Expected exactly one <main> landmark.')
        self.assertEqual(parser.h1_count, 1, 'Expected exactly one <h1> heading.')

    def test_all_pages_have_valid_local_references_and_accessibility_basics(self):
        for page_name in ('index.html', 'contact.html', 'privacy.html'):
            page_path = Path(page_name)
            parser = PageAuditParser()
            parser.feed(page_path.read_text(encoding='utf-8'))
            parser.close()

            self.assertEqual(len(parser.ids), len(set(parser.ids)), f'{page_name} contains duplicate IDs.')
            self.assertEqual(parser.main_count, 1, f'{page_name} must contain one main landmark.')
            self.assertEqual(parser.h1_count, 1, f'{page_name} must contain one primary heading.')
            self.assertFalse(parser.issues, f'{page_name}: {parser.issues}')
            self.assertTrue(parser.fragments, f'{page_name} has no in-page navigation fragments.')
            self.assertTrue(
                set(parser.fragments).issubset(set(parser.ids)),
                f'{page_name} has links to missing IDs: {set(parser.fragments) - set(parser.ids)}'
            )

            for reference in parser.local_references:
                local_path = unquote(urlsplit(reference).path)
                if not local_path:
                    continue
                target_path = (page_path.parent / local_path).resolve()
                self.assertTrue(target_path.is_file(), f'{page_name} references missing file: {reference}')

    def test_security_headers_are_active_and_csp_does_not_allow_inline_scripts(self):
        header_lines = Path('_headers').read_text(encoding='utf-8').splitlines()
        self.assertEqual(header_lines[0].strip(), '/*')
        assets_route = header_lines.index('/assets/*')
        root_headers = '\n'.join(header_lines[1:assets_route])
        asset_headers = '\n'.join(header_lines[assets_route + 1:])
        self.assertIn('Strict-Transport-Security:', root_headers)
        self.assertIn('Content-Security-Policy:', root_headers)
        self.assertIn("script-src 'self'", root_headers)
        self.assertNotIn("'unsafe-inline'", root_headers.split('script-src', 1)[1].split(';', 1)[0])
        self.assertIn('Cache-Control: public, max-age=0, must-revalidate', root_headers)
        self.assertIn('Cache-Control: public, max-age=31536000, immutable', asset_headers)

    def test_sitemap_and_robots_cover_public_pages(self):
        robots = Path('robots.txt').read_text(encoding='utf-8')
        sitemap = Path('sitemap.xml').read_text(encoding='utf-8')
        ElementTree.parse('sitemap.xml')
        self.assertIn('Sitemap: https://grahamspaul.cm/sitemap.xml', robots)
        for page in ('https://grahamspaul.cm/', 'https://grahamspaul.cm/contact.html', 'https://grahamspaul.cm/privacy.html'):
            self.assertIn(f'<loc>{page}</loc>', sitemap)

    def test_privacy_notice_is_linked_and_covers_external_form_services(self):
        privacy = Path('privacy.html').read_text(encoding='utf-8')
        contact = Path('contact.html').read_text(encoding='utf-8')
        self.assertIn('privacy.html', Path('index.html').read_text(encoding='utf-8'))
        self.assertIn('href="privacy.html"', contact)
        self.assertIn('Formspree', privacy)
        self.assertIn('Cal.com', privacy)
        self.assertIn('browser storage', privacy)
        self.assertIn('assets/js/site-theme.js?v=20260927-brand-palette', privacy)
        self.assertIn('Submitting this form sends your details to Formspree', contact)
        self.assertIn('local storage', privacy)
        self.assertIn('session storage', privacy)

    def test_enquiry_copy_avoids_an_unverified_response_time_promise(self):
        home = Path('index.html').read_text(encoding='utf-8')
        contact = Path('contact.html').read_text(encoding='utf-8')
        script = Path('assets/js/script.js').read_text(encoding='utf-8')
        for content in (home, contact, script):
            self.assertNotIn('24–48 hours', content)
        self.assertIn('I’ll review your enquiry and reply with clear next steps.', home)
        self.assertIn('I’ll review your enquiry and reply with clear next steps.', contact)
        self.assertIn('I will review it and reply with clear next steps.', script)
        self.assertIn('assets/js/script.js?v=20261018-enquiry-copy', home)
        self.assertIn('assets/js/script.js?v=20261018-enquiry-copy', contact)

    def test_homepage_removes_absolute_responsive_claim_and_unused_font_requests(self):
        home = Path('index.html').read_text(encoding='utf-8')
        self.assertIn('<span class="metric-number">Responsive</span>', home)
        self.assertNotIn('<span class="metric-number">100%</span>', home)
        self.assertNotIn('www.w3schools.com/w3css', home)
        self.assertIn('family=Alex+Brush', home)
        self.assertIn('family=Playfair+Display', home)
        self.assertNotIn('family=Allura', home)
        self.assertIn('family=Bodoni+Moda', home)

    def test_service_process_and_project_form_details_are_aligned(self):
        home = Path('index.html').read_text(encoding='utf-8')
        contact = Path('contact.html').read_text(encoding='utf-8')
        contact_project_options = re.findall(
            r'<option[^>]*>([^<]*)</option>',
            contact.split('id="project_type"', 1)[1].split('</select>', 1)[0]
        )[1:]
        intake_project_options = re.findall(
            r'<option[^>]*>([^<]*)</option>',
            home.split('id="intake-type"', 1)[1].split('</select>', 1)[0]
        )[1:]
        self.assertEqual(contact_project_options, intake_project_options)
        for project_type in ('Web Application', 'Website Redesign', 'Portfolio Site', 'Business Website', 'Brand Refresh'):
            self.assertIn(f'<option>{project_type}</option>', home)
        for project_type in ('Web Application', 'Website Redesign', 'Portfolio Site', 'Business Website', 'Brand Refresh'):
            self.assertIn(f'<option>{project_type}</option>', contact)
        self.assertIn('<option>Full-Stack Development</option>', contact)
        self.assertIn('Connect front-end experiences, backend workflows, APIs, and data', home)
        self.assertIn('Clarify users, goals, scope, required features, constraints, and success measures', home)
        self.assertIn('identify any follow-up support or improvements needed after release', home)

    def test_brand_preloader_is_shared_fast_and_accessible(self):
        shared_markup = []
        for page_name in ('index.html', 'contact.html', 'privacy.html'):
            html = Path(page_name).read_text(encoding='utf-8')
            parser = PageAuditParser()
            parser.feed(html)
            parser.close()
            self.assertIn('<html lang="en" class="is-preloading">', html)
            self.assertIn('assets/js/preloader.js?v=20260929-studio-loader', html)
            self.assertIn('aria-live="polite"', html)
            self.assertIn('aria-label="Loading page content"', html)
            self.assertIn('<img class="site-preloader__favicon" src="assets/images/gray1.png" alt="" width="220" height="220">', html)
            self.assertNotIn('site-theme-toggle__text', html)
            self.assertNotIn('contact-theme-toggle__text', html)
            self.assertNotIn('site-preloader__monogram', html)
            if page_name == 'index.html':
                self.assertIn('id="home-theme-toggle"', html)
            else:
                self.assertIn('id="contact-theme-toggle"', html)
            match = re.search(r'<div class="site-preloader".*?</div>\s*</div>', html, re.DOTALL)
            self.assertIsNotNone(match, f'{page_name} is missing the shared preloader.')
            shared_markup.append(' '.join(match.group(0).split()))
        self.assertEqual(shared_markup[0], shared_markup[1])
        self.assertEqual(shared_markup[1], shared_markup[2])

        script = Path('assets/js/preloader.js').read_text(encoding='utf-8')
        css = Path('assets/css/style.css').read_text(encoding='utf-8')
        self.assertIn('const minimumDisplayTime = 5000', script)
        self.assertIn('const maximumDisplayTime = 10000', script)
        self.assertIn('Refining the details', script)
        self.assertIn('Bringing it all together', script)
        self.assertIn("document.addEventListener('DOMContentLoaded', () => {", script)
        self.assertIn('pageReady = true;', script)
        self.assertIn('}, { once: true });', script)
        self.assertIn('html.is-preloading .site-preloader', css)
        self.assertIn('radial-gradient(ellipse at 37% 50%, rgba(40, 221, 252, 0.1), transparent 36rem)', css)
        self.assertIn('radial-gradient(ellipse at 37% 50%, rgba(8, 127, 133, 0.09), transparent 36rem)', css)
        self.assertNotIn('linear-gradient(rgba(132, 175, 194, 0.035) 1px, transparent 1px)', css)
        self.assertNotIn('linear-gradient(rgba(36, 74, 96, 0.035) 1px, transparent 1px)', css)
        self.assertIn('.site-preloader__favicon', css)
        self.assertIn('.site-preloader__progress', css)
        self.assertIn('object-fit: cover;', css)
        self.assertIn('.site-preloader__edge-note', css)
        self.assertIn('writing-mode: vertical-rl', css)
        self.assertIn('@keyframes preloader-content-enter', css)
        self.assertIn('@keyframes preloader-art-enter', css)
        self.assertIn('@media (prefers-reduced-motion: reduce)', css)

    def test_optimized_images_and_identity_details_are_consistent(self):
        optimized_assets = (
            'gray.webp', 'leo.webp', 'gspec.webp', 'poawd.webp', 'paints.webp',
            'melody.webp', 'mycharger.webp', 'twistword.webp', 'stretch.webp',
            'deskspace.webp', 'bg.webp', 'bg4-jpeg.webp', 'bg4-png.webp'
        )
        total_bytes = 0
        for filename in optimized_assets:
            asset = Path('assets/images') / filename
            self.assertTrue(asset.is_file(), f'Missing optimized image: {filename}')
            total_bytes += asset.stat().st_size
        self.assertLess(total_bytes, 700 * 1024, 'Optimized image payload exceeded the expected budget.')

        css = Path('assets/css/style.css').read_text(encoding='utf-8')
        for image_path in re.findall(r'url\([\'"]?([^\'")]+)', css):
            image_path = urlsplit(image_path).path
            if image_path.startswith('../images/'):
                self.assertTrue(Path('assets/css', image_path).resolve().is_file(), f'Missing CSS image: {image_path}')

        home = Path('index.html').read_text(encoding='utf-8')
        readme = Path('README.md').read_text(encoding='utf-8')
        self.assertIn('graham@grahamspaul.net.ng', readme)
        self.assertNotIn('graham@grahamspaul.me', readme)
        self.assertIn('https://linkedin.com/in/grahamspaul1', home)
        self.assertIn('https://www.linkedin.com/in/grahamspaul1/', readme)
        self.assertNotIn('linkedin.com/in/grahamspaul"', home)

    def test_contact_page_has_form_and_call_booking(self):
        html = Path('contact.html').read_text(encoding='utf-8')
        self.assertIn('id="contact-form"', html)
        self.assertIn('action="https://formspree.io/f/xjyvnjzn"', html)
        self.assertIn('id="book-a-call"', html)
        self.assertIn('src="https://cal.com/grahamspaul/30min', html)
        self.assertIn('assets/images/gray.webp', html)
        self.assertIn('What do you need help with?', html)
        self.assertIn('<select name="services_needed" id="services_needed" required>', html)
        self.assertIn('<option>Backend Development</option>', html)
        self.assertIn('<option>Bug Fixes and Troubleshooting</option>', html)
        self.assertNotIn('If the calendar does not load', html)
        self.assertIn('class="site-bottom-nav"', html)
        self.assertIn('class="site-avatar site-avatar--animated"', html)
        self.assertIn('href="index.html#projects">Projects</a>', html)
        self.assertNotIn('<footer', html)
        self.assertIn('id="contact-theme-toggle"', html)
        self.assertIn('aria-label="Switch to light theme"', html)
        self.assertNotIn('contact-theme-toggle__text', html)
        self.assertIn('assets/js/site-theme.js', html)
        self.assertIn('assets/js/header-scroll.js?v=20260927-brand-palette', html)
        self.assertIn('privacy.html', html)
        self.assertIn('data-theme="dark"', html)
        self.assertIn('Switch to light theme', html)

    def test_contact_theme_has_dark_and_light_styles(self):
        css = Path('assets/css/style.css').read_text(encoding='utf-8')
        script = Path('assets/js/site-theme.js').read_text(encoding='utf-8')
        self.assertIn('body.contact-page[data-theme="dark"]', css)
        self.assertIn('body.contact-page[data-theme="light"]', css)
        self.assertIn('url("../images/contact-background.svg?v=20260927-brand-palette")', css)
        self.assertIn('rgba(4, 10, 20, 0.62)', css)
        self.assertIn("window.localStorage.setItem(themeStorageKey, theme)", script)
        self.assertIn("bookingUrl.searchParams.set('theme'", script)

    def test_site_ui_uses_brand_accents_without_purple(self):
        css = Path('assets/css/style.css').read_text(encoding='utf-8')
        background = Path('assets/images/contact-background.svg').read_text(encoding='utf-8')
        home = Path('index.html').read_text(encoding='utf-8')
        for source in (css, background, home):
            for off_brand_color in (
                '#8e20f5', '#5709b0', '126, 88, 255', '116, 99, 173',
                '136, 82, 194', '133, 83, 202', '199, 112, 240',
                '#e8c9ff', '#a74de0', '139, 107, 255', '6951c8',
                '9a8bff', 'a79aff', '156, 70, 218'
            ):
                self.assertNotIn(off_brand_color, source.lower())
        self.assertNotIn('--purple', css)
        self.assertNotIn('--violet', css)
        self.assertIn('--brand-cyan-vivid', css)
        self.assertIn('fill="#28ddfc"', home)

    def test_quick_chat_is_available_on_both_pages(self):
        home = Path('index.html').read_text(encoding='utf-8')
        contact = Path('contact.html').read_text(encoding='utf-8')
        css = Path('assets/css/style.css').read_text(encoding='utf-8')
        script = Path('assets/js/quick-chat.js').read_text(encoding='utf-8')
        for html in (home, contact):
            self.assertIn('id="quick-chat-toggle"', html)
            self.assertIn('id="quick-chat-panel"', html)
            self.assertIn('class="quick-chat__panel-heading"', html)
            self.assertIn('class="quick-chat__toggle-copy"><small>LET’S CONNECT</small><strong>Chat with me</strong>', html)
            self.assertIn('class="quick-chat__link-action">MESSAGE <span aria-hidden="true">↗</span></span>', html)
            self.assertIn('Choose a channel', html)
            self.assertIn('https://wa.me/2347063045790', html)
            self.assertIn('https://t.me/grahamspaul', html)
            self.assertIn('<small>@grahamspaul</small>', html)
            self.assertIn('assets/js/quick-chat.js?v=20260927-brand-palette', html)
            self.assertIn('assets/css/style.css?v=20260930-project-button-match-offer', html)
        self.assertIn('.quick-chat__panel[hidden]', css)
        self.assertIn('.quick-chat__toggle-mark', css)
        self.assertIn('.quick-chat__link-action', css)
        self.assertIn('.quick-chat__panel-status', css)
        self.assertIn("setQuickChatOpen(quickChatPanel.hidden)", script)
        self.assertIn("event.key === 'Escape'", script)

    def test_home_page_has_working_theme_toggle(self):
        home = Path('index.html').read_text(encoding='utf-8')
        css = Path('assets/css/style.css').read_text(encoding='utf-8')
        script = Path('assets/js/site-theme.js').read_text(encoding='utf-8')
        self.assertIn('id="home-theme-toggle"', home)
        self.assertIn('aria-label="Switch to light theme"', home)
        self.assertNotIn('site-theme-toggle__text', home)
        self.assertIn('data-theme="dark"', home)
        self.assertIn('assets/js/site-theme.js', home)
        self.assertIn('assets/js/header-scroll.js?v=20260927-brand-palette', home)
        self.assertIn('home-theme-toggle', script)
        self.assertIn('.home-page[data-theme="light"]', css)
        self.assertIn('graham-site-theme', script)
        self.assertIn('.site-theme-toggle svg', css)
        self.assertIn('width: 40px;', css)
        self.assertIn('height: 40px;', css)
        self.assertIn('padding: 0;', css)
        self.assertIn('@media (prefers-reduced-motion: reduce)', css)

    def test_fixed_bottom_navigation_is_consistent_across_pages(self):
        navigation_markup = []
        expected_links = (
            'href="index.html#about">About</a>',
            'href="index.html#experience">Experience</a>',
            'href="index.html#skills">Skills</a>',
            'href="index.html#projects">Projects</a>',
            'href="contact.html">Contact</a>'
        )
        for page_name in ('index.html', 'contact.html', 'privacy.html'):
            html = Path(page_name).read_text(encoding='utf-8')
            match = re.search(r'<nav class="site-bottom-nav".*?</nav>', html, re.DOTALL)
            self.assertIsNotNone(match, f'{page_name} is missing the shared bottom navigation.')
            normalized = ' '.join(match.group(0).split())
            navigation_markup.append(normalized)
            for link in expected_links:
                self.assertIn(link, normalized, f'{page_name} bottom navigation is missing {link}.')
            self.assertIn('class="site-bottom-nav__brand"', normalized)
            self.assertIn('class="site-avatar site-avatar--animated"', normalized)
            self.assertNotIn('navbar fixed-bottom', html)
        self.assertEqual(navigation_markup[0], navigation_markup[1])
        self.assertEqual(navigation_markup[1], navigation_markup[2])

    def test_home_hero_has_clear_value_statement_and_next_steps(self):
        home = Path('index.html').read_text(encoding='utf-8')
        css = Path('assets/css/style.css').read_text(encoding='utf-8')
        self.assertIn(
            'I build responsive web applications that turn complex business needs into reliable, easy-to-use digital products.',
            home
        )
        self.assertIn('role="group" aria-label="Hero actions"', home)
        self.assertIn('class="project-button" href="#projects"><span>View projects</span></a>', home)
        self.assertIn('class="project-button hero-actions__secondary" href="contact.html"', home)
        self.assertIn('.hero-summary', css)
        self.assertIn('.hero-actions', css)
        self.assertIn('.home-page[data-theme="light"] .hero-summary', css)
        self.assertIn('.home-page[data-theme="light"] .hero-actions .project-button', css)

    def test_about_section_has_heading_and_specific_bio(self):
        home = Path('index.html').read_text(encoding='utf-8')
        css = Path('assets/css/style.css').read_text(encoding='utf-8')
        self.assertIn('id="about" aria-labelledby="about-title"', home)
        self.assertIn('<p class="eyebrow">A little about me</p>', home)
        self.assertIn('id="about-title">Engineering thoughtful digital products, from first sketch to launch.</h2>', home)
        self.assertIn('understanding the brief, shaping the interface, building the backend, and preparing the product for launch', home)
        self.assertIn('responsive, maintainable applications that solve real business needs', home)
        self.assertIn('class="about-focus-list" aria-label="Areas of focus"', home)
        self.assertIn('Product thinking', home)
        self.assertIn('Front-end and backend', home)
        self.assertIn('Performance and usability', home)
        self.assertIn('View resume', home)
        self.assertIn('View certification', home)
        self.assertIn('.about-section-heading', css)
        self.assertIn('.about-profile-layout', css)
        self.assertIn('.about-portrait > img', css)
        self.assertIn('object-fit: cover;', css)
        self.assertIn('@media (max-width: 760px)', css)
        self.assertIn('.home-page[data-theme="light"] .about-section-heading h2', css)

    def test_project_popup_has_referral_capture_and_open_triggers(self):
        home = Path('index.html').read_text(encoding='utf-8')
        script = Path('assets/js/script.js').read_text(encoding='utf-8')
        self.assertGreaterEqual(home.count('data-open-project-intake'), 2)
        self.assertIn('id="project-intake-modal" role="dialog" aria-modal="true"', home)
        self.assertIn('name="referral_source" id="intake-referral" required', home)
        self.assertIn('name="referred_by" id="intake-referred-by"', home)
        self.assertIn("referralDetails.hidden = referralSourceInput.value !== 'Referral'", script)
        self.assertIn("projectForm.querySelector('#intake-name')?.focus()", script)
        self.assertIn("event.key === 'Tab'", script)

    def test_welcome_offer_popup_and_claim_tracking(self):
        home = Path('index.html').read_text(encoding='utf-8')
        css = Path('assets/css/style.css').read_text(encoding='utf-8')
        script = Path('assets/js/script.js').read_text(encoding='utf-8')
        self.assertNotIn('home-page-header__project-cta', home)
        self.assertIn('id="welcome-offer-modal" role="dialog" aria-modal="true"', home)
        self.assertIn('20% off your first project', home)
        self.assertIn('<span class="site-avatar site-avatar--animated welcome-offer__avatar">', home)
        self.assertIn('<img src="assets/images/gray.webp" alt="Graham S. Paul" width="1120" height="958">', home)
        self.assertIn('class="welcome-offer__border-beams" aria-hidden="true"', home)
        self.assertIn('class="welcome-offer__claim" id="claim-welcome-offer"', home)
        self.assertIn('href="https://wa.me/2347063045790?', home)
        self.assertIn('href="https://t.me/grahamspaul"', home)
        self.assertIn('aria-label="Chat with Graham on WhatsApp at @grahamspaul"', home)
        self.assertIn('aria-label="Chat with Graham on Telegram at @grahamspaul"', home)
        self.assertIn('id="reopen-welcome-offer"', home)
        self.assertIn('assets/js/script.js?v=20261018-enquiry-copy', home)
        self.assertIn('name="offer_code" id="intake-offer-code"', home)
        self.assertIn('value = \'WELCOME20\'', script)
        self.assertIn("window.setTimeout(() => {", script)
        self.assertIn("}, 1200)", script)
        self.assertIn('graham-welcome-offer-state', script)
        self.assertIn('.welcome-offer__card', css)
        self.assertIn('body.welcome-offer-open', css)

    def test_avatar_and_offer_borders_have_opposite_moving_beams(self):
        css = Path('assets/css/style.css').read_text(encoding='utf-8')
        home = Path('index.html').read_text(encoding='utf-8')
        self.assertIn('.site-avatar--animated::before', css)
        self.assertIn('.site-avatar--animated::after', css)
        self.assertIn('border-beam-zigzag-forward 2.8s linear infinite', css)
        self.assertIn('border-beam-zigzag-reverse 2.8s linear infinite', css)
        self.assertIn('@keyframes border-beam-zigzag-forward', css)
        self.assertIn('@keyframes border-beam-zigzag-reverse', css)
        self.assertIn('border-beam-heartbeat 1.4s ease-in-out', css)
        self.assertIn('@keyframes border-beam-heartbeat', css)
        self.assertIn('drop-shadow(0 0 14px rgba(255, 67, 0, 0.85))', css)
        self.assertIn('.welcome-offer__avatar.site-avatar', css)
        self.assertIn('.welcome-offer__claim::before', css)
        self.assertIn('.welcome-offer__claim::after', css)
        self.assertIn('.site-bottom-nav .site-avatar::before', css)
        self.assertIn('.site-bottom-nav .site-avatar::after', css)
        self.assertIn('.welcome-offer__border-beams::before', css)
        self.assertIn('.welcome-offer__border-beams::after', css)
        self.assertIn('@keyframes border-beam-forward', css)
        self.assertIn('@keyframes border-beam-reverse', css)
        self.assertIn('--border-beam-reverse: -180deg;', css)
        self.assertIn('class="site-avatar site-avatar--animated"', home)
        self.assertIn('.site-bottom-nav__brand .site-avatar', css)

    def test_home_light_theme_covers_page_sections(self):
        css = Path('assets/css/style.css').read_text(encoding='utf-8')
        for section in ('#welcome', '#about', '#value', '#process', '#experience', '#skills', '#projects', '#contact'):
            self.assertIn(f'.home-page[data-theme="light"] {section}', css)
        self.assertIn('.home-page[data-theme="light"] .contact-cta', css)

    def test_projects_section_uses_dedicated_background(self):
        css = Path('assets/css/style.css').read_text(encoding='utf-8')
        artwork = Path('assets/images/projects-background.svg')
        self.assertIn('url("../images/projects-background.svg")', css)
        self.assertTrue(artwork.is_file(), 'Expected the projects background artwork to exist.')

    def test_project_links_match_the_project_section_copy(self):
        home = Path('index.html').read_text(encoding='utf-8')
        projects = home.split('id="projects"', 1)[1].split('<!--./end-projects-->', 1)[0]
        self.assertIn('A closer look at selected work across websites, apps, and interactive experiences.', projects)
        self.assertIn('<header class="project-section-heading">', projects)
        self.assertIn('class="project-section-heading__body"', projects)
        self.assertIn('class="project-section-heading__intro"', projects)
        self.assertIn('class="project-section-heading__count"', projects)
        self.assertIn('id="projects-title"', projects)
        self.assertIn('class="project-github-link"', projects)
        self.assertNotIn('large-github-icon', projects)
        self.assertNotIn('View Source Code', projects)
        self.assertNotIn('click "View Project"', projects)
        self.assertEqual(projects.count('project-item"'), 8)
        self.assertEqual(projects.count('data-project-reveal'), 8)
        self.assertEqual(projects.count('role="listitem"'), 8)
        self.assertIn('class="project-reel__track" role="list"', projects)
        self.assertNotIn('data-aos=', projects)
        self.assertEqual(projects.count('class="project-button"'), 8)
        self.assertEqual(projects.count('class="project-source-link"'), 5)
        for repository in (
            'GREY-INFOTECH-LTD/Paints',
            'GREY-INFOTECH-LTD/Melody',
            'GREY-INFOTECH-LTD/MyCharger',
            'GREY-INFOTECH-LTD/TwistWord',
            'GREY-INFOTECH-LTD/Stretch'
        ):
            self.assertIn(f'https://github.com/{repository}', projects)
        self.assertIn('aria-label="Visit the LeoBella Estates live site"', projects)
        self.assertIn('aria-label="View MyCharger source code"', projects)
        self.assertIn('class="display-5 my-2 project-title--mycharger">MyCharger</h2>', projects)

    def test_project_scroll_reveals_have_fallbacks_and_respect_reduced_motion(self):
        home = Path('index.html').read_text(encoding='utf-8')
        css = Path('assets/css/style.css').read_text(encoding='utf-8')
        script = Path('assets/js/project-scroll.js').read_text(encoding='utf-8')
        self.assertIn('assets/js/project-scroll.js?', home)
        self.assertIn('desktopReel.matches', script)
        self.assertIn('prefers-reduced-motion: reduce', script)
        self.assertIn('#projects.project-reel-ready .project-item', css)
        self.assertIn('className = \'project-reel__stage\'', script)
        self.assertIn('circle(var(--reel-clip, 0%) at 14% 32%)', css)
        self.assertIn('.project-reel__nav', css)
        self.assertIn('height: 900svh;', css)
        self.assertIn('(cards.length + 1) * window.innerHeight', script)
        self.assertIn('supportsReelMask', script)
        self.assertIn('project-preview-frame__chrome', css)
        self.assertIn('#projects.project-reel-ready .project-title--mycharger', css)
        self.assertIn('white-space: nowrap;', css)
        self.assertIn('if (!desktopReel.matches || reducedMotion.matches)', script)
        self.assertIn('function restoreStaticPortfolio()', script)
        self.assertIn('project-reel-ready', script)
        self.assertIn('@media (prefers-reduced-motion: reduce)', css)

    def test_experience_timeline_matches_resume_and_has_accessible_progression(self):
        home = Path('index.html').read_text(encoding='utf-8')
        css = Path('assets/css/style.css').read_text(encoding='utf-8')
        script = Path('assets/js/experience-timeline.js').read_text(encoding='utf-8')
        experience = home.split('id="experience"', 1)[1].split('</section>', 1)[0]
        self.assertIn('assets/js/experience-timeline.js?', home)
        self.assertIn('<ol class="experience-list">', experience)
        self.assertEqual(experience.count('class="experience-entry"'), 6)
        for employer in (
            'POAWD Limited',
            'Grey InfoTech Limited',
            'Royal Ginad Group',
            'Cane Services Limited',
            'Invealth Partners Limited',
            'Bemztouch International Limited'
        ):
            self.assertIn(employer, experience)
        self.assertIn('Bachelor of Computer Applications', experience)
        self.assertIn('Oracle Cloud Infrastructure', experience)
        self.assertIn('aria-hidden="true"', experience)
        self.assertIn('experience-timeline__cursor', experience)
        self.assertIn('--experience-progress', css)
        self.assertIn('--experience-progress-position', script)
        self.assertIn('IntersectionObserver', script)
        self.assertIn('prefers-reduced-motion: reduce', css)

    def test_liquid_buttons_keep_brand_colors_drips_and_running_border_beams(self):
        css = Path('assets/css/style.css').read_text(encoding='utf-8')
        self.assertIn('@property --button-beam-angle', css)
        self.assertIn('--button-beam-angle: 360deg;', css)
        self.assertIn('@property --button-beam-reverse-angle', css)
        self.assertIn('--button-beam-reverse-angle: -180deg;', css)
        self.assertIn('@property --button-beam-third-angle', css)
        self.assertIn('--button-beam-third-angle: 450deg;', css)
        self.assertIn('@property --button-beam-fourth-angle', css)
        self.assertIn('--button-beam-fourth-angle: -90deg;', css)
        self.assertIn('inset: -1px;', css)
        self.assertIn('from var(--button-beam-angle)', css)
        self.assertIn('from var(--button-beam-reverse-angle)', css)
        self.assertGreaterEqual(css.count('conic-gradient(from var(--button-beam-'), 10)
        self.assertIn('beam-spin-third 3s linear infinite', css)
        self.assertIn('beam-spin-fourth 3s linear infinite', css)
        self.assertIn('--button-cyan: #28ddfc;', css)
        self.assertIn('--button-orange: #ff5a1f;', css)
        self.assertIn('--button-cyan: #00a9cf;', css)
        self.assertIn('--button-orange: #e94f24;', css)
        self.assertIn('@keyframes liquid-button-drip', css)
        self.assertIn('animation: liquid-button-drip 2.5s ease infinite;', css)
        self.assertIn('min-height: 2.75rem;', css)
        self.assertIn('.home-page .project-button.liquid-button', css)
        self.assertIn('min-height: 3.1rem;', css)
        self.assertIn('padding: 0.8rem 1rem;', css)
        self.assertIn('width: fit-content;', css)
        self.assertIn('min-height: 2.75rem;', css)
        self.assertIn('min-width: 0;', css)
        self.assertIn('padding: 0.65rem 1.1rem;', css)
        self.assertIn('background: linear-gradient(110deg, var(--button-cyan) 0%, var(--button-orange) 100%);', css)
        self.assertIn('.liquid-button__wave--1', css)
        self.assertIn('.liquid-button__wave--2', css)
        self.assertIn('.liquid-button__wave--3', css)
        self.assertIn('height: 400%;', css)
        self.assertIn('top: -200%;', css)
        self.assertIn('transform: translateY(17.5%);', css)
        self.assertIn('transform: translateY(-2.5%);', css)
        self.assertIn('border-radius: 44% 56% 51% 49% / 47% 42% 58% 53%;', css)
        self.assertNotIn('clip-path: polygon(', css)
        self.assertIn('filter: url("#liquid")', css)
        self.assertIn('filter: blur(9px);', css)
        self.assertIn('.button-liquid-filters', css)
        self.assertIn('rgba(40, 221, 252, 0.16)', css)
        self.assertIn('rgba(255, 90, 31, 0.13)', css)
        self.assertIn('rgba(7, 20, 29, 0.34)', css)
        self.assertIn('rgba(255, 255, 255, 0.62)', css)
        script = Path('assets/js/liquid-buttons.js').read_text(encoding='utf-8')
        for generated_class in ('liquid-button__surface', 'liquid-button__wave', 'liquid-button__drop', 'liquid-button__splash', 'liquid-button__content'):
            self.assertIn(generated_class, script)
        self.assertIn('body.contact-page .contact-page-actions .btn', css)
        self.assertIn('.home-page[data-theme="light"] .hero-actions .project-button', css)
        self.assertNotIn('@keyframes beam-spin {\n  to {\n    transform: rotate(360deg);', css)

    def test_home_and_contact_pages_have_no_footer(self):
        home = Path('index.html').read_text(encoding='utf-8')
        contact = Path('contact.html').read_text(encoding='utf-8')
        self.assertNotIn('<footer', home)
        self.assertNotIn('<footer', contact)
        self.assertIn('assets/images/gray.webp', home)
        self.assertIn('<header class="home-page-header">', home)
        self.assertIn('aria-label="Main navigation"', home)
        css = Path('assets/css/style.css').read_text(encoding='utf-8')
        self.assertIn('.home-page-header__inner', css)
        self.assertIn("url('../images/deskspace.webp')", css)

    def test_headers_hide_on_down_scroll_and_return_on_up_scroll(self):
        script = Path('assets/js/header-scroll.js').read_text(encoding='utf-8')
        css = Path('assets/css/style.css').read_text(encoding='utf-8')
        self.assertIn("querySelectorAll('.home-page-header, .contact-page-header')", script)
        self.assertIn("header.classList.add('is-scroll-hidden')", script)
        self.assertIn("header.classList.remove('is-scroll-hidden')", script)
        self.assertIn("window.addEventListener('scroll', updateHeaderVisibility, { passive: true })", script)
        self.assertIn('.home-page-header.is-scroll-hidden', css)
        self.assertIn('overflow-x: clip;', css)
        self.assertIn('overflow-y: visible;', css)


if __name__ == '__main__':
    unittest.main()
