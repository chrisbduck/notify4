import unittest
from unittest.mock import patch
from api.tolls import select_commute_tolls
from api.index import app

class TollTests(unittest.TestCase):
    def rate(self, **changes):
        trip = {'TripName': '405tp01352', 'Message': '$7.25', 'Toll': 7.25, 'MessageUpdateTime': '/Date(1700000000000-0800)/'}
        trip.update(changes)
        return select_commute_tolls({'Trips': [trip]}, 1700000060)['northbound']

    def test_dollars_not_cents(self):
        self.assertEqual(self.rate()['amount'], 7.25)

    def test_restrictions_override_zero(self):
        for message in ['CLOSED', 'HOV ONLY']:
            rate = self.rate(Message=message, Toll=0)
            self.assertEqual(rate['status'], 'restricted')
            self.assertIsNone(rate['amount'])

    def test_free(self):
        self.assertEqual(self.rate(Message='FREE', Toll=0)['status'], 'free')

    def test_stale_missing_invalid(self):
        self.assertEqual(self.rate(MessageUpdateTime='/Date(1699999000000)/')['status'], 'stale')
        for value in [None, -1, float('nan'), True]:
            self.assertEqual(self.rate(Toll=value)['status'], 'unavailable')
        self.assertEqual(self.rate(MessageUpdateTime=None)['status'], 'unavailable')

    def test_trip_selection(self):
        payload = {'Trips': [dict(TripName=name, Toll=price, Message='', MessageUpdateTime='/Date(1700000000000)/') for name, price in [('405tp01351', 1), ('405tp01352', 7), ('405tp02162', 5), ('405tp02252', 12)]]}
        result = select_commute_tolls(payload, 1700000060)
        self.assertEqual(result['northbound']['amount'], 7)
        self.assertEqual(result['southbound']['amount'], 5)
        self.assertEqual(select_commute_tolls({'Trips': []})['southbound']['status'], 'unavailable')

    def test_api_failure_hides_credentials(self):
        import requests
        with patch.dict('os.environ', {'WSDOT_ACCESS_CODE': 'test-code'}), patch('api.tolls.requests.Session.get', side_effect=requests.Timeout('secret URL')):
            response = app.test_client().get('/api/wsdot/tolls')
        self.assertEqual(response.status_code, 502)
        self.assertNotIn('secret', response.get_data(as_text=True))

if __name__ == '__main__':
    unittest.main()
