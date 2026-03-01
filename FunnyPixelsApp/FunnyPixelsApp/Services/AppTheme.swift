
import SwiftUI
import Combine

// MARK: - Font Size Manager

public enum AppFontSize: String, CaseIterable, Identifiable {
    case small = "small"
    case medium = "medium"
    case large = "large"
    
    public var id: String { rawValue }
    
    var displayName: String {
        switch self {
        case .small: return NSLocalizedString("settings.font.small", comment: "")
        case .medium: return NSLocalizedString("settings.font.medium", comment: "")
        case .large: return NSLocalizedString("settings.font.large", comment: "")
        }
    }
    
    var scaleFactor: CGFloat {
        switch self {
        case .small: return 0.85
        case .medium: return 1.0
        case .large: return 1.2
        }
    }
}

public class FontSizeManager: ObservableObject {
    public static let shared = FontSizeManager()
    
    @Published public var currentSize: AppFontSize = .small {
        didSet {
            UserDefaults.standard.set(currentSize.rawValue, forKey: "appFontSize")
        }
    }
    
    private init() {
        if let savedValue = UserDefaults.standard.string(forKey: "appFontSize"),
           let fontSize = AppFontSize(rawValue: savedValue) {
            self.currentSize = fontSize
        }
    }
    
    public var scale: CGFloat {
        currentSize.scaleFactor
    }
    
    public func scaledFont(_ style: Font.TextStyle) -> Font {
        // Fallback to DesignSystem logic if needed, but for now maintaining this logic 
        // as it integrates dynamic scaling which AppTypography might adopt later.
        switch style {
        case .largeTitle: return .system(size: 34 * scale, weight: .bold)
        case .title: return .system(size: 28 * scale, weight: .bold)
        case .title2: return .system(size: 22 * scale, weight: .bold)
        case .title3: return .system(size: 20 * scale, weight: .semibold)
        case .headline: return .system(size: 17 * scale, weight: .semibold)
        case .body: return .system(size: 17 * scale)
        case .callout: return .system(size: 16 * scale)
        case .subheadline: return .system(size: 15 * scale)
        case .footnote: return .system(size: 13 * scale)
        case .caption: return .system(size: 12 * scale)
        case .caption2: return .system(size: 11 * scale)
        @unknown default: return .body
        }
    }
}

struct DynamicFontModifier: ViewModifier {
    let fontManager = FontSizeManager.shared
    let style: Font.TextStyle
    let weight: Font.Weight
    let design: Font.Design
    
    init(style: Font.TextStyle, weight: Font.Weight? = nil, design: Font.Design = .default) {
        self.style = style
        self.weight = weight ?? .regular
        self.design = design
    }
    
    func body(content: Content) -> some View {
        content.font(fontManager.scaledFont(style).weight(weight))
    }
}

extension View {
    func dynamicFont(_ style: Font.TextStyle, weight: Font.Weight? = nil, design: Font.Design = .default) -> some View {
        self.modifier(DynamicFontModifier(style: style, weight: weight, design: design))
    }
}
