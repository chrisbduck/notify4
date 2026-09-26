import unittest
from unittest.mock import patch
from api.tolls import select_commute_tolls
from api.index import app

class TollTests(unittest.TestCase):
    def rate(self, **changes):
        trip = {'TripName': '405tp01352', 'CurrentMessage': '$7.25', 'CurrentToll': 725, 'TimeUpdated': '/Date(1700000000000-0800)/'}
        trip.update(changes)
        return select_commute_tolls([trip], 1700000060)['northbound']

    def test_cents_converted_to_dollars(self):
        self.assertEqual(self.rate()['amount'], 7.25)

    def test_restrictions_override_zero(self):
        for message in ['CLOSED', 'HOV ONLY']:
            rate = self.rate(CurrentMessage=message, CurrentToll=0)
            self.assertEqual(rate['status'], 'restricted')
            self.assertIsNone(rate['amount'])

    def test_free(self):
        self.assertEqual(self.rate(CurrentMessage='FREE', CurrentToll=0)['status'], 'free')

    def test_stale_missing_invalid(self):
        self.assertEqual(self.rate(TimeUpdated='/Date(1699999000000)/')['status'], 'stale')
        for value in [None, -1, float('nan'), True]:
            self.assertEqual(self.rate(CurrentToll=value)['status'], 'unavailable')
        self.assertEqual(self.rate(TimeUpdated=None)['status'], 'unavailable')

    def test_trip_selection(self):
        payload = [dict(TripName=name, CurrentToll=price, CurrentMessage='', TimeUpdated='/Date(1700000000000)/') for name, price in [('405tp01351', 100), ('405tp01352', 700), ('405tp02162', 500), ('405tp02252', 1200)]]
        result = select_commute_tolls(payload, 1700000060)
        self.assertEqual(result['northbound']['amount'], 7)
        self.assertEqual(result['southbound']['amount'], 5)
        self.assertEqual(select_commute_tolls([])['southbound']['status'], 'unavailable')

    def test_fresh_rate_is_not_rejected_for_old_sign_message(self):
        rate = self.rate(MessageUpdateTime='/Date(1699999000000)/')
        self.assertEqual(rate['status'], 'priced')
        self.assertEqual(rate['amount'], 7.25)

    def test_old_endpoint_payload_is_rejected(self):
        with self.assertRaises(ValueError):
            select_commute_tolls({'Trips': []})

    def test_current_rate_api_contract(self):
        import time
        payload = [dict(TripName=name, CurrentToll=cents, CurrentMessage=None, TimeUpdated=f'/Date({int(time.time() * 1000)})/') for name, cents in [('405tp01352', 725), ('405tp02162', 550)]]
        with patch.dict('os.environ', {'WSDOT_ACCESS_CODE': 'test-code'}), patch('api.tolls.requests.Session.get') as get:
            get.return_value.json.return_value = payload
            response = app.test_client().get('/api/wsdot/tolls')
        self.assertTrue(get.call_args.args[0].endswith('/GetTollRatesAsJson'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['northbound']['amount'], 7.25)
        self.assertEqual(response.json['southbound']['amount'], 5.50)
        self.assertEqual(response.headers['Cache-Control'], 'no-store')

    def test_api_failure_hides_credentials(self):
        import requests
        with patch.dict('os.environ', {'WSDOT_ACCESS_CODE': 'test-code'}), patch('api.tolls.requests.Session.get', side_effect=requests.Timeout('secret URL')):
            response = app.test_client().get('/api/wsdot/tolls')
        self.assertEqual(response.status_code, 502)
        self.assertNotIn('secret', response.get_data(as_text=True))

if __name__ == '__main__':
    unittest.main()
