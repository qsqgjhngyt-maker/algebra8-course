import unittest,json,hashlib
from pathlib import Path
from course_pronunciation_v05 import prepare_course_text,split_course_text

class CoursePronunciation(unittest.TestCase):
    def test_formula(self):
        prepared=prepare_course_text('a/b = (a·c)/(b·c), b ≠ 0 и c ≠ 0.')
        self.assertIn('дробь с числителем а умножить на цэ и знаменателем бэ умножить на цэ',prepared)
        self.assertIn('бэ не равно ноль',prepared)
        self.assertNotRegex(prepared,r'[A-Za-z/≠]')
    def test_hyphens_and_decimals(self):
        self.assertIn('по-прежнему',prepare_course_text('по-прежнему x - 2'))
        self.assertIn('икс минус два',prepare_course_text('x - 2'))
        self.assertEqual(prepare_course_text('0,25'),'ноль целых и двадцать пять сотых')
    def test_source_preserved_all_topics(self):
        data=json.loads((Path(__file__).parent/'course-v05/lesson-candidates.json').read_text(encoding='utf-8'))
        for item in data['items']:
            pieces=split_course_text(item['text'])
            self.assertEqual(' '.join(pieces),' '.join(item['text'].split()),item['id'])
            for piece in pieces:self.assertLessEqual(len(prepare_course_text(piece)),220)
            self.assertEqual(hashlib.sha256(item['text'].encode()).hexdigest(),item['text_sha256'])
    def test_approved_stress(self):
        self.assertEqual(prepare_course_text('дроби числитель знаменатель'),'дро́би числи́тель знамена́тель')
        self.assertEqual(prepare_course_text('чи́сла'),'чи́сла')

if __name__=='__main__':unittest.main()
