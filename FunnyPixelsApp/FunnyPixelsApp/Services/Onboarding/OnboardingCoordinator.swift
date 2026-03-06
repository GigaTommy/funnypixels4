import Foundation
import SwiftUI
import CoreLocation
import Combine

/// 引导协调器 - 状态机实现
/// 负责管理新用户引导流程的状态转换和业务逻辑
@MainActor
class OnboardingCoordinator: ObservableObject {

    // MARK: - Singleton

    static let shared = OnboardingCoordinator()

    // MARK: - Published State

    @Published private(set) var currentState: OnboardingState = .notStarted
    @Published private(set) var currentTooltip: TooltipConfiguration?
    @Published var showWelcome = false
    @Published var showCelebration = false
    @Published var showPostEducation = false

    // MARK: - Dependencies (注入)

    private let drawingService: DrawingService
    private let patternProvider: AllianceDrawingPatternProvider
    private let pixelService: PixelDrawService

    // MARK: - State

    private var firstPixelCoordinate: CLLocationCoordinate2D?
    private var completedSteps: Set<OnboardingStep> = []

    // MARK: - Init

    init(
        drawingService: DrawingService? = nil,
        patternProvider: AllianceDrawingPatternProvider? = nil,
        pixelService: PixelDrawService? = nil
    ) {
        self.drawingService = drawingService ?? .shared
        self.patternProvider = patternProvider ?? .shared
        self.pixelService = pixelService ?? .shared

        restoreState()
    }

    // MARK: - Public Methods

    /// 开始引导流程
    func startOnboarding() {
        Logger.info("🎓 Starting onboarding flow")
        AnalyticsManager.shared.track("onboarding_started")
        // 立即标记已看过引导，确保即使用户中断流程也不会重复显示
        UserDefaults.standard.set(true, forKey: "hasSeenOnboarding_v3")
        transition(to: .welcome)
    }

    /// 用户点击了地图
    func handleMapTap(at coordinate: CLLocationCoordinate2D) {
        guard currentState == .firstTap else { return }

        Logger.info("🎓 User tapped map at: \(coordinate.latitude), \(coordinate.longitude)")
        firstPixelCoordinate = coordinate
        transition(to: .drawing)

        // 调用真实绘制API
        Task {
            await performFirstDraw(at: coordinate)
        }
    }

    /// 用户点击"加入联盟"
    func handleJoinAllianceTap() {
        Logger.info("🎓 User tapped join alliance button")
        AnalyticsManager.shared.track("onboarding_alliance_prompt_tapped")
        completeOnboarding()

        // 触发联盟选择界面
        NotificationCenter.default.post(
            name: .showAllianceSelection,
            object: nil
        )
    }

    /// 跳过引导
    func skipOnboarding() {
        Logger.info("🎓 User skipped onboarding at state: \(currentState.rawValue)")
        AnalyticsManager.shared.track("onboarding_skipped", properties: [
            "current_state": currentState.rawValue
        ])
        completeOnboarding()
    }

    /// 关闭提示气泡
    func dismissTooltip() {
        currentTooltip = nil
    }

    // MARK: - Private Methods

    /// 状态转换（状态机核心）
    private func transition(to newState: OnboardingState) {
        let oldState = currentState
        currentState = newState

        Logger.info("🎓 Onboarding: \(oldState.rawValue) → \(newState.rawValue)")
        AnalyticsManager.shared.track("onboarding_state_changed", properties: [
            "from": oldState.rawValue,
            "to": newState.rawValue
        ])

        // 执行状态进入动作
        handleStateEntry(newState)
    }

    /// 处理状态进入
    private func handleStateEntry(_ state: OnboardingState) {
        switch state {
        case .notStarted:
            break

        case .welcome:
            showWelcome = true
            completedSteps.insert(.sawWelcome)
            // 2秒后自动进入下一步
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                self.transition(to: .firstTap)
            }

        case .firstTap:
            showWelcome = false
            // 加载绘制图案（默认颜色）
            Task {
                await patternProvider.loadDrawingPattern()
            }
            // 显示提示：点击地图
            let screenSize = UIScreen.main.bounds.size
            currentTooltip = .firstTap(screenSize: screenSize)

        case .drawing:
            currentTooltip = nil
            // 绘制中...（API调用在 handleMapTap 中）

        case .celebration:
            showCelebration = true
            HapticManager.shared.notification(type: .success)

            // 3秒后进入教育时刻
            DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
                self.transition(to: .postEducation)
            }

        case .postEducation:
            showCelebration = false
            showPostEducation = true

            // 显示提示：加入联盟解锁更多图案
            let screenSize = UIScreen.main.bounds.size
            currentTooltip = .postDrawSuccess(screenSize: screenSize)

        case .completed:
            showPostEducation = false
            currentTooltip = nil
            saveCompletionState()
        }
    }

    /// 执行首次绘制
    private func performFirstDraw(at coordinate: CLLocationCoordinate2D) async {
        do {
            Logger.info("🎓 Attempting first pixel draw...")

            // 获取绘制参数
            let params = patternProvider.getDrawingParameters()

            // ✅ 真实API调用
            let _ = try await drawingService.drawPixel(
                latitude: coordinate.latitude,
                longitude: coordinate.longitude,
                type: params.type,
                color: params.color,
                emoji: params.emoji,
                patternId: params.patternId
            )

            // 记录成功
            completedSteps.insert(.firstDraw)
            Logger.info("🎓 First pixel drawn successfully!")

            AnalyticsManager.shared.track("onboarding_first_pixel_drawn", properties: [
                "coordinate": "\(coordinate.latitude),\(coordinate.longitude)",
                "pattern": patternProvider.currentDrawingPattern?.patternName ?? "unknown"
            ])

            // 转换到庆祝状态
            await MainActor.run {
                transition(to: .celebration)
            }

        } catch {
            // 处理错误
            Logger.error("🎓 Onboarding first draw failed: \(error.localizedDescription)")

            AnalyticsManager.shared.track("onboarding_first_pixel_failed", properties: [
                "error": error.localizedDescription
            ])

            // 显示错误提示并允许重试
            await MainActor.run {
                showErrorAndRetry(error)
            }
        }
    }

    /// 显示错误并重试
    private func showErrorAndRetry(_ error: Error) {
        // 显示Toast
        NotificationCenter.default.post(
            name: .showErrorToast,
            object: nil,
            userInfo: [
                "message": error.localizedDescription,
                "action": NSLocalizedString("common.retry", value: "重试", comment: "Retry action")
            ]
        )

        // 返回到 firstTap 状态允许重试
        transition(to: .firstTap)
    }

    /// 完成引导
    private func completeOnboarding() {
        transition(to: .completed)
    }

    /// 保存完成状态
    private func saveCompletionState() {
        UserDefaults.standard.set(true, forKey: "hasSeenOnboarding_v3")
        UserDefaults.standard.set(
            Array(completedSteps.map { $0.rawValue }),
            forKey: "onboarding_completed_steps_v3"
        )

        Logger.info("🎓 Onboarding completed. Steps: \(completedSteps.count)")

        AnalyticsManager.shared.track("onboarding_completed", properties: [
            "steps_completed": completedSteps.count
        ])
    }

    /// 恢复状态
    private func restoreState() {
        if let saved = UserDefaults.standard.array(forKey: "onboarding_completed_steps_v3") as? [String] {
            completedSteps = Set(saved.compactMap { OnboardingStep(rawValue: $0) })
            Logger.debug("🎓 Restored \(completedSteps.count) completed steps")
        }
    }
}

// MARK: - Tooltip Configuration

/// 提示气泡配置
struct TooltipConfiguration {
    let icon: String
    let title: String
    let message: String
    let anchorPoint: CGPoint
    let arrowAlignment: Alignment
    let arrowRotation: Angle
    let arrowOffset: CGSize

    /// 预设配置 - Step 1: 点击地图
    static func firstTap(screenSize: CGSize) -> TooltipConfiguration {
        TooltipConfiguration(
            icon: "hand.tap.fill",
            title: NSLocalizedString("tooltip.first_tap.title", value: "点击地图开始创作", comment: "First tap tooltip title"),
            message: NSLocalizedString("tooltip.first_tap.message", value: "点击地图任意位置，放置你的第一个像素", comment: "First tap tooltip message"),
            anchorPoint: CGPoint(
                x: screenSize.width / 2,
                y: screenSize.height * 0.45  // 屏幕中心偏上
            ),
            arrowAlignment: .bottom,
            arrowRotation: .degrees(180),
            arrowOffset: CGSize(width: 0, height: 10)
        )
    }

    /// 预设配置 - Step 2: 成功绘制后
    static func postDrawSuccess(screenSize: CGSize) -> TooltipConfiguration {
        TooltipConfiguration(
            icon: "checkmark.circle.fill",
            title: NSLocalizedString("tooltip.post_draw.title", value: "绘制成功！", comment: "Post draw tooltip title"),
            message: NSLocalizedString("tooltip.post_draw.message", value: "你使用的是默认颜色。加入联盟可以使用更多图案！", comment: "Post draw tooltip message"),
            anchorPoint: CGPoint(
                x: screenSize.width / 2,
                y: screenSize.height * 0.35
            ),
            arrowAlignment: .top,
            arrowRotation: .degrees(0),
            arrowOffset: CGSize(width: 0, height: -10)
        )
    }
}

// MARK: - Notification Names

extension NSNotification.Name {
    static let showAllianceSelection = NSNotification.Name("showAllianceSelection")
    static let showErrorToast = NSNotification.Name("showErrorToast")
}

// MARK: - CGSize Extension

extension CGRect {
    var center: CGPoint {
        CGPoint(x: midX, y: midY)
    }
}
