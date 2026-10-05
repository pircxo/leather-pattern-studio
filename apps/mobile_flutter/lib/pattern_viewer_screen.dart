import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'pattern_api.dart';

/// A single, honest screen: type a pattern id, fetch it from the same
/// REST API the web app uses, and render its SVG export. No offline
/// cache, no editing — those are deliberately out of scope for a first
/// Flutter screen (see ARCHITECTURE.md "what I'd add next").
class PatternViewerScreen extends StatefulWidget {
  final PatternApi api;

  const PatternViewerScreen({super.key, required this.api});

  @override
  State<PatternViewerScreen> createState() => _PatternViewerScreenState();
}

enum _LoadState { idle, loading, loaded, error }

class _PatternViewerScreenState extends State<PatternViewerScreen> {
  final TextEditingController _idController = TextEditingController(text: '1');
  _LoadState _state = _LoadState.idle;
  Pattern? _pattern;
  String? _svg;
  String? _errorMessage;

  Future<void> _load() async {
    final id = int.tryParse(_idController.text.trim());
    if (id == null || id <= 0) {
      setState(() {
        _state = _LoadState.error;
        _errorMessage = 'Enter a positive numeric pattern id.';
      });
      return;
    }

    setState(() {
      _state = _LoadState.loading;
      _errorMessage = null;
    });

    try {
      final pattern = await widget.api.fetchPattern(id);
      final svg = pattern.exportStatus == 'ready' ? await widget.api.fetchSvg(id) : null;
      if (!mounted) return;
      setState(() {
        _pattern = pattern;
        _svg = svg;
        _state = _LoadState.loaded;
      });
    } catch (err) {
      if (!mounted) return;
      setState(() {
        _state = _LoadState.error;
        _errorMessage = err.toString();
      });
    }
  }

  @override
  void dispose() {
    _idController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Leather Pattern Studio')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _idController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Pattern ID',
                      border: OutlineInputBorder(),
                    ),
                    // Accessibility: a label on the field is enough for
                    // screen readers here since it names the control
                    // unambiguously; no separate Semantics wrapper needed.
                  ),
                ),
                const SizedBox(width: 12),
                ElevatedButton(
                  onPressed: _state == _LoadState.loading ? null : _load,
                  child: _state == _LoadState.loading
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Load'),
                ),
              ],
            ),
            const SizedBox(height: 24),
            Expanded(child: _buildBody()),
          ],
        ),
      ),
    );
  }

  Widget _buildBody() {
    switch (_state) {
      case _LoadState.idle:
        return const Center(child: Text('Enter a pattern id and tap Load.'));
      case _LoadState.loading:
        return const Center(child: CircularProgressIndicator());
      case _LoadState.error:
        return Center(
          child: Text(
            _errorMessage ?? 'Something went wrong.',
            style: const TextStyle(color: Colors.red),
            semanticsLabel: 'Error: ${_errorMessage ?? "something went wrong"}',
          ),
        );
      case _LoadState.loaded:
        final pattern = _pattern!;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(pattern.name, style: Theme.of(context).textTheme.headlineSmall),
            Text(
              '${pattern.finishedWidthMm.toStringAsFixed(0)}'
              '×${pattern.finishedHeightMm.toStringAsFixed(0)}mm '
              '· export ${pattern.exportStatus}',
            ),
            const SizedBox(height: 16),
            if (pattern.exportStatus == 'ready')
              Expanded(
                child: SvgPicture.string(
                  _svg!,
                  semanticsLabel: '${pattern.name} cutting pattern',
                  placeholderBuilder: (_) => const Center(child: CircularProgressIndicator()),
                ),
              )
            else
              Text(pattern.exportStatus == 'failed'
                  ? 'Export failed. Retry the export in the web studio.'
                  : 'Export is still being generated — try Load again shortly.'),
          ],
        );
    }
  }
}
