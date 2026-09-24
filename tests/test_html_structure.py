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


if __name__ == '__main__':
    unittest.main()
