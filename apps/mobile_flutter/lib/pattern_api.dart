import 'dart:convert';
import 'package:http/http.dart' as http;

/// The handful of fields the viewer actually needs. The REST response has
/// more (seam allowance, raw path data, timestamps) that this screen
/// doesn't use — modelling only what a client consumes, not the whole
/// server shape, is deliberate: it means the viewer doesn't have to
/// change every time the API response grows a new field.
class Pattern {
  final int id;
  final String name;
  final double finishedWidthMm;
  final double finishedHeightMm;
  final String exportStatus;

  Pattern({
    required this.id,
    required this.name,
    required this.finishedWidthMm,
    required this.finishedHeightMm,
    required this.exportStatus,
  });

  factory Pattern.fromJson(Map<String, dynamic> json) {
    return Pattern(
      id: json['id'] as int,
      name: json['name'] as String,
      finishedWidthMm: (json['finished_width_mm'] as num).toDouble(),
      finishedHeightMm: (json['finished_height_mm'] as num).toDouble(),
      exportStatus: json['export_status'] as String,
    );
  }
}

class PatternNotFoundException implements Exception {
  final int id;
  PatternNotFoundException(this.id);

  @override
  String toString() => 'Pattern #$id was not found.';
}

class PatternApiException implements Exception {
  final String message;
  PatternApiException(this.message);

  @override
  String toString() => message;
}

/// Thin wrapper over the same REST API `apps/web` talks to. Kept as an
/// injectable class (rather than top-level functions) so widget tests can
/// substitute a fake implementation instead of hitting the network — see
/// `test/pattern_viewer_screen_test.dart`.
class PatternApi {
  final String baseUrl;
  final http.Client _client;

  PatternApi({required this.baseUrl, http.Client? client}) : _client = client ?? http.Client();

  Future<Pattern> fetchPattern(int id) async {
    final uri = Uri.parse('$baseUrl/patterns/$id');
    final response = await _client.get(uri);

    if (response.statusCode == 404) {
      throw PatternNotFoundException(id);
    }
    if (response.statusCode != 200) {
      throw PatternApiException('Server returned ${response.statusCode}');
    }

    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return Pattern.fromJson(body);
  }

  String svgExportUrl(int id) => '$baseUrl/patterns/$id/export.svg';
}
