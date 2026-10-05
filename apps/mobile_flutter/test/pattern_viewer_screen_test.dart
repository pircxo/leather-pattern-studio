import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lps_companion/pattern_api.dart';
import 'package:lps_companion/pattern_viewer_screen.dart';

/// A fake that never touches the network, so these tests are fast and
/// deterministic — the real [PatternApi] is exercised instead by
/// `apps/api/tests/test_api.py` (the server side of the same contract)
/// and by manual testing against a running API.
class FakePatternApi extends PatternApi {
  final Pattern? patternToReturn;
  final Object? errorToThrow;

  FakePatternApi({this.patternToReturn, this.errorToThrow}) : super(baseUrl: 'http://fake');

  @override
  Future<Pattern> fetchPattern(int id) async {
    if (errorToThrow != null) throw errorToThrow!;
    return patternToReturn!;
  }

  @override
  String svgExportUrl(int id) => 'http://fake/patterns/$id/export.svg';
}

void main() {
  testWidgets('shows a prompt before anything is loaded', (tester) async {
    await tester.pumpWidget(
      MaterialApp(home: PatternViewerScreen(api: FakePatternApi())),
    );

    expect(find.text('Enter a pattern id and tap Load.'), findsOneWidget);
  });

  testWidgets('loads a pattern whose export is still processing', (tester) async {
    final fakeApi = FakePatternApi(
      patternToReturn: Pattern(
        id: 7,
        name: 'Crossbody strap',
        finishedWidthMm: 250,
        finishedHeightMm: 25,
        exportStatus: 'processing',
      ),
    );

    await tester.pumpWidget(MaterialApp(home: PatternViewerScreen(api: fakeApi)));

    await tester.enterText(find.byType(TextField), '7');
    await tester.tap(find.widgetWithText(ElevatedButton, 'Load'));
    await tester.pumpAndSettle();

    expect(find.text('Crossbody strap'), findsOneWidget);
    expect(find.textContaining('250×25mm'), findsOneWidget);
    expect(find.textContaining('export is still being generated'), findsOneWidget);
  });

  testWidgets('shows a clear message when the pattern does not exist', (tester) async {
    final fakeApi = FakePatternApi(errorToThrow: PatternNotFoundException(999));

    await tester.pumpWidget(MaterialApp(home: PatternViewerScreen(api: fakeApi)));

    await tester.enterText(find.byType(TextField), '999');
    await tester.tap(find.widgetWithText(ElevatedButton, 'Load'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Pattern #999 was not found'), findsOneWidget);
  });

  testWidgets('rejects a non-numeric id without calling the API', (tester) async {
    final fakeApi = FakePatternApi(errorToThrow: Exception('should not be called'));

    await tester.pumpWidget(MaterialApp(home: PatternViewerScreen(api: fakeApi)));

    await tester.enterText(find.byType(TextField), 'abc');
    await tester.tap(find.widgetWithText(ElevatedButton, 'Load'));
    await tester.pumpAndSettle();

    expect(find.text('Enter a numeric pattern id.'), findsOneWidget);
  });
}
