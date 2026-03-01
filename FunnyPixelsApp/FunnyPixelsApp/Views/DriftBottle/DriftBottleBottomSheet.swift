import SwiftUI

/// 底部上拉式漂流瓶创建面板（替代侧边栏）
struct DriftBottleBottomSheet: View {
    @ObservedObject var manager = DriftBottleManager.shared
    @State private var messageText = ""
    @State private var isSubmitting = false
    @State private var showSuccess = false
    @State private var errorMessage: String?

    private var quota: BottleQuota? { manager.quota }
    private var availableBottles: Int { quota?.totalAvailable ?? 0 }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // 标题和配额信息
                    quotaHeader

                    // 留言输入区域
                    messageInputSection

                    // 扔出按钮
                    throwButton

                    Divider()
                        .padding(.vertical, 8)

                    // 配额详情
                    quotaDetailsSection
                }
                .padding(20)
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    HStack(spacing: 6) {
                        Image("drift_bottle_icon")
                            .resizable()
                            .scaledToFit()
                            .frame(width: 24, height: 24)
                        Text(NSLocalizedString("drift_bottle.title", comment: "漂流瓶"))
                            .font(.system(size: 17, weight: .semibold))
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { manager.showBottleSheet = false }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(AppColors.textTertiary)
                    }
                }
            }
            .overlay {
                if showSuccess {
                    successOverlay
                        .transition(.scale.combined(with: .opacity))
                }
            }
        }
        .onAppear {
            Task { await manager.refreshQuota() }
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

    // MARK: - Components

    private var quotaHeader: some View {
        HStack(spacing: 12) {
            Image(systemName: "sailboat.fill")
                .font(.system(size: 32))
                .foregroundColor(.cyan)

            VStack(alignment: .leading, spacing: 4) {
                Text(String(format: NSLocalizedString("drift_bottle.indicator.count", comment: ""), availableBottles))
                    .font(.system(size: 20, weight: .bold))
                    .foregroundColor(AppColors.textPrimary)

                Text("可用漂流瓶")
                    .font(.system(size: 14))
                    .foregroundColor(AppColors.textSecondary)
            }

            Spacer()
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.cyan.opacity(0.1))
        )
    }

    private var messageInputSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("漂流瓶留言")
                .font(.system(size: 15, weight: .semibold))
                .foregroundColor(AppColors.textPrimary)

            TextEditor(text: $messageText)
                .frame(height: 100)
                .padding(8)
                .background(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                )
                .onChange(of: messageText) {
                    if messageText.count > 50 {
                        messageText = String(messageText.prefix(50))
                    }
                }

            HStack {
                Text("写下你想说的话，让它漂向远方...")
                    .font(.caption)
                    .foregroundColor(AppColors.textTertiary)
                Spacer()
                Text("\(messageText.count)/50")
                    .font(.caption)
                    .foregroundColor(messageText.count >= 45 ? .orange : AppColors.textTertiary)
            }
        }
    }

    private var throwButton: some View {
        Button(action: submitBottle) {
            HStack(spacing: 8) {
                if isSubmitting {
                    ProgressView()
                        .tint(.white)
                } else {
                    Image(systemName: "water.waves")
                    Text(NSLocalizedString("drift_bottle.create.throw", comment: "扔出去"))
                }
            }
            .font(.system(size: 17, weight: .bold))
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                Capsule()
                    .fill(availableBottles > 0 ? Color.blue : Color.gray)
            )
        }
        .disabled(isSubmitting || availableBottles <= 0)
    }

    private var quotaDetailsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("配额详情")
                .font(.system(size: 15, weight: .semibold))
                .foregroundColor(AppColors.textPrimary)

            if let q = quota {
                // 每日免费
                QuotaRow(
                    icon: "calendar.badge.clock",
                    title: "每日免费",
                    value: "\(q.dailyRemaining)/\(q.dailyFree)",
                    color: q.dailyRemaining > 0 ? .green : .gray
                )

                // 画像素奖励
                if q.bonusFromPixels > 0 {
                    QuotaRow(
                        icon: "paintbrush.fill",
                        title: "画像素奖励",
                        value: "+\(q.bonusFromPixels)",
                        color: .cyan
                    )
                }

                // 进度提示
                if q.bonusFromPixels == 0 && q.dailyRemaining >= q.dailyFree {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Image(systemName: "sparkles")
                                .foregroundColor(.orange)
                            Text(String(format: "再画 %d 像素获得奖励", q.pixelsForNextBottle))
                                .font(.system(size: 13))
                                .foregroundColor(AppColors.textSecondary)
                        }

                        // 进度条
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule()
                                    .fill(Color.gray.opacity(0.2))
                                    .frame(height: 6)
                                Capsule()
                                    .fill(
                                        LinearGradient(
                                            colors: [.cyan, .blue],
                                            startPoint: .leading,
                                            endPoint: .trailing
                                        )
                                    )
                                    .frame(width: geo.size.width * min(q.pixelProgress, 1.0), height: 6)
                            }
                        }
                        .frame(height: 6)
                    }
                    .padding(12)
                    .background(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(Color.orange.opacity(0.1))
                    )
                }
            }
        }
    }

    private var successOverlay: some View {
        ZStack {
            Color.black.opacity(0.3)
                .ignoresSafeArea()

            VStack(spacing: 16) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 60))
                    .foregroundColor(.green)

                Text("漂流瓶已扔出！")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundColor(.white)

                Text("它将漂向远方，寻找有缘人...")
                    .font(.system(size: 15))
                    .foregroundColor(.white.opacity(0.9))
            }
            .padding(32)
            .background(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .fill(.ultraThinMaterial)
            )
        }
    }

    // MARK: - Actions

    private func submitBottle() {
        guard !isSubmitting, availableBottles > 0 else { return }
        isSubmitting = true

        Task {
            do {
                try await manager.throwBottle(message: messageText)
                await MainActor.run {
                    withAnimation(.spring(response: 0.4)) {
                        showSuccess = true
                    }
                }
                try? await Task.sleep(nanoseconds: 1_500_000_000)
                await MainActor.run {
                    withAnimation {
                        showSuccess = false
                        manager.showBottleSheet = false
                        messageText = ""
                    }
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

// MARK: - Supporting Views

private struct QuotaRow: View {
    let icon: String
    let title: String
    let value: String
    let color: Color

    var body: some View {
        HStack {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundColor(color)
                .frame(width: 24)

            Text(title)
                .font(.system(size: 14))
                .foregroundColor(AppColors.textSecondary)

            Spacer()

            Text(value)
                .font(.system(size: 15, weight: .semibold))
                .foregroundColor(color)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Preview

struct DriftBottleBottomSheet_Previews: PreviewProvider {
    static var previews: some View {
        DriftBottleBottomSheet()
    }
}
