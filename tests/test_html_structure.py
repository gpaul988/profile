import unittest
from html.parser import HTMLParser
from pathlib import Path


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


class HtmlStructureTests(unittest.TestCase):
    def test_main_and_h1_present(self):
        parser = Parser()
        parser.feed(Path('index.html').read_text(encoding='utf-8'))
        parser.close()
        self.assertEqual(parser.main_count, 1, 'Expected exactly one <main> landmark.')
        self.assertEqual(parser.h1_count, 1, 'Expected exactly one <h1> heading.')

    def test_contact_page_has_form_and_call_booking(self):
        html = Path('contact.html').read_text(encoding='utf-8')
        self.assertIn('id="contact-form"', html)
        self.assertIn('action="https://formspree.io/f/xjyvnjzn"', html)
        self.assertIn('id="book-a-call"', html)
        self.assertIn('src="https://cal.com/grahamspaul/30min', html)
        self.assertIn('class="site-footer"', html)
        self.assertIn('assets/images/gray.jpg', html)
        self.assertIn('What do you need help with?', html)
        self.assertIn('<select name="services_needed" id="services_needed" required>', html)
        self.assertIn('<option>Backend Development</option>', html)
        self.assertIn('<option>Bug Fixes and Troubleshooting</option>', html)
        self.assertNotIn('If the calendar does not load', html)
        self.assertIn('class="contact-bottom-nav"', html)
        self.assertIn('href="#book-a-call">Book a call</a>', html)

    def test_home_and_contact_share_footer(self):
        home = Path('index.html').read_text(encoding='utf-8')
        contact = Path('contact.html').read_text(encoding='utf-8')
        self.assertIn('class="site-footer"', home)
        self.assertIn('class="site-footer"', contact)
        self.assertIn('assets/images/gray.jpg', home)


if __name__ == '__main__':
    unittest.main()
