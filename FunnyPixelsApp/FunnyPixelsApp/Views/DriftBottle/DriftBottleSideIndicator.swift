import SwiftUI

/// 左侧漂流瓶指示器 + 滑出面板
struct DriftBottleSideIndicator: View {
    @ObservedObject var manager = DriftBottleManager.shared
    @State private var messageText = ""
    @State private var isSubmitting = false
    @State private var showSuccess = false
    @State private var pulseIcon = false
    @State private var errorMessage: String?

    private var quota: BottleQuota? { manager.quota }
    private var availableBottles: Int { quota?.totalAvailable ?? 0 }
    private var isGPSDrawing: Bool { GPSDrawingService.shared.isGPSDrawingMode }

    var body: some View {
        ZStack(alignment: .leading) {
            // 背景遮罩 (展开时)
            if manager.showSidePanel {
                Color.black.opacity(0.3)
                    .ignoresSafeArea()
                    .onTapGesture { closePanel() }
                    .transition(.opacity)
            }

            // 侧边面板
            HStack(spacing: 0) {
                panelContent
                    .frame(width: 280)
                    .background(
                        RoundedRectangle(cornerRadius: 20, style: .continuous)
                            .fill(.ultraThinMaterial)
                            .shadow(color: .black.opacity(0.2), radius: 16, x: 4, y: 0)
                    )
                    .offset(x: manager.showSidePanel ? 0 : -290)

                Spacer()
            }

            // 闲置态图标 (面板关闭时)
            if !manager.showSidePanel {
                idleIndicator
                    .transition(.opacity)
            }
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.8), value: manager.showSidePanel)
        .onChange(of: manager.showBottleEarnedToast) {
            if manager.showBottleEarnedToast {
                withAnimation(.easeInOut(duration: 0.5)) {
                    pulseIcon = true
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    pulseIcon = false
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
    }

    // MARK: - Idle Indicator

    private var idleIndicator: some View {
        VStack {
            Spacer()
            Button(action: { manager.showSidePanel = true }) {
                ZStack(alignment: .topTrailing) {
                    Image(systemName: "sailboat.fill")
                        .font(.system(size: 26))
                        .foregroundColor(.cyan)
                        .padding(10)
                        .background(
                            Circle()
                                .fill(Color.white.opacity(0.6))
                                .blur(radius: 1)
                        )
                        .opacity(isGPSDrawing ? 0.2 : 0.35)
                        .scaleEffect(pulseIcon ? 1.3 : 1.0)

                    // 角标
                    if availableBottles > 0 {
                        Text("\(availableBottles)")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(.white)
                            .frame(width: 18, height: 18)
                            .background(Circle().fill(Color.red))
                            .offset(x: 4, y: -4)
                    }
                }
            }
            .buttonStyle(.plain)
            .padding(.leading, 4)
            Spacer()
        }
    }

    // MARK: - Panel Content

    private var panelContent: some View {
        VStack(alignment: .leading, spacing: 16) {
            // 标题行
            HStack {
                Image(systemName: "sailboat.fill")
                    .foregroundColor(.cyan)
                Text(String(format: NSLocalizedString("drift_bottle.indicator.count", comment: ""), availableBottles))
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundColor(AppColors.textPrimary)
                Spacer()
                Button(action: { closePanel() }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 20))
                        .foregroundColor(AppColors.textTertiary)
                }
            }

            // 留言输入框
            TextField(NSLocalizedString("drift_bottle.create.placeholder", comment: ""), text: $messageText)
                .textFieldStyle(.roundedBorder)
                .font(.system(size: 14))
                .onChange(of: messageText) {
                    if messageText.count > 50 {
                        messageText = String(messageText.prefix(50))
                    }
                }

            HStack {
                Text("\(messageText.count)/50")
                    .font(.caption2)
                    .foregroundColor(AppColors.textTertiary)
                Spacer()
            }

            // 扔出按钮
            Button(action: submitBottle) {
                HStack(spacing: 6) {
                    if isSubmitting {
                        ProgressView()
                            .scaleEffect(0.7)
                            .tint(.white)
                    } else {
                        Image(systemName: "water.waves")
                        Text(NSLocalizedString("drift_bottle.create.throw", comment: ""))
                    }
                }
                .font(.system(size: 15, weight: .bold))
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(Capsule().fill(availableBottles > 0 ? Color.blue : Color.gray))
            }
            .disabled(isSubmitting || availableBottles <= 0)

            Divider()

            // 累积进度
            progressSection

            Spacer()
        }
        .padding(20)
        .overlay {
            if showSuccess {
                successOverlay
                    .transition(.scale.combined(with: .opacity))
            }
        }
    }

    // MARK: - Progress Section

    private var progressSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let q = quota {
                // 每日免费
                HStack {
                    Text(NSLocalizedString("drift_bottle.quota.daily_free", comment: "每日免费"))
                        .font(.system(size: 13))
                        .foregroundColor(AppColors.textSecondary)
                    Spacer()
                    Text("\(q.dailyRemaining)/\(q.dailyFree)")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(q.dailyRemaining > 0 ? .green : AppColors.textTertiary)
                }

                // 画像素奖励
                if q.bonusFromPixels > 0 {
                    HStack {
                        Text(NSLocalizedString("drift_bottle.quota.pixel_bonus", comment: "画像素奖励"))
                            .font(.system(size: 13))
                            .foregroundColor(AppColors.textSecondary)
                        Spacer()
                        Text("+\(q.bonusFromPixels)")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(.cyan)
                    }
                }

                // 进度提示（仅当没有奖励时显示）
                if q.bonusFromPixels == 0 && q.dailyRemaining >= q.dailyFree {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(String(format: NSLocalizedString("drift_bottle.quota.pixels_needed", comment: "再画 %d 像素获得奖励"), q.pixelsForNextBottle))
                            .font(.system(size: 12))
                            .foregroundColor(AppColors.textTertiary)

                        // 进度条
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule()
                                    .fill(Color.gray.opacity(0.2))
                                    .frame(height: 4)
                                Capsule()
                                    .fill(Color.cyan)
                                    .frame(width: geo.size.width * min(q.pixelProgress, 1.0), height: 4)
                            }
                        }
                        .frame(height: 4)
                    }
                    .padding(.top, 4)
                }
            }
        }
    }

    // MARK: - Success Overlay

    private var successOverlay: some View {
        VStack(spacing: 8) {
            Image(systemName: "sailboat.fill")
                .font(.system(size: 40))
                .foregroundColor(.white)
            Text(NSLocalizedString("drift_bottle.create.success", comment: ""))
                .font(.system(size: 15, weight: .bold))
                .foregroundColor(.white)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(Color.blue.opacity(0.9))
        )
    }

    // MARK: - Actions

    private func closePanel() {
        guard !showSuccess else { return }
        withAnimation { manager.showSidePanel = false }
        messageText = ""
    }

    private func submitBottle() {
        guard !isSubmitting, availableBottles > 0 else { return }
        isSubmitting = true

        Task {
            do {
                try await manager.throwBottle(message: messageText)
                withAnimation(.spring(response: 0.4)) {
                    showSuccess = true
                }
                try? await Task.sleep(nanoseconds: 1_500_000_000)
                withAnimation {
                    showSuccess = false
                    closePanel()
                }
            } catch {
                Logger.error("Throw drift bottle failed: \(error.localizedDescription)")
                await MainActor.run {
                    errorMessage = error.localizedDescription
                }
            }
            isSubmitting = false
        }
    }
}
