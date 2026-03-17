enum SafetyStatus { safe, caution, block }

class SensorData {
  // Gas readings
  final double h2s; // ppm
  final double ch4; // %LEL
  final double co; // ppm
  final double o2; // %

  // Worker vitals
  final int heartRate; // bpm
  final bool fallDetected;
  final bool panicPressed;

  // Environment
  final double waterLevel;
  final double vibration;

  final DateTime timestamp;

  SensorData({
    this.h2s = 0.0,
    this.ch4 = 0.0,
    this.co = 0.0,
    this.o2 = 20.9, // Normal atmosphere
    this.heartRate = 0,
    this.fallDetected = false,
    this.panicPressed = false,
    this.waterLevel = 0.0,
    this.vibration = 0.0,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now();

  SensorData copyWith({
    double? h2s,
    double? ch4,
    double? co,
    double? o2,
    int? heartRate,
    bool? fallDetected,
    bool? panicPressed,
    double? waterLevel,
    double? vibration,
    DateTime? timestamp,
  }) {
    return SensorData(
      h2s: h2s ?? this.h2s,
      ch4: ch4 ?? this.ch4,
      co: co ?? this.co,
      o2: o2 ?? this.o2,
      heartRate: heartRate ?? this.heartRate,
      fallDetected: fallDetected ?? this.fallDetected,
      panicPressed: panicPressed ?? this.panicPressed,
      waterLevel: waterLevel ?? this.waterLevel,
      vibration: vibration ?? this.vibration,
      timestamp: timestamp ?? this.timestamp,
    );
  }
}
