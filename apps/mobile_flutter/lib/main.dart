import 'package:flutter/material.dart';
import 'pattern_api.dart';
import 'pattern_viewer_screen.dart';

/// Points at the API's dev default. Override at build/run time with
/// `--dart-define=API_BASE_URL=https://your-host/api/v1` for a real
/// device talking to a non-localhost API.
const String _defaultApiBaseUrl = 'http://localhost:8000/api/v1';

void main() {
  const apiBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: _defaultApiBaseUrl);
  runApp(LpsCompanionApp(apiBaseUrl: apiBaseUrl));
}

class LpsCompanionApp extends StatelessWidget {
  final String apiBaseUrl;

  const LpsCompanionApp({super.key, required this.apiBaseUrl});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Leather Pattern Studio',
      theme: ThemeData(
        colorSchemeSeed: const Color(0xFF7A3B1E),
        useMaterial3: true,
      ),
      home: PatternViewerScreen(api: PatternApi(baseUrl: apiBaseUrl)),
    );
  }
}
