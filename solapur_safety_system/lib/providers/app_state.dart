import 'package:flutter/foundation.dart';
import '../models/device_state.dart';
import '../models/sensor_data.dart';
import '../services/socket_service.dart';


enum AlertSeverity { info, warning, critical }

class AlertMessage {
  final String id;
  final String message;
  final AlertSeverity severity;
  final DateTime timestamp;
  bool isAcknowledged;

  AlertMessage({
    required this.id,
    required this.message,
    required this.severity,
    DateTime? timestamp,
    this.isAcknowledged = false,
  }) : timestamp = timestamp ?? DateTime.now();
}

class AppState extends ChangeNotifier {
  
  final SocketService socketService = SocketService();
  
  // Connected Devices
  final List<DeviceState> _devices = [];
  List<DeviceState> get devices => _devices;

  // Real-time Sensor Data
  SensorData _currentData = SensorData();
  SensorData get currentData => _currentData;

  // Alerts
  final List<AlertMessage> _activeAlerts = [];
  List<AlertMessage> get activeAlerts => _activeAlerts;

  // Track if pre-entry assessment is done
  bool _isPreEntryPassed = false;
  bool get isPreEntryPassed => _isPreEntryPassed;

  // Overall system safety status
  SafetyStatus _overallStatus = SafetyStatus.safe;
  SafetyStatus get overallStatus => _overallStatus;

  // Role
  String _currentRole = 'Supervisor'; // Default mock role
  String get currentRole => _currentRole;

  void updateSensorData(SensorData newData) {
    _currentData = newData;
    notifyListeners();
  }

  void addDevice(DeviceState device) {
    if (!_devices.any((d) => d.id == device.id)) {
      _devices.add(device);
      notifyListeners();
    }
  }

  void updateDeviceConnection(String deviceId, bool isConnected) {
    final index = _devices.indexWhere((d) => d.id == deviceId);
    if (index >= 0) {
      _devices[index] = _devices[index].copyWith(isConnected: isConnected);
      notifyListeners();
    }
  }

  void setPreEntryStatus(bool passed) {
    _isPreEntryPassed = passed;
    notifyListeners();
  }

  void setOverallStatus(SafetyStatus status) {
    if (_overallStatus != status) {
      _overallStatus = status;
      notifyListeners();
    }
  }

  void addAlert(AlertMessage alert) {
    _activeAlerts.insert(0, alert);
    // Keep max 50 alerts in memory
    if (_activeAlerts.length > 50) {
      _activeAlerts.removeLast();
    }
    notifyListeners();
  }

  void acknowledgeAlert(String alertId) {
    final index = _activeAlerts.indexWhere((a) => a.id == alertId);
    if (index >= 0) {
      _activeAlerts[index].isAcknowledged = true;
      notifyListeners();
    }
  }

  void setRole(String role) {
    _currentRole = role;
    notifyListeners();
  }

  // Add this method to your existing AppState class in app_state.dart

void clearDevices() {
  _devices.clear();
  notifyListeners();
}

void startSocket() {
  socketService.connect((data) {

    // 🔥 Convert backend → model
    _currentData = SensorData(
      h2s: (data['h2s'] ?? 0).toDouble(),
      ch4: (data['ch4'] ?? 0).toDouble(),
      co: (data['co'] ?? 0).toDouble(),
      o2: (data['o2'] ?? 0).toDouble(),
    );

    // 🔥 Update status
    if (data['status'] == "DANGER") {
      _overallStatus = SafetyStatus.block;

      addAlert(AlertMessage(
        id: DateTime.now().toString(),
        message: "Danger! Gas levels critical",
        severity: AlertSeverity.critical,
      ));

    } else if (data['status'] == "CAUTION") {
      _overallStatus = SafetyStatus.caution;

      addAlert(AlertMessage(
        id: DateTime.now().toString(),
        message: "Caution! Gas levels rising",
        severity: AlertSeverity.warning,
      ));

    } else {
      _overallStatus = SafetyStatus.safe;
    }

    notifyListeners(); // 🔥 UI updates
  });
}
}
