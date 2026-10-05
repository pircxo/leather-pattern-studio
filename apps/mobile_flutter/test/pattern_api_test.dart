import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:lps_companion/pattern_api.dart';

void main() {
  test('parses a saved pattern from the REST API', () async {
    final api = PatternApi(baseUrl: 'http://studio/api/v1', client: MockClient((request) async {
      expect(request.url.path, '/api/v1/patterns/7');
      return http.Response('{"id":7,"name":"Wallet","finished_width_mm":110,"finished_height_mm":90,"export_status":"ready"}', 200);
    }));
    final pattern = await api.fetchPattern(7);
    expect(pattern.name, 'Wallet');
    expect(pattern.finishedWidthMm, 110);
  });

  test('reports missing patterns', () async {
    final api = PatternApi(baseUrl: 'http://studio/api/v1', client: MockClient((_) async => http.Response('', 404)));
    await expectLater(api.fetchPattern(99), throwsA(isA<PatternNotFoundException>()));
  });

  test('reports an unavailable export instead of leaving a spinner', () async {
    final api = PatternApi(baseUrl: 'http://studio/api/v1', client: MockClient((_) async => http.Response('', 409)));
    await expectLater(api.fetchSvg(7), throwsA(isA<PatternApiException>()));
  });
}
