
import UIKit

/// Manages haptic feedback for the application.
class HapticManager {
    static let shared = HapticManager()
    
    private init() {}
    
    /// Trigger a notification feedback (success, error, warning).
    func notification(type: UINotificationFeedbackGenerator.FeedbackType) {
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(type)
    }
    
    /// Trigger an impact feedback (light, medium, heavy, rigud, soft).
    func impact(style: UIImpactFeedbackGenerator.FeedbackStyle) {
        let generator = UIImpactFeedbackGenerator(style: style)
        generator.impactOccurred()
    }
    
    /// Trigger a selection change feedback (e.g., picker scroll).
    func selection() {
        let generator = UISelectionFeedbackGenerator()
        generator.selectionChanged()
    }
}
