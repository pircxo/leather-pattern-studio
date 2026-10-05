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
  Future<String> fetchSvg(int id) async => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"><rect width="50" height="50"/></svg>';

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
    expect(find.textContaining('Export is still being generated'), findsOneWidget);
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

    expect(find.text('Enter a positive numeric pattern id.'), findsOneWidget);
  });
  testWidgets('renders a ready SVG without a network-dependent widget', (tester) async {
    final fakeApi = FakePatternApi(patternToReturn: Pattern(
      id: 8, name: 'Ready wallet', finishedWidthMm: 110,
      finishedHeightMm: 90, exportStatus: 'ready',
    ));
    await tester.pumpWidget(MaterialApp(home: PatternViewerScreen(api: fakeApi)));
    await tester.tap(find.widgetWithText(ElevatedButton, 'Load'));
    await tester.pumpAndSettle();
    expect(find.text('Ready wallet'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('rejects a zero id', (tester) async {
    await tester.pumpWidget(MaterialApp(home: PatternViewerScreen(api: FakePatternApi())));
    await tester.enterText(find.byType(TextField), '0');
    await tester.tap(find.widgetWithText(ElevatedButton, 'Load'));
    await tester.pumpAndSettle();
    expect(find.text('Enter a positive numeric pattern id.'), findsOneWidget);
  });

}
