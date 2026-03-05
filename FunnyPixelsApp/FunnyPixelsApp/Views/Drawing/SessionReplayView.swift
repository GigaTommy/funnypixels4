import SwiftUI
import MapKit

/// 会话回放视图
struct SessionReplayView: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    let pixels: [SessionPixel]
    @Environment(\.dismiss) var dismiss
    
    // Animation State
    @State private var currentIndex = 0
    @State private var isPlaying = false
    @State private var playbackSpeed: Double = 10.0 // Hz (frames per second)
    @State private var cameraPosition: MapCameraPosition = .automatic
    @State private var timer: Timer?
    
    // Derived Data
    @State private var visiblePixels: [SessionPixel] = []
    @State private var pathCoordinates: [CLLocationCoordinate2D] = []
    
    var body: some View {
        ZStack {
            // Map
            Map(position: $cameraPosition) {
                // 绘制已完成的路径
                if !pathCoordinates.isEmpty {
                    MapPolyline(coordinates: pathCoordinates)
                        .stroke(.blue.opacity(0.6), lineWidth: 4)
                }
                
                // 绘制当前头部像素
                if let lastPixel = visiblePixels.last {
                    Annotation("Head", coordinate: CLLocationCoordinate2D(latitude: lastPixel.latitude, longitude: lastPixel.longitude)) {
                        Circle()
                            .fill(.orange)
                            .frame(width: 12, height: 12)
                            .shadow(radius: 2)
                            .overlay(
                                Circle()
                                    .stroke(.white, lineWidth: 2)
                            )
                    }
                }
            }
            .edgesIgnoringSafeArea(.all)
            
            // HUD / Controls
            VStack {
                // Header
                HStack {
                    Button(action: {
                        stopPlayback()
                        dismiss()
                    }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 32))
                            .foregroundColor(.white)
                            .shadow(radius: 2)
                    }
                    Spacer()
                    
                    VStack(alignment: .trailing) {
                        Text("\(currentIndex) / \(pixels.count)")
                            .font(.monospacedDigit(.headline)())
                            .foregroundColor(.white)
                            .shadow(radius: 2)
                        
                        Text(String(format: NSLocalizedString("session.replay_progress", comment: ""), Int(Double(currentIndex)/Double(max(1, pixels.count))*100)))
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.8))
                            .shadow(radius: 2)
                    }
                }
                .padding()
                .padding(.top, 40)
                
                Spacer()
                
                // Control Panel
                VStack(spacing: 20) {
                    // Slider
                    Slider(value: Binding(get: {
                        Double(currentIndex)
                    }, set: { newValue in
                        stopPlayback()
                        currentIndex = Int(newValue)
                        updateVisibleState()
                    }), in: 0...Double(max(1, pixels.count - 1)))
                    .accentColor(.white)
                    
                    // Buttons
                    HStack(spacing: 40) {
                        Button(action: {
                            currentIndex = 0
                            updateVisibleState()
                            isPlaying = false // Reset pauses
                        }) {
                            Image(systemName: "backward.end.fill")
                                .font(.title)
                        }
                        
                        Button(action: togglePlayback) {
                            Image(systemName: isPlaying ? "pause.circle.fill" : "play.circle.fill")
                                .font(.system(size: 64))
                        }
                        
                        Menu {
                            Button("1x Speed") { playbackSpeed = 5 }
                            Button("2x Speed") { playbackSpeed = 10 }
                            Button("5x Speed") { playbackSpeed = 25 }
                            Button("10x Speed") { playbackSpeed = 50 }
                        } label: {
                            VStack {
                                Image(systemName: "speedometer")
                                Text(String(format: "%.0fx", playbackSpeed/5.0))
                                    .font(.caption)
                            }
                        }
                    }
                    .foregroundColor(.white)
                }
                .padding()
                .background(.ultraThinMaterial)
                .cornerRadius(20)
                .padding()
            }
        }
        .onAppear {
            setupInitialCamera()
        }
    }
    
    // MARK: - Logic
    
    private func setupInitialCamera() {
        guard let first = pixels.first else { return }
        cameraPosition = .region(MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: first.latitude, longitude: first.longitude),
            span: MKCoordinateSpan(latitudeDelta: 0.005, longitudeDelta: 0.005)
        ))
        
        // Start playing automatically after a brief delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            isPlaying = true
            startPlayback()
        }
    }
    
    private func togglePlayback() {
        if isPlaying {
            stopPlayback()
        } else {
            if currentIndex >= pixels.count - 1 {
                currentIndex = 0
            }
            startPlayback()
        }
    }
    
    private func startPlayback() {
        isPlaying = true
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1.0 / playbackSpeed, repeats: true) { _ in
            advanceFrame()
        }
    }
    
    private func stopPlayback() {
        isPlaying = false
        timer?.invalidate()
        timer = nil
    }
    
    private func advanceFrame() {
        guard currentIndex < pixels.count - 1 else {
            stopPlayback()
            return
        }
        
        currentIndex += 1
        updateVisibleState()
        
        // Camera Follow Logic (every 10 frames or if slow)
        if currentIndex % 5 == 0 {
            updateCamera()
        }
    }
    
    private func updateVisibleState() {
        // Optimizing slicing for large arrays could be done, but prefix is fine for < 10k pixels usually
        // Actually, slicing directly is faster:
        // visiblePixels = Array(pixels[0...currentIndex])
        // Instead of full array copy, lets just maintain pathCoordinates which is what maps needs
        if currentIndex < pixels.count {
             let currentPixel = pixels[currentIndex]
             if visiblePixels.count < currentIndex + 1 {
                 // Append
                 visiblePixels.append(currentPixel)
                 pathCoordinates.append(currentPixel.coordinate2D)
             } else {
                 // Reset/Seek
                 visiblePixels = Array(pixels.prefix(currentIndex + 1))
                 pathCoordinates = visiblePixels.map { $0.coordinate2D }
             }
        }
    }
    
    private func updateCamera() {
        guard let current = visiblePixels.last else { return }
        
        withAnimation(.linear(duration: 1.0 / playbackSpeed * 5)) {
             cameraPosition = .region(MKCoordinateRegion(
                center: current.coordinate2D,
                span: MKCoordinateSpan(latitudeDelta: 0.002, longitudeDelta: 0.002) // Close zoom
            ))
        }
    }
}

extension SessionPixel {
    var coordinate2D: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

#Preview {
    SessionReplayView(pixels: [])
}
