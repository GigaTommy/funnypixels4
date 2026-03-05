import SwiftUI
import CoreLocation

/// 全屏沉浸式开瓶视图 (sheet 模式)
struct DriftBottleOpenView: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    let bottle: DriftBottle
    @Environment(\.dismiss) private var dismiss
    @State private var messageText = ""
    @State private var isSubmitting = false
    @State private var phase: OpenPhase = .opening
    @State private var result: OpenBottleResult?
    @State private var errorMessage: String?

    private let api = DriftBottleAPIService.shared
    private let locationManager = LocationManager.shared

    enum OpenPhase {
        case opening
        case reading
        case writing
        case releasing
        case sunk
    }

    var body: some View {
        NavigationStack {
            ZStack {
                AppColors.background
                    .ignoresSafeArea()

                ScrollView(showsIndicators: false) {
                    VStack(spacing: 24) {
                        switch phase {
                        case .opening:
                            openingAnimation
                        case .reading:
                            readingContent
                        case .writing:
                            writingSection
                        case .releasing:
                            releasingAnimation
                        case .sunk:
                            sunkView
                        }
                    }
                    .padding(24)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { dismiss() }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(AppColors.textTertiary)
                    }
                }
            }
        }
        .alert(NSLocalizedString("common.hint", comment: ""), isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button(NSLocalizedString("common.confirm", comment: ""), role: .cancel) { }
        } message: {
            Text(errorMessage ?? "")
        }
        .onAppear {
            // 🆕 播放打开音效
            SoundManager.shared.play(.bottleOpen)

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
                withAnimation(.spring(response: 0.5)) {
                    phase = .reading
                }
            }
        }
    }

    // MARK: - Opening Animation

    private var openingAnimation: some View {
        VStack(spacing: 20) {
            Spacer(minLength: 80)
            Image(systemName: "sailboat.fill")
                .responsiveFont(.largeTitle)
                .foregroundColor(.blue)
                .scaleEffect(1.2)
                .animation(.spring(response: 0.4, dampingFraction: 0.5).repeatForever(autoreverses: true), value: phase)
            Text(NSLocalizedString("drift_bottle.open.opening", comment: ""))
                .responsiveFont(.headline)
                .foregroundColor(AppColors.textSecondary)
            Spacer(minLength: 80)
        }
    }

    // MARK: - Reading Content

    private var readingContent: some View {
        VStack(spacing: 20) {
            PixelSnapshotView(snapshot: bottle.pixelSnapshot, size: 100, cornerRadius: 12)

            VStack(spacing: 8) {
                Text(String(format: NSLocalizedString("drift_bottle.open.from", comment: ""), bottle.originCity ?? NSLocalizedString("drift_bottle.far_away", comment: "")))
                    .responsiveFont(.title2, weight: .bold)
                    .foregroundColor(AppColors.textPrimary)

                HStack(spacing: 16) {
                    Label("\(String(format: "%.1f", bottle.distanceKm))km", systemImage: "arrow.triangle.swap")
                    Label(String(format: NSLocalizedString("drift_bottle.open.days", comment: ""), bottle.daysAfloat), systemImage: "calendar")
                    Label(String(format: NSLocalizedString("drift_bottle.open.station", comment: ""), bottle.openCount + 1, bottle.maxOpeners), systemImage: "mappin.and.ellipse")
                }
                .responsiveFont(.caption)
                .foregroundColor(AppColors.textSecondary)
            }

            if let messages = bottle.messages, !messages.isEmpty {
                VStack(alignment: .leading, spacing: 12) {
                    Text(NSLocalizedString("drift_bottle.open.messages_title", comment: ""))
                        .responsiveFont(.subheadline, weight: .semibold)
                        .foregroundColor(AppColors.textTertiary)

                    ForEach(messages) { msg in
                        if let text = msg.message, !text.isEmpty {
                            HStack(alignment: .top, spacing: 10) {
                                Circle()
                                    .fill(msg.stationNumber == 0 ? Color.blue : AppColors.textTertiary.opacity(0.4))
                                    .frame(width: 8, height: 8)
                                    .padding(.top, 5)

                                VStack(alignment: .leading, spacing: 2) {
                                    Text(text)
                                        .responsiveFont(.subheadline)
                                        .foregroundColor(AppColors.textPrimary)
                                    Text("\(msg.city ?? "") · \(msg.authorName)")
                                        .responsiveFont(.caption2)
                                        .foregroundColor(AppColors.textTertiary)
                                }
                            }
                        }
                    }
                }
                .padding(16)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.white)
                        .shadow(color: .black.opacity(0.06), radius: 6, x: 0, y: 2)
                )
            }

            if bottle.openCount + 1 >= bottle.maxOpeners {
                Label(NSLocalizedString("drift_bottle.open.last_stop", comment: ""), systemImage: "water.waves")
                    .responsiveFont(.callout)
                    .foregroundColor(.orange)
                    .padding(.top, 8)
            }

            Button(action: {
                withAnimation(.spring(response: 0.3)) {
                    phase = .writing
                }
            }) {
                Text(NSLocalizedString("drift_bottle.open.write_message", comment: ""))
                    .responsiveFont(.callout)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Capsule().fill(Color.blue))
            }

            Button(action: { submitAndRelease(message: nil) }) {
                Text(NSLocalizedString("drift_bottle.open.release", comment: ""))
                    .responsiveFont(.subheadline)
                    .foregroundColor(AppColors.textTertiary)
            }
        }
        .transition(.opacity.combined(with: .scale(scale: 0.95)))
    }

    // MARK: - Writing Section

    private var writingSection: some View {
        VStack(spacing: 20) {
            Text(NSLocalizedString("drift_bottle.open.leave_footprint", comment: ""))
                .responsiveFont(.title3, weight: .bold)
                .foregroundColor(AppColors.textPrimary)

            TextField(NSLocalizedString("drift_bottle.open.placeholder", comment: ""), text: $messageText, axis: .vertical)
                .textFieldStyle(.roundedBorder)
                .lineLimit(3...5)
                .onChange(of: messageText) {
                    if messageText.count > 50 {
                        messageText = String(messageText.prefix(50))
                    }
                }

            Text("\(messageText.count)/50")
                .font(.caption)
                .foregroundColor(AppColors.textTertiary)

            HStack(spacing: 16) {
                Button(action: { submitAndRelease(message: messageText) }) {
                    HStack {
                        if isSubmitting {
                            ProgressView().tint(.white)
                        } else {
                            Label(NSLocalizedString("drift_bottle.open.submit_release", comment: ""), systemImage: "water.waves")
                        }
                    }
                    .responsiveFont(.callout)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Capsule().fill(Color.blue))
                }
                .disabled(isSubmitting)
            }

            Button(action: { submitAndRelease(message: nil) }) {
                Text(NSLocalizedString("drift_bottle.open.release", comment: ""))
                    .responsiveFont(.subheadline)
                    .foregroundColor(AppColors.textTertiary)
            }
        }
        .transition(.move(edge: .trailing).combined(with: .opacity))
    }

    // MARK: - Releasing Animation

    private var releasingAnimation: some View {
        VStack(spacing: 20) {
            Spacer(minLength: 60)
            Image(systemName: "sailboat.fill")
                .responsiveFont(.largeTitle)
                .foregroundColor(.blue.opacity(0.6))
                .offset(y: -30)
            Text(NSLocalizedString("drift_bottle.open.released", comment: ""))
                .responsiveFont(.headline)
                .foregroundColor(AppColors.textSecondary)
            Spacer(minLength: 60)
        }
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                dismiss()
            }
        }
    }

    // MARK: - Sunk View

    private var sunkView: some View {
        VStack(spacing: 20) {
            Spacer(minLength: 40)
            Image(systemName: "water.waves")
                .responsiveFont(.largeTitle)
                .foregroundColor(.blue)
            Text(NSLocalizedString("drift_bottle.open.sunk_title", comment: ""))
                .responsiveFont(.title2, weight: .bold)
                .foregroundColor(AppColors.textPrimary)
            Text(NSLocalizedString("drift_bottle.open.sunk_message", comment: ""))
                .responsiveFont(.subheadline)
                .foregroundColor(AppColors.textSecondary)

            if let journey = result?.journeyCard {
                JourneyCardMiniView(detail: journey)
            }

            Button(action: { dismiss() }) {
                Text(NSLocalizedString("drift_bottle.open.ok", comment: ""))
                    .responsiveFont(.callout)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Capsule().fill(Color.blue))
            }
            Spacer(minLength: 40)
        }
    }

    // MARK: - Submit

    private func submitAndRelease(message: String?) {
        guard !isSubmitting else { return }
        isSubmitting = true

        Task {
            guard let location = locationManager.currentLocation else {
                Logger.warning("Cannot open drift bottle: location unavailable")
                isSubmitting = false
                return
            }

            do {
                let openResult = try await api.openBottle(
                    bottleId: bottle.bottleId,
                    lat: location.coordinate.latitude,
                    lng: location.coordinate.longitude,
                    message: message
                )

                result = openResult

                withAnimation(.spring(response: 0.4)) {
                    phase = openResult.didSink ? .sunk : .releasing
                }
            } catch {
                Logger.error("Open drift bottle failed: \(error.localizedDescription)")
                errorMessage = error.localizedDescription
            }

            isSubmitting = false
        }
    }
}

/// 旅途卡片迷你预览(沉没时展示)
struct JourneyCardMiniView: View {
    let detail: JourneyCardDetail

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                PixelSnapshotView(snapshot: detail.pixelSnapshot, size: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(detail.originCity ?? "?") → \(detail.stations.last?.city ?? "?")")
                        .responsiveFont(.subheadline, weight: .semibold)
                        .foregroundColor(AppColors.textPrimary)
                    Text(String(format: NSLocalizedString("drift_bottle.open.mini_stats", comment: ""), detail.totalStations, String(format: "%.1f", detail.distanceKm), detail.totalDays))
                        .responsiveFont(.caption2)
                        .foregroundColor(AppColors.textTertiary)
                }
                Spacer()
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.white)
                .shadow(color: .black.opacity(0.06), radius: 6, x: 0, y: 2)
        )
    }
}
