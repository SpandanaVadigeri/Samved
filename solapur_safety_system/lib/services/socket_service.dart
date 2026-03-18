import 'package:socket_io_client/socket_io_client.dart' as IO;

class SocketService {
  late IO.Socket socket;

  void connect(Function(dynamic) onDataReceived) {
    socket = IO.io(
      'http://10.0.2.2:3000', // emulator
      IO.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .build(),
    );

    socket.connect();

    socket.onConnect((_) {
      print("✅ Connected to backend");
    });

    socket.on('sensor-data', (data) {
      print("📡 Data received: $data");
      onDataReceived(data);
    });

    socket.onDisconnect((_) {
      print("❌ Disconnected");
    });
  }
}