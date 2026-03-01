import SwiftUI

// MARK: - 第三方支付图标已移除
//
// 根据 App Store Review Guidelines 3.1.1：
// iOS 应用内的虚拟商品（积分、道具等）必须使用 Apple In-App Purchase。
// 不允许显示或引导用户使用第三方支付（支付宝、微信支付等）。
//
// 以下组件已被删除以确保 App Store 审核合规：
// - AlipayIcon（支付宝图标）
// - WeChatPayIcon（微信支付图标）
//
// 如需为其他平台（Android、Web）保留这些图标，
// 请在对应平台的代码库中重新实现。
//
// 修改日期：2026-02-24
// 修改原因：App Store 合规性要求
