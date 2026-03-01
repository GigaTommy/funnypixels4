import Foundation
import SwiftUI

// MARK: - String Extensions

public extension String {
    /// Returns a new string containing the characters of the String after trimming whitespace from both ends.
    var trimmed: String {
        return self.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Returns whether the string is empty or contains only whitespace.
    var isBlank: Bool {
        return self.trimmed.isEmpty
    }

    /// Validates if the string is a valid email format.
    var isValidEmail: Bool {
        let emailRegex = "[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,64}"
        let emailPredicate = NSPredicate(format: "SELF MATCHES %@", emailRegex)
        return emailPredicate.evaluate(with: self)
    }
}

// MARK: - Optional Extensions

public extension Optional where Wrapped == String {
    /// Returns whether the optional string is nil, empty, or contains only whitespace.
    var isNilOrBlank: Bool {
        return self?.isBlank ?? true
    }
}

// MARK: - View Extensions

public extension View {
    /// Applies a transform to the view if the condition is true.
    @ViewBuilder
    func `if`<Transform: View>(
        _ condition: Bool,
        transform: (Self) -> Transform
    ) -> some View {
        if condition {
            transform(self)
        } else {
            self
        }
    }

    /// Applies a different transform depending on the condition.
    @ViewBuilder
    func `if`<TrueContent: View, FalseContent: View>(
        _ condition: Bool,
        if ifTransform: (Self) -> TrueContent,
        else elseTransform: (Self) -> FalseContent
    ) -> some View {
        if condition {
            ifTransform(self)
        } else {
            elseTransform(self)
        }
    }
}

// MARK: - DateFormatter Extensions

public extension DateFormatter {
    /// Creates a date formatter with the specified format.
    static func with(format: String) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.dateFormat = format
        return formatter
    }
}
