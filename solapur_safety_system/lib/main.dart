import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/app_state.dart';
import 'screens/dashboard_screen.dart';
import 'screens/pre_entry_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const SolapurSafetyApp());
}

class SolapurSafetyApp extends StatelessWidget {
  const SolapurSafetyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AppState()),
      ],
      child: MaterialApp(
        title: 'Solapur Safety',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          colorScheme: ColorScheme.fromSeed(
            seedColor: Colors.teal,
            brightness: Brightness.dark,
          ),
          fontFamily: 'Roboto', // Default material font
        ),
        initialRoute: '/pre_entry',
        routes: {
          '/pre_entry': (context) => const PreEntryScreen(),
          '/dashboard': (context) => const DashboardScreen(),
        },
      ),
    );
  }
}
