import Foundation

/// 引导流程状态枚举
/// 定义用户在引导过程中的所有可能状态
enum OnboardingState: String, Codable {
    /// 未开始引导
    case notStarted

    /// 显示欢迎闪屏（2秒自动过渡）
    case welcome

    /// 等待用户首次点击地图
    case firstTap

    /// 正在执行绘制API调用
    case drawing

    /// 绘制成功，显示庆祝动画
    case celebration

    /// 绘制后教育时刻（介绍联盟系统）
    case postEducation

    /// 引导流程已完成
    case completed
}

/// 引导步骤枚举
/// 用于追踪用户完成了哪些关键步骤
enum OnboardingStep: String, Codable {
    /// 用户看完了欢迎动画
    case sawWelcome

    /// 用户成功绘制了第一个像素
    case firstDraw

    /// 用户加入了联盟
    case joinedAlliance

    /// 用户使用了GPS绘制
    case usedGPS
}
